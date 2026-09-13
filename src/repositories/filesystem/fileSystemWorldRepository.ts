import 'server-only'
import { readdir, rename } from 'node:fs/promises'
import path from 'node:path'
import { ContentDocumentSchema, emptyContentDocument, type ContentDocument } from '@/domain/content/contentDocument'
import { EntityPatchSchema, EntitySchema, ENTITY_SCHEMA_VERSION, NewEntityInputSchema, type Entity, type EntityPatch, type NewEntityInput } from '@/domain/entities/entity'
import { NewRelationInputSchema, RelationSchema, type NewRelationInput, type Relation } from '@/domain/relations/relation'
import type { World } from '@/domain/worlds/world'
import { atomicWriteJson, ensureDir, pathExists } from '@/lib/fs/atomicWrite'
import {
  getEntitiesDir,
  getEntityContentPath,
  getEntityDir,
  getEntityMetadataPath,
  getTrashDir,
} from '@/lib/fs/paths'
import { newId } from '@/lib/ids'
import { readMigratedJson } from '@/lib/migrations/registry'
import { slugify } from '@/lib/slugify'
import type { Backlink, EntityListFilter, WorldRepository } from '@/repositories/contracts/worldRepository'
import { contentMigrations, entityMigrations } from '@/repositories/filesystem/migrations'
import { listWorldDirs, readWorldByDir, resolveWorldDir } from '@/repositories/filesystem/worldDirRegistry'

export class ConcurrentModificationError extends Error {
  constructor(entityId: string) {
    super(`Entity ${entityId} was modified since it was last read`)
    this.name = 'ConcurrentModificationError'
  }
}

export class EntityNotFoundError extends Error {
  constructor(entityId: string) {
    super(`Entity not found: ${entityId}`)
    this.name = 'EntityNotFoundError'
  }
}

async function readEntityByDir(worldDir: string, entityId: string): Promise<Entity | null> {
  const metadataPath = getEntityMetadataPath(worldDir, entityId)
  if (!(await pathExists(metadataPath))) return null
  return readMigratedJson(metadataPath, entityMigrations, EntitySchema)
}

async function writeEntity(worldDir: string, entity: Entity): Promise<void> {
  await atomicWriteJson(getEntityMetadataPath(worldDir, entity.id), entity)
}

export class FileSystemWorldRepository implements WorldRepository {
  async listWorlds(): Promise<World[]> {
    const dirs = await listWorldDirs()
    return Promise.all(dirs.map((dir) => readWorldByDir(dir)))
  }

  async getWorld(worldId: string): Promise<World> {
    const worldDir = await resolveWorldDir(worldId)
    return readWorldByDir(worldDir)
  }

  async listEntities(worldId: string, filter?: EntityListFilter): Promise<Entity[]> {
    const worldDir = await resolveWorldDir(worldId)
    const entitiesDir = getEntitiesDir(worldDir)
    if (!(await pathExists(entitiesDir))) return []

    const entries = await readdir(entitiesDir, { withFileTypes: true })
    const entityIds = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)

