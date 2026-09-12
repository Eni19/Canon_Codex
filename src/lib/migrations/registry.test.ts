import { describe, expect, it } from 'vitest'
import { migrateToLatest, type MigrationRegistry } from '@/lib/migrations/registry'

describe('migrateToLatest', () => {
  it('leaves an already-current record untouched', () => {
    const registry: MigrationRegistry = { currentVersion: 1, migrations: {} }
    const record = { schemaVersion: 1, title: 'Amadeus Klein' }

    expect(migrateToLatest(registry, record)).toEqual(record)
  })

  it('applies chained migrations up to the current version (fake v1 -> v2 -> v3)', () => {
    const registry: MigrationRegistry = {
      currentVersion: 3,
      migrations: {
        1: (data) => ({ ...data, schemaVersion: 2, aliases: [] }),
        2: (data) => ({ ...data, schemaVersion: 3, tags: [] }),
      },
    }
    const legacyRecord = { schemaVersion: 1, title: 'Amadeus Klein' }

    const migrated = migrateToLatest(registry, legacyRecord)

    expect(migrated).toEqual({
      schemaVersion: 3,
      title: 'Amadeus Klein',
      aliases: [],
      tags: [],
    })
  })

  it('treats a missing schemaVersion as 1', () => {
    const registry: MigrationRegistry = {
      currentVersion: 2,
      migrations: { 1: (data) => ({ ...data, schemaVersion: 2, migrated: true }) },
    }

    expect(migrateToLatest(registry, { title: 'no version' })).toEqual({
      title: 'no version',
      schemaVersion: 2,
      migrated: true,
    })
  })

  it('throws when a migration step is missing', () => {
    const registry: MigrationRegistry = { currentVersion: 5, migrations: {} }

    expect(() => migrateToLatest(registry, { schemaVersion: 1 })).toThrow(/No migration registered/)
  })
})
