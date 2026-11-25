import 'server-only'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Entity } from '@/domain/entities/entity'
import {
  emptyTimelineData,
  initialEventAppearanceDate,
  TIMELINE_SCHEMA_VERSION,
  TimelineAppearanceFieldsSchema,
  TimelineAppearanceSchema,
  TimelineDataSchema,
  type TimelineAppearance,
  type TimelineAppearanceFields,
  type TimelineData,
} from '@/domain/timelines/timeline'
import { validateCalendarDateValue, type CalendarDateValue } from '@/domain/worlds/calendar-date'
import type { World } from '@/domain/worlds/world'
import type { SqliteDatabase } from './database'
import type { SqliteRecords } from './sqliteRecords'

const uuidSchema = z.uuid()
const eventTitleSchema = z.string().trim().min(1).max(200)

function appearanceFields(date: CalendarDateValue | null): TimelineAppearanceFields {
  return { title: null, note: null, date, minimumScale: null, showCover: true }
}

function checkedFields(world: World, fields: TimelineAppearanceFields): TimelineAppearanceFields {
  const parsed = TimelineAppearanceFieldsSchema.parse(fields)
  if (!parsed.date) return parsed
  const valid = validateCalendarDateValue(world.calendar, parsed.date)
  if (!valid.success) throw new Error(valid.error)
  return { ...parsed, date: valid.data }
}

