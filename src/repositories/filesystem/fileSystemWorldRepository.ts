import 'server-only'
import { readFile, readdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { ContentDocumentSchema, emptyContentDocument, type ContentDocument } from '@/domain/content/contentDocument'
import { EntityPatchSchema, EntitySchema, ENTITY_SCHEMA_VERSION, NewEntityInputSchema, type Entity, type EntityPatch, type NewEntityInput } from '@/domain/entities/entity'
import { NewRelationInputSchema, RelationSchema, type NewRelationInput, type Relation } from '@/domain/relations/relation'
import type { World } from '@/domain/worlds/world'
import { CalendarSchema, changesCalendarStructure } from '@/domain/worlds/calendar'
import { WorldSchema } from '@/domain/worlds/world'
import { atomicWriteJson, ensureDir, pathExists } from '@/lib/fs/atomicWrite'
import {
  getEntitiesDir,
  getEntityContentPath,
  getEntityDir,
  getEntityMetadataPath,
  getWorldJsonPath,
  getTrashDir,
} from '@/lib/fs/paths'
import { newId } from '@/lib/ids'
import { readMigratedJson } from '@/lib/migrations/registry'
import { slugify } from '@/lib/slugify'
import type { Backlink, EntityListFilter, OriginEventPreview, WorldRepository } from '@/repositories/contracts/worldRepository'
import { contentMigrations, entityMigrations } from '@/repositories/filesystem/migrations'
import { listWorldDirs, readWorldByDir, resolveWorldDir } from '@/repositories/filesystem/worldDirRegistry'
import { previewDateMigration, recoverDateMigration, startDateMigration } from './dateMigration'
import type { DateMigrationPreview } from '@/domain/worlds/dateMigration'
import { withWorldWriteLock } from './worldWriteLock'
import { previewOriginEvent, replaceOriginEvent } from './originEvent'
import { validateCalendarDateValue } from '@/domain/worlds/calendar-date'
import type { CalendarDateValue } from '@/domain/worlds/calendar-date'
import { parseTimelineData, type TimelineAppearance, type TimelineAppearanceFields, type TimelineData } from '@/domain/timelines/timeline'
import { TimelineScaleSchema, type TimelineScale } from '@/domain/timelines/timelineScale'
import { addAllAppearances, addAppearance, createQuickEvent, getTimelineData, removeAppearance, restoreAppearance, updateAppearance } from './timelineData'
import { buildNewEntity, writeInitialEntityFiles } from './entityCreation'
import { reconcileEntityLifecycle } from './entityLifecycle'

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

async function listEntitiesByDir(worldDir: string, filter?: EntityListFilter): Promise<Entity[]> {
  const entitiesDir = getEntitiesDir(worldDir)
  if (!(await pathExists(entitiesDir))) return []
  const entries = await readdir(entitiesDir, { withFileTypes: true })
  const entities = await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => readEntityByDir(worldDir, entry.name)))
  return entities
    .filter((entity): entity is Entity => entity !== null)
    .filter((entity) => (filter?.type ? entity.type === filter.type : true))
    .filter((entity) => (filter?.tag ? entity.tags.includes(filter.tag) : true))
}

async function listTrashedEntitiesByDir(worldDir: string, worldId: string): Promise<Entity[]> {
  const trashDir = getTrashDir(worldDir)
  const entries = await readdir(trashDir, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  const entities = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('entity-'))
    .map((entry) => readMigratedJson(path.join(trashDir, entry.name, 'metadata.json'), entityMigrations, EntitySchema)))
  for (const entity of entities) {
    if (entity.worldId !== worldId) throw new Error('A lixeira contém um registro de outro mundo.')
  }
  return entities
}

export class FileSystemWorldRepository implements WorldRepository {
  async getTimeline(worldId: string, timelineId: string): Promise<TimelineData> {
    const worldDir = await resolveWorldDir(worldId)
    return getTimelineData(worldDir, worldId, timelineId)
  }

