import 'server-only'
import { readdir, stat } from 'node:fs/promises'
import type { AgendaEvent } from '@/domain/worlds/calendar-agenda'
import { getEntitiesDir, getEntityMetadataPath } from '@/lib/fs/paths'
import type { Entity } from '@/domain/entities/entity'

type CachedEntry = { signature: string; event: AgendaEvent | null }
const recentWorlds = new Map<string, Map<string, CachedEntry>>()
const MAX_CACHED_WORLDS = 4
const BATCH_SIZE = 32

function missing(error: unknown) {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

/** Reconcile a derived in-memory projection against the source files on each agenda read. */
export async function listCalendarAgenda(
  worldDir: string,
  readEntity: (id: string) => Promise<Entity | null>,
): Promise<AgendaEvent[]> {
  const root = getEntitiesDir(worldDir)
  const entries = (await readdir(root, { withFileTypes: true }).catch((error: unknown) => {
    if (missing(error)) return []
    throw error
  })).filter((entry) => entry.isDirectory())
  const previous = recentWorlds.get(root)
  const current = new Map<string, CachedEntry>()
  const events: AgendaEvent[] = []

  for (let offset = 0; offset < entries.length; offset += BATCH_SIZE) {
    const batch = await Promise.all(entries.slice(offset, offset + BATCH_SIZE).map(async ({ name }) => {
      const metadata = await stat(getEntityMetadataPath(worldDir, name), { bigint: true }).catch((error: unknown) => {
        if (missing(error)) return null
        throw error
      })
      if (!metadata) return null
      const signature = `${metadata.ino}:${metadata.size}:${metadata.mtimeNs}:${metadata.ctimeNs}`
      const cached = previous?.get(name)
      if (cached?.signature === signature) return [name, cached] as const
      const entity = await readEntity(name).catch((error: unknown) => {
        if (missing(error)) return null
        throw error
      })
      if (!entity) return null
      const event = entity.type === 'event' ? { id: entity.id, title: entity.title, date: entity.properties.eventDate } : null
      return [name, { signature, event }] as const
    }))
    for (const item of batch) {
      if (!item) continue
      const [name, entry] = item
      current.set(name, entry)
      if (entry.event) events.push(entry.event)
    }
  }

  recentWorlds.delete(root)
  recentWorlds.set(root, current)
  if (recentWorlds.size > MAX_CACHED_WORLDS) {
    const oldest = recentWorlds.keys().next()
    if (!oldest.done) recentWorlds.delete(oldest.value)
  }
  return events
}
