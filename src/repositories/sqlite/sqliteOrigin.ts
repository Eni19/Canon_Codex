import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import type { ContentDocument } from '@/domain/content/contentDocument'
import { NewEntityInputSchema, type Entity, type NewEntityInput } from '@/domain/entities/entity'
import { validateCalendarDateValue } from '@/domain/worlds/calendar-date'
import { planOriginEvent, type OriginEntry } from '@/domain/worlds/originEventPlan'
import { WorldSchema, type World } from '@/domain/worlds/world'
import type { OriginEventPreview } from '@/repositories/contracts/worldRepository'
import type { SqliteDatabase } from './database'
import type { SqliteRecords } from './sqliteRecords'
import type { SqliteTimelines } from './sqliteTimelines'

export class SqliteOrigin {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly records: SqliteRecords,
    private readonly timelines: SqliteTimelines,
    private readonly readWorld: (id: string) => World,
    private readonly saveWorld: (world: World) => World,
    private readonly reconcile: (worldId: string) => void,
  ) {}

  async createOriginEvent(worldId: string, input: NewEntityInput, content?: ContentDocument): Promise<Entity> {
    const parsed = NewEntityInputSchema.parse(input)
    if (parsed.type !== 'event') throw new Error('A origem precisa ser um Evento.')
    return this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      this.reconcile(worldId)
      const world = this.readWorld(worldId)
      if (world.originEventId) throw new Error('Este mundo já possui um Evento de origem. Substitua-o nas configurações do calendário.')
      const date = validateCalendarDateValue(world.calendar, parsed.properties.eventDate)
      if (!date.success || date.data.end || date.data.start.month === undefined || date.data.start.day === undefined || date.data.start.approximate) {
        throw new Error('Informe uma data exata, completa e sem intervalo para o Evento de origem.')
      }
      const originDate = { ...date.data.start, year: 0 }
      const entity = this.records.create(worldId, {
        ...parsed,
        properties: { ...parsed.properties, eventDate: { start: originDate } },
      }, content)
      this.saveWorld(WorldSchema.parse({
        ...world,
        originEventId: entity.id,
        calendar: {
          ...world.calendar,
          origin: { ...world.calendar.origin, month: originDate.month, day: originDate.day },
        },
        updatedAt: entity.updatedAt,
      }))
      return entity
    })
  }

  async previewOriginEvent(worldId: string, eventId: string): Promise<OriginEventPreview> {
    return this.db.read(() => {
      this.db.requireActiveWorld(worldId)
      const world = this.readWorld(worldId)
      return this.plan(world, eventId).preview
    })
  }

  async replaceOriginEvent(worldId: string, eventId: string, fingerprint: string): Promise<World> {
    return this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      const world = this.readWorld(worldId)
      const { entries, preview, changes, nextWorld } = this.plan(world, eventId)
      if (preview.fingerprint !== fingerprint) throw new Error('O mundo mudou desde a prévia. Atualize a página e confirme novamente.')
      for (const { entity, timeline } of changes) {
        if (entity) this.records.update(entity)
        if (timeline) this.timelines.persist(timeline)
      }
      const result = this.saveWorld(nextWorld)
      const history = {
        worldId,
        eventId,
        state: 'completed',
        originalWorld: world,
        changes: changes.map(({ index, entity, timeline }) => ({
          entity: entity ? entries[index].entity : undefined,
          timeline: timeline ? entries[index].timeline : undefined,
        })),
      }
      this.db.connection.prepare(`
        INSERT INTO histories (world_id, kind, id, document) VALUES (?, 'origin', ?, ?)
      `).run(worldId, randomUUID(), JSON.stringify(history))
      return result
    })
  }

  async getOriginEvent(worldId: string): Promise<{ id: string; title: string; trashed: boolean } | null> {
    return this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      this.reconcile(worldId)
      const world = this.readWorld(worldId)
      if (!world.originEventId) return null
      const active = this.records.get(worldId, world.originEventId)
      if (active) return { id: active.id, title: active.title, trashed: false }
      const trashed = this.records.get(worldId, world.originEventId, true)
      if (!trashed) return null
      if (trashed.id !== world.originEventId || trashed.worldId !== world.id || trashed.type !== 'event') {
        throw new Error('O Evento de origem na lixeira é inválido.')
      }
      return { id: trashed.id, title: trashed.title, trashed: true }
    })
  }

  private plan(world: World, eventId: string) {
    const entries: OriginEntry[] = [
      ...this.records.list(world.id).map((entity) => ({ entity, active: true })),
      ...this.records.list(world.id, undefined, true).map((entity) => ({ entity, active: false })),
    ]
    for (const entry of entries) {
      if (entry.entity.type === 'timeline') entry.timeline = this.timelines.read(world.id, entry.entity.id)
    }
    const plan = planOriginEvent(world, entries, eventId)
    const fingerprint = createHash('sha256').update(JSON.stringify({ world, eventId, entries })).digest('hex')
    return { ...plan, entries, preview: { ...plan.preview, fingerprint } }
  }
}
