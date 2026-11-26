import { mkdtemp, rm } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import { WORLD_SCHEMA_VERSION } from '@/domain/worlds/world'
import { SqliteDatabase } from './database'
import { SqliteWorldRepository } from './sqliteWorldRepository'

/**
 * Banco criado antes do mundo v25: os mundos guardam o tipo `artifact` como "Objeto / Artefato".
 * Ao abrir com a versão nova, o nome padrão muda para "Objeto" e um nome personalizado fica.
 */
describe('migrações SQLite da ficha de Objetos', () => {
  let directory: string
  let file: string

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'canon-sqlite-objetos-'))
    file = path.join(directory, 'codex.sqlite')
  })
  afterEach(async () => { await rm(directory, { recursive: true, force: true }) })

  it('renomeia o tipo padrão, tira registro e materiais e sobe o mundo para a versão atual', async () => {
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
      const fields = [{ key: 'registrationNumber', label: 'Número de registro', kind: 'text' }, { key: 'materials', label: 'Materiais', kind: 'tags' }]
      world.entityTypes = world.entityTypes.map((type: { id: string; properties: unknown[] }) => type.id !== 'artifact' ? type
        : { ...type, properties: [fields[0], ...type.properties, fields[1]], ...(row.id === custom.id ? { label: 'Relíquia', pluralLabel: 'Relíquias' } : { label: 'Objeto / Artefato', pluralLabel: 'Objetos / Artefatos' }) })
      raw.prepare('UPDATE worlds SET document = ? WHERE id = ?').run(JSON.stringify(world), row.id)
    }
    // Antes das migrações 3 (nome) e 4 (campos).
    raw.exec('PRAGMA user_version = 2')
    raw.close()

    const reopened = new SqliteDatabase(file)
    const after = new SqliteWorldRepository(reopened)
    const type = async (id: string) => (await after.getWorld(id)).entityTypes.find((item) => item.id === 'artifact')!
    expect(await type(standard.id)).toMatchObject({ label: 'Objeto', pluralLabel: 'Objetos' })
    expect(await type(custom.id)).toMatchObject({ label: 'Relíquia', pluralLabel: 'Relíquias' })
    const keys = (await type(standard.id)).properties.map((property) => property.key)
    expect(keys).not.toContain('registrationNumber')
    expect(keys).not.toContain('materials')
    expect(keys).toEqual(createDefaultWorldSeed().entityTypes.find((item) => item.id === 'artifact')!.properties.map((property) => property.key))
    expect((await after.getWorld(standard.id)).schemaVersion).toBe(WORLD_SCHEMA_VERSION)
    reopened.close()
  })
})
