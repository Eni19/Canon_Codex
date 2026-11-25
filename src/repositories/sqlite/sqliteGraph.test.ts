import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { InvalidFolderMemberError } from '@/domain/relations/graphFolders'
import { emptyGraphSettings } from '@/domain/relations/graphSettings'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import { atomicWriteJson } from '@/lib/fs/atomicWrite'
import { SqliteDatabase } from './database'
import { readLegacySource } from './legacy-source'
import { SqliteWorldRepository } from './sqliteWorldRepository'

describe('grafo de relações no SQLite', () => {
  let directory: string
  let db: SqliteDatabase
  let repo: SqliteWorldRepository

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'canon-sqlite-graph-'))
    db = new SqliteDatabase(path.join(directory, 'codex.sqlite'))
    repo = new SqliteWorldRepository(db)
  })

  afterEach(async () => {
    db.close()
    await rm(directory, { recursive: true, force: true })
  })

  it('salva configurações com revisão, isola mundos e valida membros de pastas', async () => {
    const world = repo.createWorld('Grafo')
    const other = repo.createWorld('Outro')
    const record = await repo.createEntity(world.id, { type: 'character', title: 'Alguém' })
    const foreign = await repo.createEntity(other.id, { type: 'character', title: 'Estrangeiro' })

    expect(await repo.getGraphSettings(world.id)).toEqual(emptyGraphSettings(world.id))
    const draft = { ...emptyGraphSettings(world.id), positions: { [record.id]: { x: 10, y: 20 } } }
    const saved = await repo.saveGraphSettings(world.id, draft)
    expect(saved.revision).toBe(1)
    expect(await repo.saveGraphSettings(world.id, draft)).toEqual(saved)
    expect(await repo.getGraphSettings(world.id)).toEqual(saved)
    expect(await repo.getGraphSettings(other.id)).toEqual(emptyGraphSettings(other.id))

    await expect(repo.saveGraphSettings(world.id, { ...draft, positions: {} })).rejects.toThrow('outra aba')
    await expect(repo.saveGraphSettings(other.id, saved)).rejects.toThrow('O mundo ativo mudou')

    const folder = { id: crypto.randomUUID(), name: 'Pasta', collapsed: false, members: [foreign.id] }
    await expect(repo.saveGraphSettings(world.id, { ...saved, folders: [folder] })).rejects.toBeInstanceOf(InvalidFolderMemberError)
    const withFolder = await repo.saveGraphSettings(world.id, { ...saved, folders: [{ ...folder, members: [record.id] }] })
    expect(withFolder.revision).toBe(2)
  })

  it('atualiza e remove relações com verificação de edição concorrente e repetição idempotente', async () => {
    const world = repo.createWorld('Relações')
    const source = await repo.createEntity(world.id, { type: 'character', title: 'Origem' })
    const target = await repo.createEntity(world.id, { type: 'character', title: 'Alvo' })
    const requestId = crypto.randomUUID()
    const input = { sourceId: source.id, targetId: target.id, type: 'aliado', directional: true, bidirectional: true }
    const relation = await repo.addRelation(world.id, source.id, input, requestId)
    expect(relation).toMatchObject({ id: requestId, bidirectional: true })
    expect(await repo.addRelation(world.id, source.id, input, requestId)).toEqual(relation)
    await expect(repo.addRelation(world.id, source.id, { ...input, type: 'rival' }, requestId)).rejects.toThrow('já foi usada')
    await expect(repo.addRelation(world.id, source.id, { ...input, targetId: crypto.randomUUID() })).rejects.toThrow()

    const updated = await repo.updateRelation(world.id, relation, { type: 'rival', directional: false })
    expect(updated).toMatchObject({ type: 'rival', directional: false })
    expect(updated.bidirectional).toBeUndefined()
    await expect(repo.updateRelation(world.id, relation, { type: 'outro', directional: true })).rejects.toThrow('outra aba')
    await expect(repo.removeRelation(world.id, source.id, relation.id, relation)).rejects.toThrow('outra aba')

    await repo.removeRelation(world.id, source.id, relation.id, updated)
    expect((await repo.getEntity(world.id, source.id))?.relations).toEqual([])
    expect(await repo.getBacklinks(world.id, target.id)).toEqual([])
  })

  it('importa o relationship-graph.json da biblioteca em arquivos', async () => {
    const world = { ...createDefaultWorldSeed(), id: crypto.randomUUID(), slug: 'com-grafo' }
    const worldDir = path.join(directory, 'legacy', 'workspace', 'worlds', 'com-grafo')
    await atomicWriteJson(path.join(worldDir, 'world.json'), world)
    const settings = { ...emptyGraphSettings(world.id), revision: 7, preferences: { type: 'character', relationType: '' } }
    await atomicWriteJson(path.join(worldDir, 'relationship-graph.json'), settings)

    const [legacy] = await readLegacySource(path.join(directory, 'legacy'), 'folder')
    expect(legacy.graphSettings).toEqual(settings)
    repo.importWorlds([legacy])
    expect(await repo.getGraphSettings(world.id)).toEqual(settings)
  })
})
