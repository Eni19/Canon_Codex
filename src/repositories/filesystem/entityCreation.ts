import 'server-only'
import { emptyContentDocument } from '@/domain/content/contentDocument'
import { ENTITY_SCHEMA_VERSION, EntitySchema, NewEntityInputSchema, type Entity, type NewEntityInput } from '@/domain/entities/entity'
import { emptyTimelineData } from '@/domain/timelines/timeline'
import { atomicWriteJson } from '@/lib/fs/atomicWrite'
import { getEntityContentPath, getEntityMetadataPath, getTimelineDataPath } from '@/lib/fs/paths'
import { newId } from '@/lib/ids'
import { slugify } from '@/lib/slugify'

/** Caller holds the world write lock and owns rollback for any multi-file operation. */
export function buildNewEntity(worldId: string, input: NewEntityInput): Entity {
  const parsed = NewEntityInputSchema.parse(input)
  const now = new Date().toISOString()
  return EntitySchema.parse({ id: newId(), worldId, ...parsed, slug: slugify(parsed.title),
    relations: [], schemaVersion: ENTITY_SCHEMA_VERSION, createdAt: now, updatedAt: now })
}

export async function writeInitialEntityFiles(worldDir: string, entity: Entity): Promise<void> {
  await atomicWriteJson(getEntityMetadataPath(worldDir, entity.id), entity)
  await atomicWriteJson(getEntityContentPath(worldDir, entity.id), emptyContentDocument())
  if (entity.type === 'timeline') await atomicWriteJson(getTimelineDataPath(worldDir, entity.id), emptyTimelineData(entity.worldId, entity.id))
}
