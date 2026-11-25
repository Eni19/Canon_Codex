import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { EntitySchema, type Entity } from '@/domain/entities/entity'
import { parseTimelineData, type TimelineData } from '@/domain/timelines/timeline'
import { planOriginEvent } from '@/domain/worlds/originEventPlan'
import type { World } from '@/domain/worlds/world'
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

function build(worldDir: string, world: World, entries: Entry[], eventId: string): { preview: OriginEventPreview; changes: Change[]; nextWorld: World } {
  const activeDir = getEntitiesDir(worldDir) + path.sep
  const plan = planOriginEvent(world, entries.map((entry) => ({
    active: entry.file.startsWith(activeDir),
    entity: entry.entity,
    timeline: entry.timeline?.data,
  })), eventId)
  const changes: Change[] = []
  for (const { index, entity, timeline } of plan.changes) {
    const entry = entries[index]
    if (entity) changes.push({ file: entry.file, before: entry.text, after: JSON.stringify(entity, null, 2) + '\n' })
    if (timeline && entry.timeline) {
      changes.push({ file: entry.timeline.file, before: entry.timeline.text, after: JSON.stringify(timeline, null, 2) + '\n' })
    }
  }
  const fingerprint = createHash('sha256').update(JSON.stringify({ world, entries: entries.map(({ file, text, timeline }) => [file, text, timeline?.text]) })).digest('hex')
  return { preview: { ...plan.preview, fingerprint }, changes, nextWorld: plan.nextWorld }
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