export class SqliteTimelines {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly records: SqliteRecords,
    private readonly readWorld: (worldId: string) => World,
    private readonly reconcile: (worldId: string) => void,
  ) {}

  read(worldId: string, timelineId: string): TimelineData {
    return this.db.read(() => {
      const row = this.db.connection.prepare('SELECT updated_at FROM timelines WHERE world_id = ? AND id = ?').get(worldId, timelineId)
      if (!row) return emptyTimelineData(worldId, timelineId)
      const appearances = this.db.connection.prepare(
        'SELECT document FROM timeline_appearances WHERE world_id = ? AND timeline_id = ? ORDER BY position',
      ).all(worldId, timelineId).map(({ document }) => JSON.parse(document as string))
      return TimelineDataSchema.parse({
        schemaVersion: TIMELINE_SCHEMA_VERSION,
        worldId,
        timelineId,
        updatedAt: row.updated_at,
        appearances,
      })
    })
  }

  persist(data: TimelineData): TimelineData {
    const { worldId, timelineId, updatedAt, appearances } = TimelineDataSchema.parse(data)
    return this.db.write(() => {
      this.db.connection.prepare(`
        INSERT INTO timelines (world_id, id, updated_at) VALUES (?, ?, ?)
        ON CONFLICT (world_id, id) DO UPDATE SET updated_at = excluded.updated_at
      `).run(worldId, timelineId, updatedAt)
      this.db.connection.prepare('DELETE FROM timeline_appearances WHERE world_id = ? AND timeline_id = ?').run(worldId, timelineId)
      const insert = this.db.connection.prepare(`
        INSERT INTO timeline_appearances (world_id, timeline_id, id, entity_id, position, document)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      appearances.forEach((appearance, position) => {
        insert.run(worldId, timelineId, appearance.id, appearance.entityId, position, JSON.stringify(appearance))
      })
      return { schemaVersion: TIMELINE_SCHEMA_VERSION, worldId, timelineId, updatedAt, appearances }
    })
  }

  async getTimeline(worldId: string, timelineId: string): Promise<TimelineData> {
    return this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      this.requireTimeline(worldId, timelineId)
      this.reconcile(worldId)
      return this.read(worldId, timelineId)
    })
  }

  async addTimelineAppearance(
    worldId: string,
    timelineId: string,
    entityId: string,
    date: CalendarDateValue | null,
    expectedUpdatedAt: string,
    presentation: Partial<Omit<TimelineAppearanceFields, 'date'>> = {},
  ): Promise<TimelineData> {
    return this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      if (!uuidSchema.safeParse(entityId).success) throw new Error('Identificador de registro inválido.')
      const world = this.readWorld(worldId)
      const current = this.requireCurrent(worldId, timelineId, expectedUpdatedAt, 'A linha mudou desde que foi aberta. Atualize a página antes de incluir a aparição.')
      if (!this.records.get(worldId, entityId)) throw new Error('O registro não está ativo neste mundo.')
      const fields = checkedFields(world, { ...appearanceFields(date), ...presentation })
      return this.saveAppearances(current, [...current.appearances, { id: randomUUID(), entityId, ...fields }])
    })
  }

  async updateTimelineAppearance(
    worldId: string,
    timelineId: string,
    appearanceId: string,
    fields: TimelineAppearanceFields,
    expectedUpdatedAt: string,
  ): Promise<TimelineData> {
    return this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      if (!uuidSchema.safeParse(appearanceId).success) throw new Error('Identificador de aparição inválido.')
      const world = this.readWorld(worldId)
      const current = this.requireCurrent(worldId, timelineId, expectedUpdatedAt, 'A linha mudou desde que foi aberta. Atualize a página antes de editar.')
      if (!current.appearances.some((appearance) => appearance.id === appearanceId)) throw new Error('A aparição não existe nesta linha.')
      const nextFields = checkedFields(world, fields)
      return this.saveAppearances(current, current.appearances.map((appearance) => (
        appearance.id === appearanceId ? { ...appearance, ...nextFields } : appearance
      )))
    })
  }

  async createTimelineEvent(
    worldId: string,
    timelineId: string,
    title: string,
    date: CalendarDateValue,
    expectedUpdatedAt: string,
  ): Promise<{ entity: Entity; timeline: TimelineData }> {
    return this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      const world = this.readWorld(worldId)
      const current = this.requireCurrent(worldId, timelineId, expectedUpdatedAt, 'A linha mudou desde que foi aberta. Atualize a página antes de criar o Evento.')
      if (!world.entityTypes.some((type) => type.id === 'event')) throw new Error('Este mundo não possui o tipo Evento.')
      const eventTitle = eventTitleSchema.parse(title)
      const fields = checkedFields(world, appearanceFields(date))
      if (!fields.date) throw new Error('Informe a data do Evento.')
      const entity = this.records.create(worldId, { type: 'event', title: eventTitle, properties: { eventDate: fields.date } })
      const timeline = this.saveAppearances(current, [...current.appearances, { id: randomUUID(), entityId: entity.id, ...fields }])
      return { entity, timeline }
    })
  }

  async addAllTimelineAppearances(
    worldId: string,
    timelineId: string,
    expectedUpdatedAt: string,
  ): Promise<{ timeline: TimelineData; added: number }> {
    return this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      const world = this.readWorld(worldId)
      const current = this.requireCurrent(worldId, timelineId, expectedUpdatedAt, 'A linha mudou desde que foi aberta. Atualize a página antes de adicionar todos.')
      const represented = new Set(current.appearances.map((appearance) => appearance.entityId))
      const added = this.records.list(worldId)
        .filter((entity) => !represented.has(entity.id))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((entity) => {
          const date = entity.type === 'event' ? initialEventAppearanceDate(world.calendar, entity.properties.eventDate) : null
          return { id: randomUUID(), entityId: entity.id, ...appearanceFields(date) }
        })
      if (added.length === 0) return { timeline: current, added: 0 }
      return { timeline: this.saveAppearances(current, [...current.appearances, ...added]), added: added.length }
    })
  }

  async removeTimelineAppearance(
    worldId: string,
    timelineId: string,
    appearanceId: string,
    expectedUpdatedAt: string,
  ): Promise<{ timeline: TimelineData; removed: TimelineAppearance; index: number }> {
    return this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      if (!uuidSchema.safeParse(appearanceId).success) throw new Error('Identificador de aparição inválido.')
      const current = this.requireCurrent(worldId, timelineId, expectedUpdatedAt, 'A linha mudou desde que foi aberta. Atualize a página antes de remover.')
      const appearances = [...current.appearances]
      const index = appearances.findIndex((appearance) => appearance.id === appearanceId)
      if (index < 0) throw new Error('A aparição não existe nesta linha.')
      const [removed] = appearances.splice(index, 1)
      return { timeline: this.saveAppearances(current, appearances), removed, index }
    })
  }

  async restoreTimelineAppearance(
    worldId: string,
    timelineId: string,
    input: TimelineAppearance,
    index: number,
    expectedUpdatedAt: string,
  ): Promise<TimelineData> {
    return this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      const world = this.readWorld(worldId)
      const current = this.requireCurrent(worldId, timelineId, expectedUpdatedAt, 'A linha mudou desde a remoção. Atualize a página antes de desfazer.')
      const appearance = TimelineAppearanceSchema.parse(input)
      if (current.appearances.some((item) => item.id === appearance.id)) throw new Error('A aparição já está nesta linha.')
      if (!Number.isInteger(index) || index < 0 || index > current.appearances.length) throw new Error('Posição de restauração inválida.')
      if (!this.records.get(worldId, appearance.entityId, true)) throw new Error('O registro não pertence a este mundo.')
      const fields = checkedFields(world, appearance)
      const appearances = [...current.appearances]
      appearances.splice(index, 0, { ...appearance, ...fields })
      return this.saveAppearances(current, appearances)
    })
  }

  private requireTimeline(worldId: string, timelineId: string): void {
    if (!uuidSchema.safeParse(timelineId).success) throw new Error('Identificador de Linha do Tempo inválido.')
    const entity = this.records.get(worldId, timelineId)
    if (!entity) throw new Error('A Linha do Tempo não está ativa neste mundo.')
    if (entity.type !== 'timeline') throw new Error('O registro informado não é uma Linha do Tempo deste mundo.')
  }

  private requireCurrent(worldId: string, timelineId: string, expectedUpdatedAt: string, conflict: string): TimelineData {
    this.requireTimeline(worldId, timelineId)
    const current = this.read(worldId, timelineId)
    if (current.updatedAt !== expectedUpdatedAt) throw new Error(conflict)
    return current
  }

  private saveAppearances(current: TimelineData, appearances: TimelineAppearance[]): TimelineData {
    const updatedAt = new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString()
    return this.persist({ ...current, updatedAt, appearances })
  }
}