  async addTimelineAppearance(worldId: string, timelineId: string, entityId: string, date: CalendarDateValue | null, expectedUpdatedAt: string, presentation?: Partial<Omit<TimelineAppearanceFields, 'date'>>): Promise<TimelineData> {
    const worldDir = await resolveWorldDir(worldId)
    return addAppearance(worldDir, worldId, timelineId, entityId, date, expectedUpdatedAt, presentation)
  }

  async updateTimelineAppearance(worldId: string, timelineId: string, appearanceId: string, fields: TimelineAppearanceFields, expectedUpdatedAt: string): Promise<TimelineData> {
    const worldDir = await resolveWorldDir(worldId)
    return updateAppearance(worldDir, worldId, timelineId, appearanceId, fields, expectedUpdatedAt)
  }

  async createTimelineEvent(worldId: string, timelineId: string, title: string, date: CalendarDateValue, expectedUpdatedAt: string): Promise<{ entity: Entity; timeline: TimelineData }> {
    const worldDir = await resolveWorldDir(worldId)
    return createQuickEvent(worldDir, worldId, timelineId, title, date, expectedUpdatedAt)
  }

  async addAllTimelineAppearances(worldId: string, timelineId: string, expectedUpdatedAt: string): Promise<{ timeline: TimelineData; added: number }> {
    const worldDir = await resolveWorldDir(worldId)
    return addAllAppearances(worldDir, worldId, timelineId, expectedUpdatedAt)
  }

  async removeTimelineAppearance(worldId: string, timelineId: string, appearanceId: string, expectedUpdatedAt: string): Promise<{ timeline: TimelineData; removed: TimelineAppearance; index: number }> {
    const worldDir = await resolveWorldDir(worldId)
    return removeAppearance(worldDir, worldId, timelineId, appearanceId, expectedUpdatedAt)
  }

  async restoreTimelineAppearance(worldId: string, timelineId: string, appearance: TimelineAppearance, index: number, expectedUpdatedAt: string): Promise<TimelineData> {
    const worldDir = await resolveWorldDir(worldId)
    return restoreAppearance(worldDir, worldId, timelineId, appearance, index, expectedUpdatedAt)
  }

