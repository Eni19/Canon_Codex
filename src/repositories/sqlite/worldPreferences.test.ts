import { mkdtemp, rm } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WORLD_SCHEMA_VERSION } from '@/domain/worlds/world'
import { SqliteDatabase } from './database'
import { SqliteWorldRepository } from './sqliteWorldRepository'

/** Preferências do Codex (mundo v27) no SQLite: a migração SQL e a gravação pelo repositório. */
describe('preferências do Codex no SQLite', () => {
  let directory: string
  let file: string

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'canon-sqlite-preferencias-'))
    file = path.join(directory, 'codex.sqlite')
  })
  afterEach(async () => { await rm(directory, { recursive: true, force: true }) })

  it('dá preferências padrão a mundos v26 e os leva à versão atual', async () => {
    const db = new SqliteDatabase(file)
    const world = new SqliteWorldRepository(db).createWorld('Mundo antigo')
    db.close()

    // Volta o banco ao estado anterior: mundo v26, sem preferências, antes da migração 5.
    const raw = new DatabaseSync(file)
    const row = raw.prepare('SELECT document FROM worlds WHERE id = ?').get(world.id) as { document: string }
    const document = JSON.parse(row.document)
    delete document.preferences
    document.schemaVersion = 26
    raw.prepare('UPDATE worlds SET document = ? WHERE id = ?').run(JSON.stringify(document), world.id)
    raw.exec('PRAGMA user_version = 4')
    raw.close()

    const reopened = new SqliteDatabase(file)
    const migrated = await new SqliteWorldRepository(reopened).getWorld(world.id)
    expect(migrated.preferences).toEqual({ hiddenEntityTypes: [], hiddenTools: [], plainInterfaces: [], contentOrder: [] })
    expect(migrated.schemaVersion).toBe(WORLD_SCHEMA_VERSION)
    reopened.close()
  })

  it('grava preferências normalizadas e as mantém ao reabrir', async () => {
    const db = new SqliteDatabase(file)
    const repo = new SqliteWorldRepository(db)
    const world = repo.createWorld('Mundo')
    const saved = await repo.updateWorldPreferences(world.id, { hiddenEntityTypes: ['clue', 'clue'], hiddenTools: ['soundtrack'], plainInterfaces: ['artifact', 'character'], contentOrder: [] })
    expect(saved.preferences).toEqual({ hiddenEntityTypes: ['clue'], hiddenTools: ['soundtrack'], plainInterfaces: ['artifact'], contentOrder: [] })
    db.close()
    const reopened = new SqliteDatabase(file)
    expect((await new SqliteWorldRepository(reopened).getWorld(world.id)).preferences).toEqual(saved.preferences)
    reopened.close()
  })
})
