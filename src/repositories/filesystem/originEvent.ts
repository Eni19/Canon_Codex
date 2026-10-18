import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { dateToOrdinal, getCalendarDateAtOrdinal, getCalendarYearLength, isIntercalaryRuleActive, type Calendar, type CalendarDate } from '@/domain/worlds/calendar'
import { CalendarDateValueSchema, legacyIsoDateToOrdinal, parseLegacyIsoDate, validateCalendarDateValue, type CalendarDateBoundary } from '@/domain/worlds/calendar-date'
import { EntitySchema, type Entity } from '@/domain/entities/entity'
import { TimelineDataSchema, parseTimelineData, type TimelineData } from '@/domain/timelines/timeline'
import { WorldSchema, type World } from '@/domain/worlds/world'
import { atomicWriteText, ensureDir, pathExists } from '@/lib/fs/atomicWrite'
import { getEntitiesDir, getTrashDir, getWorldDir, getWorldJsonPath } from '@/lib/fs/paths'
import { readMigratedJson } from '@/lib/migrations/registry'
import type { OriginEventPreview } from '@/repositories/contracts/worldRepository'
import { entityMigrations } from './migrations'
import { readWorldByDir } from './worldDirRegistry'

interface Entry { file: string; text: string; entity: Entity; timeline?: { file: string; text: string; data: TimelineData } }
interface Change { file: string; before: string; after: string }
const BackupSchema = z.object({
  worldId: z.uuid(),
  state: z.enum(['applying', 'completed', 'restored']),
  originalWorld: z.string(),
  changes: z.array(z.object({ file: z.string(), before: z.string() })),
})

/**
 * Lock-free check used by reads: true while an origin change is applying or was interrupted.
 * A backup that cannot be read also returns true, so the locked path reports the problem.
 */
export async function hasInterruptedOriginEvent(worldDir: string): Promise<boolean> {
  const dir = path.join(getWorldDir(worldDir), 'origin-backups')
  if (!(await pathExists(dir))) return false
  for (const file of await readdir(dir)) {
    if (!/^[0-9a-f-]{36}\.json$/i.test(file)) continue
    try {
      if (BackupSchema.shape.state.parse(JSON.parse(await readFile(path.join(dir, file), 'utf8')).state) === 'applying') return true
    } catch { return true }
  }
  return false
}

/** Called only while holding the world write lock, before any world operation. */
export async function recoverInterruptedOriginEvent(worldDir: string): Promise<void> {
  const dir = path.join(getWorldDir(worldDir), 'origin-backups')
  if (!(await pathExists(dir))) return
  for (const file of await readdir(dir)) {
    if (!/^[0-9a-f-]{36}\.json$/i.test(file)) continue
    const backupPath = path.join(dir, file)
    const backup = BackupSchema.parse(JSON.parse(await readFile(backupPath, 'utf8')))
    if (backup.state !== 'applying') continue
    const world = await readWorldByDir(worldDir)
    if (backup.worldId !== world.id) throw new Error('O backup da origem pertence a outro mundo.')
    for (const change of backup.changes) {
      if (!/^(?:entities[\\/][0-9a-f-]{36}|trash[\\/]entity-[0-9a-f-]{36}-\d+)[\\/](?:metadata|timeline)\.json$/i.test(change.file)) {
        throw new Error('O backup da origem contém um caminho inválido.')
      }
      await atomicWriteText(path.join(getWorldDir(worldDir), change.file), change.before)
    }
    await atomicWriteText(getWorldJsonPath(worldDir), backup.originalWorld)
    await atomicWriteText(backupPath, JSON.stringify({ ...backup, state: 'restored' }, null, 2))
  }
}

async function scan(worldDir: string): Promise<Entry[]> {
  const entries: Entry[] = []
  for (const dir of [getEntitiesDir(worldDir), getTrashDir(worldDir)]) {
    if (!(await pathExists(dir))) continue
    for (const item of await readdir(dir, { withFileTypes: true })) {
      if (!item.isDirectory() || (dir === getTrashDir(worldDir) && !item.name.startsWith('entity-'))) continue
      const file = path.join(dir, item.name, 'metadata.json')
      if (!(await pathExists(file))) continue
      const entity = await readMigratedJson(file, entityMigrations, EntitySchema)
      const timelineFile = path.join(dir, item.name, 'timeline.json')
      let timeline: Entry['timeline']
      if (entity.type === 'timeline' && await pathExists(timelineFile)) {
        const text = await readFile(timelineFile, 'utf8')
        const data = parseTimelineData(JSON.parse(text))
        if (data.worldId !== entity.worldId || data.timelineId !== entity.id) throw new Error('Os dados da linha do tempo não correspondem ao registro.')
        timeline = { file: timelineFile, text, data }
      }
      entries.push({ file, text: await readFile(file, 'utf8'), entity, timeline })
    }
  }
  return entries.sort((a, b) => a.file.localeCompare(b.file))
}

