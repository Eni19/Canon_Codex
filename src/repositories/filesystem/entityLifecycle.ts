import 'server-only'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { EntitySchema } from '@/domain/entities/entity'
import { parseTimelineData, type TimelineData } from '@/domain/timelines/timeline'
import { WorldSchema } from '@/domain/worlds/world'
import { atomicWriteJson } from '@/lib/fs/atomicWrite'
import { getEntitiesDir, getTrashDir, getWorldJsonPath } from '@/lib/fs/paths'
import { readMigratedJson } from '@/lib/migrations/registry'
import { entityMigrations } from './migrations'
import { readWorldByDir } from './worldDirRegistry'

async function entries(directory: string) {
  try { return await readdir(directory, { withFileTypes: true }) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function exists(file: string): Promise<boolean> {
  try { await stat(file); return true }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

/** Caller holds the world lock. Validate the entire inventory before removing any references. */
export async function reconcileEntityLifecycle(worldDir: string, worldId: string): Promise<void> {
  const world = await readWorldByDir(worldDir)
  if (world.id !== worldId) throw new Error('O mundo informado não corresponde ao diretório.')
  const records = new Map<string, string>()
  const timelines: { file: string; id: string }[] = []
  for (const [directory, trashed] of [[getEntitiesDir(worldDir), false], [getTrashDir(worldDir), true]] as const) {
    for (const entry of await entries(directory)) {
      if (!entry.isDirectory() || (trashed && !entry.name.startsWith('entity-'))) continue
      const folder = path.join(directory, entry.name)
      // A directory with missing/corrupt metadata is an error, never proof of permanent absence.
      const entity = await readMigratedJson(path.join(folder, 'metadata.json'), entityMigrations, EntitySchema)
      if (entity.worldId !== worldId || (trashed ? !entry.name.startsWith(`entity-${entity.id}-`) : entry.name !== entity.id)) {
        throw new Error('O diretório contém um registro inválido ou de outro mundo.')
      }
      records.set(entity.id, entity.type)
      if (entity.type === 'timeline') timelines.push({ file: path.join(folder, 'timeline.json'), id: entity.id })
    }
  }
  const changes: { file: string; data: TimelineData }[] = []
  for (const { file, id } of timelines) {
    if (!(await exists(file))) continue
    const data = parseTimelineData(JSON.parse(await readFile(file, 'utf8')))
    if (data.worldId !== worldId || data.timelineId !== id) throw new Error('As aparições pertencem a outra linha ou mundo.')
    const appearances = data.appearances.filter((appearance) => records.has(appearance.entityId))
    if (appearances.length !== data.appearances.length) changes.push({ file, data: {
      ...data, appearances, updatedAt: new Date(Math.max(Date.now(), Date.parse(data.updatedAt) + 1)).toISOString(),
    } })
  }
  if (world.originEventId && records.has(world.originEventId) && records.get(world.originEventId) !== 'event') {
    throw new Error('O registro de origem não é um Evento.')
  }
  // Per-file atomic writes; retrying after an interrupted pass is idempotent.
  for (const change of changes) await atomicWriteJson(change.file, change.data)
  if (world.originEventId && !records.has(world.originEventId)) {
    await atomicWriteJson(getWorldJsonPath(worldDir), WorldSchema.parse({
      ...world, originEventId: undefined, updatedAt: new Date(Math.max(Date.now(), Date.parse(world.updatedAt) + 1)).toISOString(),
    }))
  }
}
