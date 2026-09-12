import 'server-only'
import Fuse from 'fuse.js'
import type { Entity } from '@/domain/entities/entity'
import { getWorldRepository } from '@/repositories'

export interface SearchResultItem {
  id: string
  type: string
  typeLabel: string
  typeIcon: string
  title: string
  aliases: string[]
  tags: string[]
}

/**
 * In-memory fuzzy search, rebuilt from the repository on every call. The index is derived data —
 * never the source of truth — so this is deliberately simple; see PROJECT.md "Busca". Title and
 * aliases outweigh tags, matching the weighting the product spec calls for.
 */
export async function searchEntities(
  worldId: string,
  query: string,
  options?: { type?: string; limit?: number },
): Promise<SearchResultItem[]> {
  const limit = options?.limit ?? 8
  const repo = getWorldRepository()
  const [world, allEntities] = await Promise.all([repo.getWorld(worldId), repo.listEntities(worldId)])
  const typeById = new Map(world.entityTypes.map((type) => [type.id, type]))

  const toSearchResult = (entity: Entity): SearchResultItem => {
    const entityType = typeById.get(entity.type)
    return {
      id: entity.id,
      type: entity.type,
      typeLabel: entityType?.label ?? entity.type,
      typeIcon: entityType?.icon ?? 'Circle',
      title: entity.title,
      aliases: entity.aliases,
      tags: entity.tags,
    }
  }

  const entities = options?.type ? allEntities.filter((entity) => entity.type === options.type) : allEntities
  if (!query.trim()) return entities.slice(0, limit).map(toSearchResult)

  const fuse = new Fuse(entities, {
    keys: [
      { name: 'title', weight: 0.5 },
      { name: 'aliases', weight: 0.3 },
      { name: 'tags', weight: 0.2 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
  })

  return fuse
    .search(query)
    .slice(0, limit)
    .map((result) => toSearchResult(result.item))
}
