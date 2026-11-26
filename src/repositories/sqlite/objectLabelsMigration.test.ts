import { mkdtemp, rm } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WORLD_SCHEMA_VERSION } from '@/domain/worlds/world'
import { SqliteDatabase } from './database'
import { migrations } from './schema'
import { SqliteWorldRepository } from './sqliteWorldRepository'

/**
 * Banco criado antes do mundo v25: os mundos guardam o tipo `artifact` como "Objeto / Artefato".
 * Ao abrir com a versão nova, o nome padrão muda para "Objeto" e um nome personalizado fica.
 */
describe('migração SQLite do nome de Objetos', () => {
  let directory: string
  let file: string

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'canon-sqlite-objetos-'))
    file = path.join(directory, 'codex.sqlite')
  })
  afterEach(async () => { await rm(directory, { recursive: true, force: true }) })

  it('renomeia o tipo padrão, preserva nomes personalizados e sobe o mundo para v25', async () => {
    const db = new SqliteDatabase(file)
    const repo = new SqliteWorldRepository(db)
    const standard = repo.createWorld('Mundo padrão')
    const custom = repo.createWorld('Mundo personalizado')
    db.close()

    // Volta o banco ao estado anterior: mundos v24 com o nome antigo (um deles personalizado).
    const raw = new DatabaseSync(file)
    for (const row of raw.prepare('SELECT id, document FROM worlds').all() as Array<{ id: string; document: string }>) {
      const world = JSON.parse(row.document)
      world.schemaVersion = 24
      world.entityTypes = world.entityTypes.map((type: { id: string }) => type.id !== 'artifact' ? type
        : row.id === custom.id ? { ...type, label: 'Relíquia', pluralLabel: 'Relíquias' } : { ...type, label: 'Objeto / Artefato', pluralLabel: 'Objetos / Artefatos' })
      raw.prepare('UPDATE worlds SET document = ? WHERE id = ?').run(JSON.stringify(world), row.id)
    }
    raw.exec(`PRAGMA user_version = ${migrations.length - 1}`)
    raw.close()

    const reopened = new SqliteDatabase(file)
    const after = new SqliteWorldRepository(reopened)
    const type = async (id: string) => (await after.getWorld(id)).entityTypes.find((item) => item.id === 'artifact')!
    expect(await type(standard.id)).toMatchObject({ label: 'Objeto', pluralLabel: 'Objetos' })
    expect(await type(custom.id)).toMatchObject({ label: 'Relíquia', pluralLabel: 'Relíquias' })
    expect((await after.getWorld(standard.id)).schemaVersion).toBe(WORLD_SCHEMA_VERSION)
    reopened.close()
  })
})
