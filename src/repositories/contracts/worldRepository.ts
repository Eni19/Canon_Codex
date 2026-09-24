import type { ContentDocument } from '@/domain/content/contentDocument'
import type { Entity, EntityPatch, NewEntityInput } from '@/domain/entities/entity'
import type { NewRelationInput, Relation } from '@/domain/relations/relation'
import type { World } from '@/domain/worlds/world'
import type { Calendar } from '@/domain/worlds/calendar'

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

  listEntities(worldId: string, filter?: EntityListFilter): Promise<Entity[]>
  getEntity(worldId: string, entityId: string): Promise<Entity | null>
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