function range(calendar: Calendar, boundary: CalendarDateBoundary): { first: number; last: number } {
  const first = dateToOrdinal(calendar, { year: boundary.year, month: boundary.month ?? 1, day: boundary.day ?? 1 })
  if (boundary.day !== undefined) return { first, last: first }
  if (boundary.month === undefined) return { first, last: first + getCalendarYearLength(calendar, boundary.year) - 1 }
  const extras = calendar.intercalaryRules.filter((rule) => rule.month === boundary.month && rule.extendsMonth && isIntercalaryRuleActive(rule, boundary.year)).length
  return { first, last: first + calendar.months[boundary.month - 1].length + extras - 1 }
}

function dateAt(calendar: Calendar, ordinal: number, approximate?: boolean): CalendarDateBoundary {
  const date = getCalendarDateAtOrdinal(calendar, ordinal)
  if (date.month === undefined || date.day === undefined) throw new Error('O deslocamento alcança um dia intercalar sem data editável.')
  return { year: date.year, month: date.month, day: date.day, ...(approximate ? { approximate: true } : {}) }
}

function shiftBoundary(calendar: Calendar, boundary: CalendarDateBoundary, shift: number, edge: 'start' | 'end'): { value: CalendarDateBoundary; precisionChanged: boolean } {
  const original = range(calendar, boundary)
  const first = original.first + shift
  const last = original.last + shift
  const firstDate = getCalendarDateAtOrdinal(calendar, first)
  const approximate = boundary.approximate
  if (boundary.day === undefined && firstDate.month === 1 && firstDate.day === 1
    && boundary.month === undefined && range(calendar, { year: firstDate.year }).last === last) {
    return { value: { year: firstDate.year, ...(approximate ? { approximate } : {}) }, precisionChanged: false }
  }
  if (boundary.day === undefined && boundary.month !== undefined && firstDate.month !== undefined && firstDate.day === 1
    && range(calendar, { year: firstDate.year, month: firstDate.month }).last === last) {
    return { value: { year: firstDate.year, month: firstDate.month, ...(approximate ? { approximate } : {}) }, precisionChanged: false }
  }
  return { value: dateAt(calendar, edge === 'start' ? first : last, approximate), precisionChanged: boundary.day === undefined }
}

function shiftDate(calendar: Calendar, input: unknown, shift: number): { value: unknown; precisionChanged: boolean } {
  if (shift === 0) return { value: input, precisionChanged: false }
  if (typeof input === 'string') {
    const legacy = parseLegacyIsoDate(input)
    if (!legacy.success) throw new Error(`Data legada inválida: ${legacy.error}`)
    return { value: { start: dateAt(calendar, legacyIsoDateToOrdinal(legacy.data) + shift) }, precisionChanged: false }
  }
  const valid = validateCalendarDateValue(calendar, input)
  if (!valid.success) throw new Error(valid.error)
  const start = shiftBoundary(calendar, valid.data.start, shift, 'start')
  const end = valid.data.end ? shiftBoundary(calendar, valid.data.end, shift, 'end') : null
  return {
    value: { start: start.value, ...(end ? { end: end.value } : {}) },
    precisionChanged: start.precisionChanged || Boolean(end?.precisionChanged),
  }
}

function eventOrdinal(world: World, entity: Entity): number {
  if (entity.worldId !== world.id || entity.type !== 'event') throw new Error('Escolha um Evento deste mundo.')
  const value = entity.properties.eventDate
  if (typeof value === 'string') {
    const legacy = parseLegacyIsoDate(value)
    if (!legacy.success) throw new Error('O Evento precisa ter data completa e válida.')
    return legacyIsoDateToOrdinal(legacy.data)
  }
  const parsed = CalendarDateValueSchema.safeParse(value)
  if (!parsed.success || !validateCalendarDateValue(world.calendar, value).success || parsed.data.start.month === undefined || parsed.data.start.day === undefined || parsed.data.end || parsed.data.start.approximate) {
    throw new Error('O Evento de origem precisa ter uma data exata, completa e sem intervalo.')
  }
  return dateToOrdinal(world.calendar, parsed.data.start as CalendarDate)
}

