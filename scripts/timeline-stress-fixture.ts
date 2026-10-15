import { createDefaultWorldSeed } from '../src/domain/worlds/defaultWorldSeed'
import { EntitySchema, ENTITY_SCHEMA_VERSION } from '../src/domain/entities/entity'
import { TimelineDataSchema } from '../src/domain/timelines/timeline'

export function createTimelineStressFixture(count = 500) {
  const world = { ...createDefaultWorldSeed(), id: '20000000-0000-4000-8000-000000000001', slug: 'timeline-performance', name: 'Laboratório de 500 aparições' }
  const now = '2026-10-14T12:00:00.000Z'
  const records = Array.from({ length: 80 }, (_, index) => EntitySchema.parse({
    id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, worldId: world.id,
    type: index % 3 === 0 ? 'character' : 'event', title: `Registro sintético ${String(index + 1).padStart(3, '0')}`,
    slug: `registro-${index + 1}`, aliases: [], tags: [], properties: {}, relations: [],
    schemaVersion: ENTITY_SCHEMA_VERSION, createdAt: now, updatedAt: now,
  }))
  const line = EntitySchema.parse({ ...records[0], id: '30000000-0000-4000-8000-000000000001', type: 'timeline', title: 'Linha de 500 aparições', slug: 'linha-de-500-aparicoes' })
  const timeline = TimelineDataSchema.parse({
    schemaVersion: 2, worldId: world.id, timelineId: line.id, updatedAt: now,
    appearances: Array.from({ length: count }, (_, index) => ({
      id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      entityId: records[index % records.length].id, title: `Aparição sintética ${String(index + 1).padStart(3, '0')}`,
      note: `Nota sintética do cartão ${index + 1}.`, minimumScale: 'century', showCover: false,
      date: index % 10 === 0 ? null : {
        start: { year: Math.floor(index / 5) - 50, month: index % 12 + 1, day: 1, ...(index % 7 === 0 ? { approximate: true } : {}) },
        ...(index % 4 === 0 ? { end: { year: Math.floor(index / 5) - 48, month: index % 12 + 1, day: 2 } } : {}),
      },
    })),
  })
  return { world, records, line, timeline }
}
