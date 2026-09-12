import { describe, expect, it } from 'vitest'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import { ContentDocumentSchema } from '@/domain/content/contentDocument'
import { WorldSchema } from '@/domain/worlds/world'
import { migrateToLatest } from '@/lib/migrations/registry'
import { contentMigrations, worldMigrations } from './migrations'

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
