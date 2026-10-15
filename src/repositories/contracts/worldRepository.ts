import type { ContentDocument } from '@/domain/content/contentDocument'
import type { Entity, EntityPatch, NewEntityInput } from '@/domain/entities/entity'
import type { NewRelationInput, Relation } from '@/domain/relations/relation'
import type { World } from '@/domain/worlds/world'
import type { Calendar } from '@/domain/worlds/calendar'
import type { CalendarDateValue } from '@/domain/worlds/calendar-date'
import type { TimelineAppearance, TimelineAppearanceFields, TimelineData } from '@/domain/timelines/timeline'
import type { TimelineScale } from '@/domain/timelines/timelineScale'
import type { DateMigrationPreview } from '@/domain/worlds/dateMigration'

export interface EntityListFilter {
  type?: string
  tag?: string
}

export interface Backlink {
  entity: Entity
  relation: Relation
}

/**
 * The only interface the rest of the app uses to read/write worlds, entities, content, and
 * relations. See ADR-001. `worldId` is always the world's stable `World.id`, never a directory
 * name or slug — implementations resolve that internally.
 */
export interface WorldRepository {
  listWorlds(): Promise<World[]>
  getWorld(worldId: string): Promise<World>
  updateCalendar(worldId: string, calendar: Calendar): Promise<World>
  updateTimelineScaleDefaults(worldId: string, defaults: Record<string, TimelineScale>): Promise<World>
  createOriginEvent(worldId: string, input: NewEntityInput): Promise<Entity>
  previewOriginEvent(worldId: string, eventId: string): Promise<OriginEventPreview>
  replaceOriginEvent(worldId: string, eventId: string, fingerprint: string): Promise<World>
  previewDateMigration(worldId: string): Promise<DateMigrationPreview>
  startDateMigration(worldId: string, fingerprint: string): Promise<string>
  recoverDateMigration(worldId: string, backupId: string, restore: boolean): Promise<void>

  listEntities(worldId: string, filter?: EntityListFilter): Promise<Entity[]>
  /** Trashed records retain metadata; failed reads reject instead of implying permanent absence. */
  listTrashedEntities(worldId: string): Promise<Entity[]>
  getEntity(worldId: string, entityId: string): Promise<Entity | null>
  /** Reconciles permanent absence across the world's timelines and origin link before returning. */
  getTimeline(worldId: string, timelineId: string): Promise<TimelineData>
  addTimelineAppearance(worldId: string, timelineId: string, entityId: string, date: CalendarDateValue | null, expectedUpdatedAt: string, presentation?: Partial<Omit<TimelineAppearanceFields, 'date'>>): Promise<TimelineData>
  updateTimelineAppearance(worldId: string, timelineId: string, appearanceId: string, fields: TimelineAppearanceFields, expectedUpdatedAt: string): Promise<TimelineData>
  createTimelineEvent(worldId: string, timelineId: string, title: string, date: CalendarDateValue, expectedUpdatedAt: string): Promise<{ entity: Entity; timeline: TimelineData }>
  addAllTimelineAppearances(worldId: string, timelineId: string, expectedUpdatedAt: string): Promise<{ timeline: TimelineData; added: number }>
  removeTimelineAppearance(worldId: string, timelineId: string, appearanceId: string, expectedUpdatedAt: string): Promise<{ timeline: TimelineData; removed: TimelineAppearance; index: number }>
  restoreTimelineAppearance(worldId: string, timelineId: string, appearance: TimelineAppearance, index: number, expectedUpdatedAt: string): Promise<TimelineData>
  getOriginEvent(worldId: string): Promise<{ id: string; title: string; trashed: boolean } | null>
  createEntity(worldId: string, input: NewEntityInput): Promise<Entity>
  updateEntity(worldId: string, entityId: string, patch: EntityPatch): Promise<Entity>
  /** Soft-delete: moves the entity's folder into `trash/`. */
  deleteEntity(worldId: string, entityId: string): Promise<void>

  getContent(worldId: string, entityId: string): Promise<ContentDocument>
  saveContent(worldId: string, entityId: string, doc: ContentDocument): Promise<void>

  addRelation(worldId: string, sourceId: string, relation: NewRelationInput): Promise<Relation>
  removeRelation(worldId: string, sourceId: string, relationId: string): Promise<void>
  /** Derived data: computed by scanning every entity's `relations` array for this target. */
  getBacklinks(worldId: string, entityId: string): Promise<Backlink[]>
}

export interface OriginEventPreview {
  fingerprint: string
  eventId: string
  eventTitle: string
  shiftDays: number
  affectedEntities: number
  affectedDates: number
  precisionChanges: number
  examples: { title: string; field: string; before: string; after: string; precisionChanged: boolean }[]
}
