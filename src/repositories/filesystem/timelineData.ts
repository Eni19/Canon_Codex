import 'server-only'
import { randomUUID } from 'node:crypto'
import { readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { TimelineAppearanceFieldsSchema, TimelineAppearanceSchema, TimelineDataSchema, emptyTimelineData, initialEventAppearanceDate, parseTimelineData, type TimelineAppearance, type TimelineAppearanceFields, type TimelineData } from '@/domain/timelines/timeline'
import { validateCalendarDateValue, type CalendarDateValue } from '@/domain/worlds/calendar-date'
import { EntitySchema, type Entity } from '@/domain/entities/entity'
import { atomicWriteJson, pathExists } from '@/lib/fs/atomicWrite'
import { getEntitiesDir, getEntityDir, getEntityMetadataPath, getTimelineDataPath, getTrashDir } from '@/lib/fs/paths'
import { readMigratedJson } from '@/lib/migrations/registry'
import { entityMigrations } from './migrations'
import { readWorldByDir } from './worldDirRegistry'
import { withWorldWriteLock } from './worldWriteLock'
import { buildNewEntity, writeInitialEntityFiles } from './entityCreation'
import { reconcileEntityLifecycle } from './entityLifecycle'

async function requireTimeline(worldDir: string, worldId: string, timelineId: string): Promise<void> {
  if (!z.uuid().safeParse(timelineId).success) throw new Error('Identificador de Linha do Tempo inválido.')
  const file = getEntityMetadataPath(worldDir, timelineId)
  if (!(await pathExists(file))) throw new Error('A Linha do Tempo não está ativa neste mundo.')
  const entity = await readMigratedJson(file, entityMigrations, EntitySchema)
  if (entity.id !== timelineId || entity.worldId !== worldId || entity.type !== 'timeline') {
    throw new Error('O registro informado não é uma Linha do Tempo deste mundo.')
  }
}

async function readData(worldDir: string, worldId: string, timelineId: string): Promise<TimelineData> {
  await requireTimeline(worldDir, worldId, timelineId)
  const file = getTimelineDataPath(worldDir, timelineId)
  if (!(await pathExists(file))) return emptyTimelineData(worldId, timelineId)
  const data = parseTimelineData(JSON.parse(await readFile(file, 'utf8')))
  if (data.worldId !== worldId || data.timelineId !== timelineId) throw new Error('As aparições pertencem a outra linha ou a outro mundo.')
  return data
}

export async function getTimelineData(worldDir: string, worldId: string, timelineId: string): Promise<TimelineData> {
  return withWorldWriteLock(worldDir, async () => {
    await requireTimeline(worldDir, worldId, timelineId)
    await reconcileEntityLifecycle(worldDir, worldId)
    return readData(worldDir, worldId, timelineId)
  })
}

function nextUpdatedAt(current: TimelineData): string {
  return new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString()
}

function checkedFields(world: Awaited<ReturnType<typeof readWorldByDir>>, fields: TimelineAppearanceFields): TimelineAppearanceFields {
  const parsed = TimelineAppearanceFieldsSchema.parse(fields)
  if (parsed.date) {
    const valid = validateCalendarDateValue(world.calendar, parsed.date)
    if (!valid.success) throw new Error(valid.error)
    return { ...parsed, date: valid.data }
  }
  return parsed
}

export async function addAppearance(worldDir: string, worldId: string, timelineId: string, entityId: string, date: CalendarDateValue | null, expectedUpdatedAt: string, presentation: Partial<Omit<TimelineAppearanceFields, 'date'>> = {}): Promise<TimelineData> {
  return withWorldWriteLock(worldDir, async () => {
    if (!z.uuid().safeParse(entityId).success) throw new Error('Identificador de registro inválido.')
    const world = await readWorldByDir(worldDir)
    if (world.id !== worldId) throw new Error('A Linha do Tempo pertence a outro mundo.')
    const current = await readData(worldDir, worldId, timelineId)
    if (current.updatedAt !== expectedUpdatedAt) throw new Error('A linha mudou desde que foi aberta. Atualize a página antes de incluir a aparição.')
    const targetFile = getEntityMetadataPath(worldDir, entityId)
    if (!(await pathExists(targetFile))) throw new Error('O registro não está ativo neste mundo.')
    const target = await readMigratedJson(targetFile, entityMigrations, EntitySchema)
    if (target.id !== entityId || target.worldId !== worldId) throw new Error('O registro pertence a outro mundo.')
    const fields = checkedFields(world, { title: null, note: null, date, minimumScale: null, showCover: true, ...presentation })
    const next = TimelineDataSchema.parse({
      ...current,
      updatedAt: nextUpdatedAt(current),
      appearances: [...current.appearances, { id: randomUUID(), entityId, ...fields }],
    })
    await atomicWriteJson(getTimelineDataPath(worldDir, timelineId), next)
    return next
  })
}

export async function updateAppearance(worldDir: string, worldId: string, timelineId: string, appearanceId: string, fields: TimelineAppearanceFields, expectedUpdatedAt: string): Promise<TimelineData> {
  return withWorldWriteLock(worldDir, async () => {
    if (!z.uuid().safeParse(appearanceId).success) throw new Error('Identificador de aparição inválido.')
    const world = await readWorldByDir(worldDir)
    if (world.id !== worldId) throw new Error('A Linha do Tempo pertence a outro mundo.')
    const current = await readData(worldDir, worldId, timelineId)
    if (current.updatedAt !== expectedUpdatedAt) throw new Error('A linha mudou desde que foi aberta. Atualize a página antes de editar.')
    if (!current.appearances.some((appearance) => appearance.id === appearanceId)) throw new Error('A aparição não existe nesta linha.')
    const nextFields = checkedFields(world, fields)
    const next = TimelineDataSchema.parse({ ...current, updatedAt: nextUpdatedAt(current),
      appearances: current.appearances.map((appearance) => appearance.id === appearanceId ? { ...appearance, ...nextFields } : appearance) })
    await atomicWriteJson(getTimelineDataPath(worldDir, timelineId), next)
    return next
  })
}

export async function createQuickEvent(worldDir: string, worldId: string, timelineId: string, title: string, date: CalendarDateValue, expectedUpdatedAt: string): Promise<{ entity: Entity; timeline: TimelineData }> {
  return withWorldWriteLock(worldDir, async () => {
    const world = await readWorldByDir(worldDir)
    if (world.id !== worldId) throw new Error('A Linha do Tempo pertence a outro mundo.')
    const current = await readData(worldDir, worldId, timelineId)
    if (current.updatedAt !== expectedUpdatedAt) throw new Error('A linha mudou desde que foi aberta. Atualize a página antes de criar o Evento.')
    const eventType = world.entityTypes.find((type) => type.id === 'event')
    if (!eventType) throw new Error('Este mundo não possui o tipo Evento.')
    const eventTitle = z.string().trim().min(1).max(200).parse(title)
    const fields = checkedFields(world, { title: null, note: null, date, minimumScale: null, showCover: true })
    if (!fields.date) throw new Error('Informe a data do Evento.')
    const entity = buildNewEntity(worldId, { type: 'event', title: eventTitle, properties: { eventDate: fields.date } })
    const next = TimelineDataSchema.parse({ ...current, updatedAt: nextUpdatedAt(current),
      appearances: [...current.appearances, { id: randomUUID(), entityId: entity.id, ...fields }] })
    try {
      await writeInitialEntityFiles(worldDir, entity)
      // The atomic rename is the commit point; a rejected write leaves the previous line intact.
      await atomicWriteJson(getTimelineDataPath(worldDir, timelineId), next)
    } catch (error) {
      await rm(getEntityDir(worldDir, entity.id), { recursive: true, force: true })
      throw error
    }
    return { entity, timeline: next }
  })
}

export async function addAllAppearances(worldDir: string, worldId: string, timelineId: string, expectedUpdatedAt: string): Promise<{ timeline: TimelineData; added: number }> {
  return withWorldWriteLock(worldDir, async () => {
    const world = await readWorldByDir(worldDir)
    if (world.id !== worldId) throw new Error('A Linha do Tempo pertence a outro mundo.')
    const current = await readData(worldDir, worldId, timelineId)
    if (current.updatedAt !== expectedUpdatedAt) throw new Error('A linha mudou desde que foi aberta. Atualize a página antes de adicionar todos.')
    const represented = new Set(current.appearances.map((appearance) => appearance.entityId))
    const dir = getEntitiesDir(worldDir)
    const items = await readdir(dir, { withFileTypes: true })
    const added: TimelineAppearance[] = []
    for (const item of items.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = getEntityMetadataPath(worldDir, item.name)
      if (!(await pathExists(file))) continue
      const entity = await readMigratedJson(file, entityMigrations, EntitySchema)
      if (entity.worldId !== worldId || entity.id !== item.name) throw new Error('O diretório contém um registro de outro mundo.')
      if (represented.has(entity.id)) continue
      const date = entity.type === 'event' ? initialEventAppearanceDate(world.calendar, entity.properties.eventDate) : null
      added.push({ id: randomUUID(), entityId: entity.id, title: null, note: null, date, minimumScale: null, showCover: true })
    }
    if (added.length === 0) return { timeline: current, added: 0 }
    const next = TimelineDataSchema.parse({ ...current, updatedAt: nextUpdatedAt(current), appearances: [...current.appearances, ...added] })
    await atomicWriteJson(getTimelineDataPath(worldDir, timelineId), next)
    return { timeline: next, added: added.length }
  })
}

export async function removeAppearance(worldDir: string, worldId: string, timelineId: string, appearanceId: string, expectedUpdatedAt: string): Promise<{ timeline: TimelineData; removed: TimelineAppearance; index: number }> {
  return withWorldWriteLock(worldDir, async () => {
    if (!z.uuid().safeParse(appearanceId).success) throw new Error('Identificador de aparição inválido.')
    const world = await readWorldByDir(worldDir)
    if (world.id !== worldId) throw new Error('A Linha do Tempo pertence a outro mundo.')
    const current = await readData(worldDir, worldId, timelineId)
    if (current.updatedAt !== expectedUpdatedAt) throw new Error('A linha mudou desde que foi aberta. Atualize a página antes de remover.')
    const index = current.appearances.findIndex((appearance) => appearance.id === appearanceId)
    if (index < 0) throw new Error('A aparição não existe nesta linha.')
    const removed = current.appearances[index]
    const next = TimelineDataSchema.parse({ ...current, updatedAt: nextUpdatedAt(current),
      appearances: current.appearances.filter((appearance) => appearance.id !== appearanceId) })
    await atomicWriteJson(getTimelineDataPath(worldDir, timelineId), next)
    return { timeline: next, removed, index }
  })
}

export async function restoreAppearance(worldDir: string, worldId: string, timelineId: string, input: TimelineAppearance, index: number, expectedUpdatedAt: string): Promise<TimelineData> {
  return withWorldWriteLock(worldDir, async () => {
    const world = await readWorldByDir(worldDir)
    if (world.id !== worldId) throw new Error('A Linha do Tempo pertence a outro mundo.')
    const current = await readData(worldDir, worldId, timelineId)
    if (current.updatedAt !== expectedUpdatedAt) throw new Error('A linha mudou desde a remoção. Atualize a página antes de desfazer.')
    const appearance = TimelineAppearanceSchema.parse(input)
    if (current.appearances.some((item) => item.id === appearance.id)) throw new Error('A aparição já está nesta linha.')
    if (!Number.isInteger(index) || index < 0 || index > current.appearances.length) throw new Error('Posição de restauração inválida.')
    let file = getEntityMetadataPath(worldDir, appearance.entityId)
    if (!(await pathExists(file))) {
      const trashDir = getTrashDir(worldDir)
      const items = await pathExists(trashDir) ? await readdir(trashDir, { withFileTypes: true }) : []
      const trashed = items.find((item) => item.isDirectory() && item.name.startsWith(`entity-${appearance.entityId}-`))
      if (!trashed) throw new Error('O registro não pertence a este mundo.')
      file = path.join(trashDir, trashed.name, 'metadata.json')
    }
    const target = await readMigratedJson(file, entityMigrations, EntitySchema)
    if (target.id !== appearance.entityId || target.worldId !== worldId) throw new Error('O registro pertence a outro mundo.')
    const fields = checkedFields(world, appearance)
    const appearances = [...current.appearances]
    appearances.splice(index, 0, { ...appearance, ...fields })
    const next = TimelineDataSchema.parse({ ...current, updatedAt: nextUpdatedAt(current), appearances })
    await atomicWriteJson(getTimelineDataPath(worldDir, timelineId), next)
    return next
  })
}