  async previewOriginEvent(worldId: string, eventId: string): Promise<OriginEventPreview> {
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, () => previewOriginEvent(worldDir, eventId))
  }

  async replaceOriginEvent(worldId: string, eventId: string, fingerprint: string): Promise<World> {
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, () => replaceOriginEvent(worldDir, eventId, fingerprint))
  }

  async createOriginEvent(worldId: string, input: NewEntityInput): Promise<Entity> {
    const parsed = NewEntityInputSchema.parse(input)
    if (parsed.type !== 'event') throw new Error('A origem precisa ser um Evento.')
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, async () => {
      await reconcileEntityLifecycle(worldDir, worldId)
      const world = await readWorldByDir(worldDir)
      if (world.originEventId) throw new Error('Este mundo já possui um Evento de origem. Substitua-o nas configurações do calendário.')
      const date = validateCalendarDateValue(world.calendar, parsed.properties.eventDate)
      if (!date.success || date.data.end || date.data.start.month === undefined || date.data.start.day === undefined || date.data.start.approximate) {
        throw new Error('Informe uma data exata, completa e sem intervalo para o Evento de origem.')
      }
      const originDate = { ...date.data.start, year: 0 }
      const properties = { ...parsed.properties, eventDate: { start: originDate } }
      const now = new Date().toISOString()
      const entity = EntitySchema.parse({ ...parsed, id: newId(), worldId, slug: slugify(parsed.title), properties, relations: [], schemaVersion: ENTITY_SCHEMA_VERSION, createdAt: now, updatedAt: now })
      const next = WorldSchema.parse({ ...world, originEventId: entity.id, calendar: { ...world.calendar, origin: { ...world.calendar.origin, month: originDate.month, day: originDate.day } }, updatedAt: now })
      try {
        await writeEntity(worldDir, entity)
        await atomicWriteJson(getEntityContentPath(worldDir, entity.id), emptyContentDocument())
        await atomicWriteJson(getWorldJsonPath(worldDir), next)
      } catch (error) {
        await rm(getEntityDir(worldDir, entity.id), { recursive: true, force: true })
        throw error
      }
      return entity
    })
  }
  previewDateMigration(worldId: string): Promise<DateMigrationPreview> { return previewDateMigration(worldId) }
  startDateMigration(worldId: string, fingerprint: string): Promise<string> { return startDateMigration(worldId, fingerprint) }
  recoverDateMigration(worldId: string, backupId: string, restore: boolean): Promise<void> { return recoverDateMigration(worldId, backupId, restore) }
  async listWorlds(): Promise<World[]> {
    const dirs = await listWorldDirs()
    return Promise.all(dirs.map((dir) => withWorldWriteLock(dir, () => readWorldByDir(dir))))
  }

  async getWorld(worldId: string): Promise<World> {
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, () => readWorldByDir(worldDir))
  }

  async updateTimelineScaleDefaults(worldId: string, defaults: Record<string, TimelineScale>): Promise<World> {
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, async () => {
      const current = await readWorldByDir(worldDir)
      const typeIds = new Set(current.entityTypes.map((type) => type.id))
      if (Object.keys(defaults).length !== typeIds.size || Object.keys(defaults).some((id) => !typeIds.has(id))) {
        throw new Error('Informe uma escala válida para cada tipo deste mundo.')
      }
      const parsed = Object.fromEntries(Object.entries(defaults).map(([id, scale]) => [id, TimelineScaleSchema.parse(scale)]))
      const next = WorldSchema.parse({ ...current, timelineScaleDefaults: parsed, updatedAt: new Date().toISOString() })
      await atomicWriteJson(getWorldJsonPath(worldDir), next)
      return next
    })
  }

  async updateCalendar(worldId: string, calendar: World['calendar']): Promise<World> {
    const parsedCalendar = CalendarSchema.parse(calendar)
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, async () => {
    const current = await readWorldByDir(worldDir)
    if (current.originEventId && (current.calendar.origin.month !== parsedCalendar.origin.month || current.calendar.origin.day !== parsedCalendar.origin.day)) {
      throw new Error('A posição da origem é definida pelo Evento vinculado. Substitua o Evento para alterá-la.')
    }
    if (changesCalendarStructure(current.calendar, parsedCalendar)) {
      const active = await listEntitiesByDir(worldDir)
      const trashDir = getTrashDir(worldDir)
      const trashed = await pathExists(trashDir)
        ? await Promise.all((await readdir(trashDir, { withFileTypes: true }))
          .filter((entry) => entry.isDirectory() && entry.name.startsWith('entity-'))
          .map((entry) => readMigratedJson(path.join(trashDir, entry.name, 'metadata.json'), entityMigrations, EntitySchema)))
        : []
      const dateKeysByType = new Map(current.entityTypes.map((type) => [
        type.id,
        type.properties.filter((property) => property.kind === 'date').map((property) => property.key),
      ]))
      let datedValues = [...active, ...trashed].reduce((count, entity) => count +
        (dateKeysByType.get(entity.type) ?? []).filter((key) => {
          const value = entity.properties[key]
          return value !== undefined && value !== null && value !== ''
        }).length, 0)
      for (const dir of [getEntitiesDir(worldDir), trashDir]) {
        if (!(await pathExists(dir))) continue
        for (const item of await readdir(dir, { withFileTypes: true })) {
          if (!item.isDirectory()) continue
          const file = path.join(dir, item.name, 'timeline.json')
          if (!(await pathExists(file))) continue
          const timeline = parseTimelineData(JSON.parse(await readFile(file, 'utf8')))
          if (timeline.worldId !== current.id) throw new Error('Os dados da linha do tempo pertencem a outro mundo.')
          datedValues += timeline.appearances.filter((appearance) => appearance.date !== null).length
        }
      }
      if (datedValues > 0) {
        throw new Error(`Há ${datedValues} campo(s) de data preenchido(s) neste mundo. A alteração estrutural do calendário precisa aguardar a conversão com prévia e confirmação das datas.`)
      }
    }
    const next = WorldSchema.parse({ ...current, calendar: parsedCalendar, updatedAt: new Date().toISOString() })
    await atomicWriteJson(getWorldJsonPath(worldDir), next)
    return next
    })
  }

  async listEntities(worldId: string, filter?: EntityListFilter): Promise<Entity[]> {
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, () => listEntitiesByDir(worldDir, filter))
  }

  async listTrashedEntities(worldId: string): Promise<Entity[]> {
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, () => listTrashedEntitiesByDir(worldDir, worldId))
  }

  async getEntity(worldId: string, entityId: string): Promise<Entity | null> {
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, () => readEntityByDir(worldDir, entityId))
  }

  async getOriginEvent(worldId: string): Promise<{ id: string; title: string; trashed: boolean } | null> {
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, async () => {
      await reconcileEntityLifecycle(worldDir, worldId)
      const world = await readWorldByDir(worldDir)
      if (!world.originEventId) return null
      const active = await readEntityByDir(worldDir, world.originEventId)
      if (active) return { id: active.id, title: active.title, trashed: false }
      const trashDir = getTrashDir(worldDir)
      if (!(await pathExists(trashDir))) return null
      const items = await readdir(trashDir, { withFileTypes: true })
      const item = items.find((entry) => entry.isDirectory() && entry.name.startsWith(`entity-${world.originEventId}-`))
      if (!item) return null
      const entity = await readMigratedJson(path.join(trashDir, item.name, 'metadata.json'), entityMigrations, EntitySchema)
      if (entity.id !== world.originEventId || entity.worldId !== world.id || entity.type !== 'event') throw new Error('O Evento de origem na lixeira é inválido.')
      return { id: entity.id, title: entity.title, trashed: true }
    })
  }

  async createEntity(worldId: string, input: NewEntityInput): Promise<Entity> {
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, async () => {
    const entity = buildNewEntity(worldId, input)
    await writeInitialEntityFiles(worldDir, entity)
    return entity
    })
  }

  async updateEntity(worldId: string, entityId: string, patch: EntityPatch): Promise<Entity> {
    const parsedPatch = EntityPatchSchema.parse(patch)
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, async () => {
    const current = await readEntityByDir(worldDir, entityId)
    if (!current) throw new EntityNotFoundError(entityId)
    const world = await readWorldByDir(worldDir)
    if (world.originEventId === entityId && parsedPatch.properties !== undefined) {
      const value = validateCalendarDateValue(world.calendar, parsedPatch.properties.eventDate)
      if (!value.success || value.data.end || value.data.start.approximate || value.data.start.year !== 0 || value.data.start.month !== world.calendar.origin.month || value.data.start.day !== world.calendar.origin.day) {
        throw new Error('A data do Evento de origem deve permanecer no marco do ano zero. Substitua a origem no calendário.')
      }
    }

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
    })
  }

  async deleteEntity(worldId: string, entityId: string): Promise<void> {
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, async () => {
    const entityDir = getEntityDir(worldDir, entityId)
    if (!(await pathExists(entityDir))) throw new EntityNotFoundError(entityId)

    const trashDir = getTrashDir(worldDir)
    await ensureDir(trashDir)
    await rename(entityDir, path.join(trashDir, `entity-${entityId}-${Date.now()}`))
    })
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
    return withWorldWriteLock(worldDir, async () => {
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
    })
  }

  async removeRelation(worldId: string, sourceId: string, relationId: string): Promise<void> {
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, async () => {
    const source = await readEntityByDir(worldDir, sourceId)
    if (!source) throw new EntityNotFoundError(sourceId)

    const next: Entity = EntitySchema.parse({
      ...source,
      relations: source.relations.filter((relation) => relation.id !== relationId),
      updatedAt: new Date().toISOString(),
    })

    await writeEntity(worldDir, next)
    })
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