function build(worldDir: string, world: World, entries: Entry[], eventId: string): { preview: OriginEventPreview; changes: Change[]; nextWorld: World } {
  const target = entries.find((entry) => entry.entity.id === eventId && entry.file.startsWith(getEntitiesDir(worldDir) + path.sep))
  if (!target) throw new Error('O Evento não está ativo neste mundo.')
  const oldOrdinal = eventOrdinal(world, target.entity)
  const newOrdinal = dateToOrdinal(world.calendar, { year: 0, month: world.calendar.origin.month, day: world.calendar.origin.day })
  const shift = newOrdinal - oldOrdinal
  const keys = new Map(world.entityTypes.map((type) => [type.id, type.properties.filter((property) => property.kind === 'date').map((property) => property.key)]))
  const changes: Change[] = []
  const examples: OriginEventPreview['examples'] = []
  let affectedDates = 0
  let precisionChanges = 0
  for (const entry of entries) {
    if (entry.entity.worldId !== world.id) throw new Error('O diretório contém um registro de outro mundo.')
    const properties = { ...entry.entity.properties }
    let changed = false
    for (const key of keys.get(entry.entity.type) ?? []) {
      const before = properties[key]
      if (before === undefined || before === null || before === '') continue
      let shifted: ReturnType<typeof shiftDate>
      try { shifted = shiftDate(world.calendar, before, shift) }
      catch (error) { throw new Error(`Não foi possível deslocar ${entry.entity.title} · ${key}: ${error instanceof Error ? error.message : String(error)}`) }
      const after = shifted.value
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        properties[key] = after
        affectedDates++
        if (shifted.precisionChanged) precisionChanges++
        changed = true
        if (examples.length < 8) examples.push({ title: entry.entity.title, field: key, before: JSON.stringify(before), after: JSON.stringify(after), precisionChanged: shifted.precisionChanged })
      }
    }
    if (changed) changes.push({ file: entry.file, before: entry.text, after: JSON.stringify(EntitySchema.parse({ ...entry.entity, properties }), null, 2) + '\n' })
    if (entry.timeline) {
      const appearances = entry.timeline.data.appearances.map((appearance) => {
        if (!appearance.date) return appearance
        let shifted: ReturnType<typeof shiftDate>
        try { shifted = shiftDate(world.calendar, appearance.date, shift) }
        catch (error) { throw new Error(`Não foi possível deslocar ${entry.entity.title} · aparição: ${error instanceof Error ? error.message : String(error)}`) }
        if (JSON.stringify(appearance.date) === JSON.stringify(shifted.value)) return appearance
        affectedDates++
        if (shifted.precisionChanged) precisionChanges++
        if (examples.length < 8) examples.push({ title: entry.entity.title, field: 'aparição', before: JSON.stringify(appearance.date), after: JSON.stringify(shifted.value), precisionChanged: shifted.precisionChanged })
        return { ...appearance, date: shifted.value }
      })
      if (appearances.some((appearance, index) => appearance !== entry.timeline!.data.appearances[index])) {
        const updatedAt = new Date(Math.max(Date.now(), Date.parse(entry.timeline.data.updatedAt) + 1)).toISOString()
        const after = TimelineDataSchema.parse({ ...entry.timeline.data, appearances, updatedAt })
        changes.push({ file: entry.timeline.file, before: entry.timeline.text, after: JSON.stringify(after, null, 2) + '\n' })
      }
    }
  }
  const nextWorld = WorldSchema.parse({ ...world, originEventId: eventId, updatedAt: new Date().toISOString() })
  const fingerprint = createHash('sha256').update(JSON.stringify({ world, entries: entries.map(({ file, text, timeline }) => [file, text, timeline?.text]) })).digest('hex')
  return { preview: { fingerprint, eventId, eventTitle: target.entity.title, shiftDays: shift, affectedEntities: new Set(changes.map((change) => path.dirname(change.file))).size, affectedDates, precisionChanges, examples }, changes, nextWorld }
}

export async function previewOriginEvent(worldDir: string, eventId: string): Promise<OriginEventPreview> {
  return build(worldDir, await readWorldByDir(worldDir), await scan(worldDir), eventId).preview
}

export async function replaceOriginEvent(worldDir: string, eventId: string, expectedFingerprint: string): Promise<World> {
  const world = await readWorldByDir(worldDir)
  const built = build(worldDir, world, await scan(worldDir), eventId)
  if (built.preview.fingerprint !== expectedFingerprint) throw new Error('O mundo mudou desde a prévia. Atualize a página e confirme novamente.')
  const worldFile = getWorldJsonPath(worldDir)
  const originalWorld = await readFile(worldFile, 'utf8')
  const backupDir = path.join(getWorldDir(worldDir), 'origin-backups')
  await ensureDir(backupDir)
  const backupFile = path.join(backupDir, `${randomUUID()}.json`)
  const backup = BackupSchema.parse({ worldId: world.id, state: 'applying', originalWorld, changes: built.changes.map(({ file, before }) => ({ file: path.relative(getWorldDir(worldDir), file), before })) })
  await atomicWriteText(backupFile, JSON.stringify(backup, null, 2))
  try {
    for (const change of built.changes) await atomicWriteText(change.file, change.after)
    await atomicWriteText(worldFile, JSON.stringify(built.nextWorld, null, 2) + '\n')
    await atomicWriteText(backupFile, JSON.stringify({ ...backup, state: 'completed' }, null, 2))
  } catch (error) {
    for (const change of built.changes) await atomicWriteText(change.file, change.before)
    await atomicWriteText(worldFile, originalWorld)
    await atomicWriteText(backupFile, JSON.stringify({ ...backup, state: 'restored' }, null, 2))
    throw error
  }
  return built.nextWorld
}
