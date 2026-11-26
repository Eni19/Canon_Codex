import 'server-only'
import Fuse from 'fuse.js'
import type { Entity } from '@/domain/entities/entity'
import { matchesTagPrefixes, parseTagQuery } from '@/domain/entities/entityTags'
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

  // "#etiqueta" filtra por prefixo de etiqueta; o texto restante segue para a busca aproximada.
  const { text, tagPrefixes } = parseTagQuery(query)
  const entities = allEntities.filter((entity) => (!options?.type || entity.type === options.type) && matchesTagPrefixes(entity.tags, tagPrefixes))
  if (!text) return entities.slice(0, limit).map(toSearchResult)

  const normalizedTerm = text.toLowerCase()
  const exact: Entity[] = []
  const remaining: Entity[] = []
  for (const entity of entities) {
    if (entity.title.trim().toLowerCase() === normalizedTerm) exact.push(entity)
    else remaining.push(entity)
  }
  if (exact.length >= limit) return exact.slice(0, limit).map(toSearchResult)

  const fuse = new Fuse(remaining, {
    keys: [
      { name: 'title', weight: 0.5 },
      { name: 'aliases', weight: 0.3 },
      { name: 'tags', weight: 0.2 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
  })

  const approximate = fuse.search(text, { limit: limit - exact.length })
  return [...exact, ...approximate.map(result => result.item)].map(toSearchResult)
}