    const entities = await Promise.all(entityIds.map((id) => readEntityByDir(worldDir, id)))
    return entities
      .filter((entity): entity is Entity => entity !== null)
      .filter((entity) => (filter?.type ? entity.type === filter.type : true))
      .filter((entity) => (filter?.tag ? entity.tags.includes(filter.tag) : true))
  }

  async getEntity(worldId: string, entityId: string): Promise<Entity | null> {
    const worldDir = await resolveWorldDir(worldId)
    return readEntityByDir(worldDir, entityId)
  }

  async createEntity(worldId: string, input: NewEntityInput): Promise<Entity> {
    const parsedInput = NewEntityInputSchema.parse(input)
    const worldDir = await resolveWorldDir(worldId)
    const now = new Date().toISOString()

    const entity = EntitySchema.parse({
      id: newId(),
      worldId,
      type: parsedInput.type,
      title: parsedInput.title,
      slug: slugify(parsedInput.title),
      aliases: parsedInput.aliases,
      tags: parsedInput.tags,
      status: parsedInput.status,
      theme: parsedInput.theme,
      coverAssetId: parsedInput.coverAssetId,
      galleryAssetIds: parsedInput.galleryAssetIds,
      properties: parsedInput.properties,
      relations: [],
      schemaVersion: ENTITY_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    } satisfies Entity)

    await writeEntity(worldDir, entity)
    await atomicWriteJson(getEntityContentPath(worldDir, entity.id), emptyContentDocument())
    return entity
  }

  async updateEntity(worldId: string, entityId: string, patch: EntityPatch): Promise<Entity> {
    const parsedPatch = EntityPatchSchema.parse(patch)
    const worldDir = await resolveWorldDir(worldId)
    const current = await readEntityByDir(worldDir, entityId)
    if (!current) throw new EntityNotFoundError(entityId)

    if (parsedPatch.expectedUpdatedAt && parsedPatch.expectedUpdatedAt !== current.updatedAt) {
      throw new ConcurrentModificationError(entityId)
    }

    const next: Entity = EntitySchema.parse({
      ...current,
      ...(parsedPatch.title !== undefined ? { title: parsedPatch.title, slug: slugify(parsedPatch.title) } : {}),
      ...(parsedPatch.aliases !== undefined ? { aliases: parsedPatch.aliases } : {}),
      ...(parsedPatch.tags !== undefined ? { tags: parsedPatch.tags } : {}),
      ...(parsedPatch.status !== undefined ? { status: parsedPatch.status } : {}),
      ...(parsedPatch.theme !== undefined ? { theme: parsedPatch.theme } : {}),
      ...(parsedPatch.coverAssetId !== undefined ? { coverAssetId: parsedPatch.coverAssetId ?? undefined } : {}),
      ...(parsedPatch.galleryAssetIds !== undefined ? { galleryAssetIds: parsedPatch.galleryAssetIds } : {}),
      ...(parsedPatch.properties !== undefined ? { properties: parsedPatch.properties } : {}),
      updatedAt: new Date().toISOString(),
    })

    await writeEntity(worldDir, next)
    return next
  }

  async deleteEntity(worldId: string, entityId: string): Promise<void> {
    const worldDir = await resolveWorldDir(worldId)
    const entityDir = getEntityDir(worldDir, entityId)
    if (!(await pathExists(entityDir))) throw new EntityNotFoundError(entityId)

    const trashDir = getTrashDir(worldDir)
    await ensureDir(trashDir)
    await rename(entityDir, path.join(trashDir, `entity-${entityId}-${Date.now()}`))
  }

  async getContent(worldId: string, entityId: string): Promise<ContentDocument> {
    const worldDir = await resolveWorldDir(worldId)
    const contentPath = getEntityContentPath(worldDir, entityId)
    if (!(await pathExists(contentPath))) return emptyContentDocument()
    return readMigratedJson(contentPath, contentMigrations, ContentDocumentSchema)
  }

  async saveContent(worldId: string, entityId: string, doc: ContentDocument): Promise<void> {
    const parsed = ContentDocumentSchema.parse(doc)
    const worldDir = await resolveWorldDir(worldId)
    await atomicWriteJson(getEntityContentPath(worldDir, entityId), parsed)
  }

  async addRelation(worldId: string, sourceId: string, relationInput: NewRelationInput): Promise<Relation> {
    const parsedInput = NewRelationInputSchema.parse(relationInput)
    const worldDir = await resolveWorldDir(worldId)
    const source = await readEntityByDir(worldDir, sourceId)
    if (!source) throw new EntityNotFoundError(sourceId)

    const relation = RelationSchema.parse({ ...parsedInput, id: newId() })
    const next: Entity = EntitySchema.parse({
      ...source,
      relations: [...source.relations, relation],
      updatedAt: new Date().toISOString(),
    })

    await writeEntity(worldDir, next)
    return relation
  }

  async removeRelation(worldId: string, sourceId: string, relationId: string): Promise<void> {
    const worldDir = await resolveWorldDir(worldId)
    const source = await readEntityByDir(worldDir, sourceId)
    if (!source) throw new EntityNotFoundError(sourceId)

    const next: Entity = EntitySchema.parse({
      ...source,
      relations: source.relations.filter((relation) => relation.id !== relationId),
      updatedAt: new Date().toISOString(),
    })

    await writeEntity(worldDir, next)
  }

  async getBacklinks(worldId: string, entityId: string): Promise<Backlink[]> {
    const entities = await this.listEntities(worldId)
    const backlinks: Backlink[] = []
    for (const entity of entities) {
      for (const relation of entity.relations) {
        if (relation.targetId === entityId) backlinks.push({ entity, relation })
      }
    }
    return backlinks
  }
}
