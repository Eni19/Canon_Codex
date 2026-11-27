import { createDefaultWorldSeed } from '../src/domain/worlds/defaultWorldSeed'
import { ENTITY_SCHEMA_VERSION, EntitySchema } from '../src/domain/entities/entity'

const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`

/**
 * Synthetic, deterministic input: 500 items and three outgoing relations per item. Items alternate
 * between character and location; with `allTypes` they cycle through every type of the seed world,
 * so each card silhouette (#72) appears in the scene.
 */
export function createRelationshipStressFixture({ allTypes = false } = {}) {
  const world = { ...createDefaultWorldSeed(), id: id('10000000', 1), slug: 'grafo-sintetico', name: 'Laboratório de relacionamentos' }
  const types = allTypes ? world.entityTypes.map((type) => type.id) : ['character', 'location']
  const now = '2026-11-16T12:00:00.000Z'
  const entities = Array.from({ length: 500 }, (_, index) => EntitySchema.parse({
    id: id('20000000', index + 1), worldId: world.id,
    type: types[index % types.length], title: `Registro sintético ${String(index + 1).padStart(3, '0')}`,
    slug: `registro-${index + 1}`, aliases: [], tags: [], properties: {}, schemaVersion: ENTITY_SCHEMA_VERSION,
    createdAt: now, updatedAt: now,
    relations: [1, 13, 97].map((offset, relationIndex) => ({
      id: id('30000000', index * 3 + relationIndex + 1), sourceId: id('20000000', index + 1),
      targetId: id('20000000', (index + offset) % 500 + 1), type: ['investiga', 'protege', 'aliado'][relationIndex],
      directional: relationIndex !== 2,
    })),
  }))
  return { world, entities }
}
