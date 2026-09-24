import { describe, expect, it } from 'vitest'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import { ContentDocumentSchema } from '@/domain/content/contentDocument'
import { WorldSchema } from '@/domain/worlds/world'
import { createDefaultCalendar } from '@/domain/worlds/calendar'
import { migrateToLatest } from '@/lib/migrations/registry'
import { contentMigrations, entityMigrations, worldMigrations } from './migrations'

describe('character profile migration', () => {
  it('adds the profile field to existing worlds without changing other definitions', () => {
    const world = createDefaultWorldSeed()
    const legacy = {
      ...world,
      schemaVersion: 1,
      entityTypes: world.entityTypes.map((type) => ({
        ...type,
        properties: type.properties.filter((property) => property.key !== 'profile'),
      })),
    }
    const migrated = WorldSchema.parse(migrateToLatest(worldMigrations, legacy))
    expect(migrated).toEqual(world)
  })

  it('preserves an existing custom profile definition', () => {
    const world = createDefaultWorldSeed()
    const character = world.entityTypes.find((type) => type.id === 'character')!
    character.properties[0] = { key: 'profile', label: 'Perfil', kind: 'enum', options: ['Analista'] }
    const migrated = WorldSchema.parse(migrateToLatest(worldMigrations, { ...world, schemaVersion: 1 }))
    expect(migrated).toEqual(world)
  })
})

describe('content pages migration', () => {
  it('moves legacy text into the first content page', () => {
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'História' }] }] }
    const migrated = ContentDocumentSchema.parse(migrateToLatest(contentMigrations, {
      format: 'tiptap-json', schemaVersion: 1, body,
    }))
    expect(migrated).toEqual({
      format: 'tiptap-json', schemaVersion: 2,
      pages: [{ id: 'principal', title: 'Principal', body }],
    })
  })
})
describe('tale catalog migration', () => {
  it('renames the category and adds literary fields to existing worlds', () => {
    const world = createDefaultWorldSeed()
    const legacy = {
      ...world,
      schemaVersion: 11,
      entityTypes: world.entityTypes.map((type) => type.id === 'tale' ? {
        ...type,
        label: 'Conto ou Lenda',
        pluralLabel: 'Contos e Lendas',
        properties: type.properties.filter((property) => ['taleType', 'culture', 'period', 'narrator'].includes(property.key)),
      } : type),
    }

    const migrated = WorldSchema.parse(migrateToLatest(worldMigrations, legacy))
    const tale = migrated.entityTypes.find((type) => type.id === 'tale')!

    expect(migrated.schemaVersion).toBe(16)
    expect(tale.label).toBe('Conto')
    expect(tale.pluralLabel).toBe('Contos')
    expect(tale.properties.map((property) => property.key)).toEqual(expect.arrayContaining([
      'subtitle', 'taleType', 'period', 'setting', 'characters', 'openingLayout', 'notes',
    ]))
  })
})
describe('concept reference manual migration', () => {
  it('keeps only the neutral reference fields in existing worlds', () => {
    const world = createDefaultWorldSeed()
    const legacy = {
      ...world,
      schemaVersion: 12,
      entityTypes: world.entityTypes.map((type) => type.id === 'concept' ? {
        ...type,
        properties: [{ key: 'category', label: 'Categoria personalizada', kind: 'text' as const }],
      } : type),
    }

    const migrated = WorldSchema.parse(migrateToLatest(worldMigrations, legacy))
    const concept = migrated.entityTypes.find((type) => type.id === 'concept')!

    expect(migrated.schemaVersion).toBe(16)
    expect(concept.properties.find((property) => property.key === 'category')?.label).toBe('Categoria personalizada')
    expect(concept.properties.map((property) => property.key)).toEqual(['category', 'summary'])
    expect(concept.properties.find((property) => property.key === 'summary')?.label).toBe('Subtítulo ou resumo')
  })
})
describe('concept block migration', () => {
  it('converts sketchbook blocks into reference manual sections', () => {
    const migrated = migrateToLatest(entityMigrations, {
      type: 'concept',
      schemaVersion: 3,
      properties: {
        conceptBlocks: [
          { id: 'a', type: 'definition', title: 'Definição', body: 'Texto' },
          { id: 'b', type: 'rule', title: 'Regras', body: 'Regra' },
          { id: 'c', type: 'question', title: 'Dúvida', body: 'Questão' },
        ],
      },
    })

    expect(migrated.schemaVersion).toBe(4)
    expect((migrated.properties as { conceptBlocks: Array<{ type: string }> }).conceptBlocks.map((block) => block.type)).toEqual([
      'overview', 'rules', 'notes',
    ])
  })
})
describe('world reference areas migration', () => {
  it('hides phenomena and adds species plus natural sciences without deleting old definitions', () => {
    const world = createDefaultWorldSeed()
    const legacy = {
      ...world,
      schemaVersion: 14,
      entityTypes: world.entityTypes
        .filter((type) => type.id !== 'species' && type.id !== 'naturalScience')
        .map((type) => type.id === 'phenomenon' ? { ...type, showInSidebar: true } : type),
    }

    const migrated = WorldSchema.parse(migrateToLatest(worldMigrations, legacy))
    const phenomenon = migrated.entityTypes.find((type) => type.id === 'phenomenon')
    const species = migrated.entityTypes.find((type) => type.id === 'species')
    const naturalScience = migrated.entityTypes.find((type) => type.id === 'naturalScience')

    expect(migrated.schemaVersion).toBe(16)
    expect(phenomenon?.showInSidebar).toBe(false)
    expect(species?.properties.find((property) => property.key === 'recordKind')?.options).toEqual(['Espécie', 'Povo / Cultura'])
    expect(naturalScience?.properties.find((property) => property.key === 'discipline')?.options).toEqual(['Natureza', 'Medicina'])
  })
})

describe('world calendar migration', () => {
  it('adds the conventional calendar to a legacy world without changing its entity catalog', () => {
    const world = createDefaultWorldSeed()
    const legacy = { ...world, schemaVersion: 15, calendar: undefined }

    const migrated = WorldSchema.parse(migrateToLatest(worldMigrations, legacy))

    expect(migrated.schemaVersion).toBe(16)
    expect(migrated.calendar).toEqual(createDefaultCalendar())
    expect(migrated.entityTypes).toEqual(world.entityTypes)
  })

  it('keeps a customized calendar when an older world is read', () => {
    const world = createDefaultWorldSeed()
    const customized = { ...world.calendar, hoursPerDay: 30 }
    const migrated = WorldSchema.parse(migrateToLatest(worldMigrations, { ...world, schemaVersion: 15, calendar: customized }))

    expect(migrated.calendar.hoursPerDay).toBe(30)
  })
})
