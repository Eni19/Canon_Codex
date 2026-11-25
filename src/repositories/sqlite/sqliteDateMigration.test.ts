import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import { atomicWriteJson } from '@/lib/fs/atomicWrite'
import { FileSystemWorldRepository } from '@/repositories/filesystem/fileSystemWorldRepository'
import { SqliteDatabase } from './database'
import { readLegacySource } from './legacy-source'
import { SqliteDateMigration } from './sqliteDateMigration'
import { SqliteRecords } from './sqliteRecords'
import { SqliteWorldRepository } from './sqliteWorldRepository'

describe('SqliteDateMigration', () => {
  let db: SqliteDatabase
  let records: SqliteRecords
  const world = createDefaultWorldSeed()
  const date = '2024-02-29'
  let migration: SqliteDateMigration

  beforeEach(() => {
    db = new SqliteDatabase(':memory:')
    records = new SqliteRecords(db)
    migration = new SqliteDateMigration(db, records, () => world)
  })
  afterEach(() => { db.close(); vi.unstubAllEnvs() })

  it('checks the preview fingerprint and restores converted active and trashed dates', async () => {
    db.connection.prepare('INSERT INTO worlds (id, slug, document) VALUES (?, ?, ?)').run(world.id, world.slug, JSON.stringify(world))
    const active = records.create(world.id, { type: 'event', title: 'Evento ativo', properties: { eventDate: date } })
    const deleted = records.create(world.id, { type: 'event', title: 'Evento apagado', properties: { eventDate: date } })
    records.delete(world.id, deleted.id)
    const before = await migration.previewDateMigration(world.id)
    expect(before).toMatchObject({ convertible: 2, alreadyConverted: 0 })
    records.update({ ...active, title: 'Evento revisado' })
    await expect(migration.startDateMigration(world.id, before.fingerprint)).rejects.toThrow('mudaram')
    const preview = await migration.previewDateMigration(world.id)
    const id = await migration.startDateMigration(world.id, preview.fingerprint)
    expect(await migration.previewDateMigration(world.id)).toMatchObject({ convertible: 0, alreadyConverted: 2, latestBackup: { id, state: 'completed' } })
    await migration.recoverDateMigration(world.id, id, true)
    expect(records.get(world.id, active.id)?.properties.eventDate).toBe(date)
    expect(records.get(world.id, deleted.id, true)?.properties.eventDate).toBe(date)
    expect(await migration.previewDateMigration(world.id)).toMatchObject({ convertible: 2, latestBackup: { id, state: 'restored' } })
  })

  it('restores a filesystem manifest imported from a legacy library', async () => {
    const source = await mkdtemp(path.join(tmpdir(), 'canon-date-archive-'))
    vi.stubEnv('WIKI_WORKSPACE_DIR', source)
    try {
      await atomicWriteJson(path.join(source, 'worlds', world.slug, 'world.json'), world)
      const legacy = new FileSystemWorldRepository()
      const active = await legacy.createEntity(world.id, { type: 'event', title: 'Antigo', properties: { eventDate: date } })
      const deleted = await legacy.createEntity(world.id, { type: 'event', title: 'Antigo apagado', properties: { eventDate: date } })
      await legacy.deleteEntity(world.id, deleted.id)
      const { fingerprint } = await legacy.previewDateMigration(world.id)
      const id = await legacy.startDateMigration(world.id, fingerprint)
      const sqlite = new SqliteWorldRepository(db)
      sqlite.importWorlds(await readLegacySource(source, 'library'), true)

      const before = records.get(world.id, active.id)!
      expect(before.properties.eventDate).toHaveProperty('start')
      const changed = records.get(world.id, deleted.id, true)!
      records.update({ ...changed, title: 'Revisão posterior à conversão' })
      await expect(sqlite.recoverDateMigration(world.id, id, true)).rejects.toThrow('mudou após a prévia')
      expect(records.get(world.id, active.id)).toEqual(before)
      expect(await sqlite.previewDateMigration(world.id)).toMatchObject({ latestBackup: { id, state: 'completed' } })

      records.update(changed)
      await sqlite.recoverDateMigration(world.id, id, true)
      expect(records.get(world.id, active.id)?.properties.eventDate).toBe(date)
      expect(records.get(world.id, deleted.id, true)?.properties.eventDate).toBe(date)
    } finally {
      await rm(source, { recursive: true, force: true })
    }
  })
})
