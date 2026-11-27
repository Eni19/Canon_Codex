import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SqliteDatabase } from './database'
import { SqliteAssetStore } from './sqliteAssetStore'
import { SqliteBoardRepository } from './sqliteBoardRepository'
import { SqliteTrashRepository } from './sqliteTrash'
import { SqliteWorldRepository } from './sqliteWorldRepository'

const DAY = 24 * 60 * 60 * 1000
const deletedAt = new Date('2026-11-20T12:00:00.000Z')
const insideTerm = new Date(deletedAt.getTime() + 6 * DAY)
const afterTerm = new Date(deletedAt.getTime() + 7 * DAY)

describe('lixeira SQLite com prazo', () => {
  let db: SqliteDatabase
  let worlds: SqliteWorldRepository
  let trash: SqliteTrashRepository

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(deletedAt)
    db = new SqliteDatabase(':memory:')
    worlds = new SqliteWorldRepository(db)
    trash = new SqliteTrashRepository(db, worlds)
  })

  afterEach(() => {
    db.close()
    vi.useRealTimers()
  })

  it('lista registros e quadros excluídos com o prazo de sete dias e restaura dentro dele', async () => {
    const world = worlds.createWorld('Sintético')
    const boards = new SqliteBoardRepository(db)
    const record = await worlds.createEntity(world.id, { type: 'character', title: 'Personagem sintético' })
    const board = await boards.createBoard(world.id, { title: 'Quadro sintético', description: '', tags: [] })
    await worlds.deleteEntity(world.id, record.id)
    await boards.deleteBoard(world.id, board.id)

    expect(await trash.listTrash(world.id, insideTerm)).toEqual(expect.arrayContaining([
      { kind: 'entity', id: record.id, title: 'Personagem sintético', entityType: 'character', deletedAt: deletedAt.toISOString(), expiresAt: afterTerm.toISOString() },
      { kind: 'board', id: board.id, title: 'Quadro sintético', deletedAt: deletedAt.toISOString(), expiresAt: afterTerm.toISOString() },
    ]))

    await trash.restoreItem(world.id, 'entity', record.id, insideTerm)
    await trash.restoreItem(world.id, 'board', board.id, insideTerm)
    expect(await worlds.getEntity(world.id, record.id)).toMatchObject({ title: 'Personagem sintético' })
    expect(await boards.getBoard(world.id, board.id)).toMatchObject({ title: 'Quadro sintético' })
    expect(await trash.listTrash(world.id, insideTerm)).toEqual([])
  })

  it('apaga de vez o que venceu, limpa relações e aparições e não deixa restaurar', async () => {
    const world = worlds.createWorld('Sintético')
    const kept = await worlds.createEntity(world.id, { type: 'character', title: 'Fica' })
    const gone = await worlds.createEntity(world.id, { type: 'location', title: 'Vai' })
    const line = await worlds.createEntity(world.id, { type: 'timeline', title: 'Linha' })
    await worlds.addRelation(world.id, kept.id, { sourceId: kept.id, targetId: gone.id, type: 'related', directional: false })
    const timeline = await worlds.getTimeline(world.id, line.id)
    await worlds.addTimelineAppearance(world.id, line.id, gone.id, null, timeline.updatedAt)
    await worlds.deleteEntity(world.id, gone.id)

    expect(await trash.purgeExpired(insideTerm)).toEqual({ worlds: 0, items: 0, assets: 0 })
    expect((await worlds.getTimeline(world.id, line.id)).appearances).toHaveLength(1)

    expect(await trash.purgeExpired(afterTerm)).toEqual({ worlds: 0, items: 1, assets: 0 })
    expect(await worlds.listTrashedEntities(world.id)).toEqual([])
    expect((await worlds.getEntity(world.id, kept.id))?.relations).toEqual([])
    expect((await worlds.getTimeline(world.id, line.id)).appearances).toEqual([])
    await expect(trash.restoreItem(world.id, 'entity', gone.id, afterTerm)).rejects.toThrow('não está mais na lixeira')
  })

  it('recusa restaurar um item vencido mesmo antes da limpeza rodar', async () => {
    const world = worlds.createWorld('Sintético')
    const record = await worlds.createEntity(world.id, { type: 'character', title: 'Atrasado' })
    await worlds.deleteEntity(world.id, record.id)
    await expect(trash.restoreItem(world.id, 'entity', record.id, afterTerm)).rejects.toThrow('não está mais na lixeira')
    expect(await worlds.listTrashedEntities(world.id)).toHaveLength(1)
  })

  it('descarta na hora um item escolhido e isola outros mundos', async () => {
    const world = worlds.createWorld('Sintético')
    const other = worlds.createWorld('Outro')
    const record = await worlds.createEntity(world.id, { type: 'character', title: 'Descartado' })
    const foreign = await worlds.createEntity(other.id, { type: 'character', title: 'Alheio' })
    await worlds.deleteEntity(world.id, record.id)
    await worlds.deleteEntity(other.id, foreign.id)

    await expect(trash.discardItem(other.id, 'entity', record.id)).rejects.toThrow('não está mais na lixeira')
    await trash.discardItem(world.id, 'entity', record.id)
    expect(await worlds.listTrashedEntities(world.id)).toEqual([])
    expect(await trash.listTrash(other.id, insideTerm)).toMatchObject([{ id: foreign.id }])
  })

  it('guarda imagens sem uso até o prazo e devolve a capa ao restaurar o registro', async () => {
    const world = worlds.createWorld('Sintético')
    const assets = new SqliteAssetStore(db)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    const cover = await assets.importFromBuffer(world.id, png, 'capa.png', 'image/png')
    const loose = await assets.importFromBuffer(world.id, png, 'solta.png', 'image/png')
    const record = await worlds.createEntity(world.id, { type: 'character', title: 'Com capa', coverAssetId: cover.id })
    await worlds.deleteEntity(world.id, record.id)
    await assets.removeAsset(world.id, cover.id)
    await assets.removeAsset(world.id, loose.id)

    await trash.restoreItem(world.id, 'entity', record.id, insideTerm)
    expect(await assets.getAsset(world.id, cover.id)).toMatchObject({ id: cover.id })
    expect(await trash.purgeExpired(afterTerm)).toEqual({ worlds: 0, items: 0, assets: 1 })
    expect(db.connection.prepare('SELECT count(*) AS total FROM assets WHERE id = ?').get(loose.id)).toEqual({ total: 0 })
  })

  it('restaura um Codex com novo slug se outro ocupou o nome e apaga de vez o Codex vencido', async () => {
    const restored = worlds.createWorld('Arquivo')
    const record = await worlds.createEntity(restored.id, { type: 'character', title: 'Dentro do Codex' })
    worlds.deleteWorld(restored.id)
    worlds.createWorld('Arquivo')
    expect(await trash.listTrashedWorlds(insideTerm)).toEqual([
      { id: restored.id, name: 'Arquivo', deletedAt: deletedAt.toISOString(), expiresAt: afterTerm.toISOString() },
    ])
    expect(await trash.restoreWorld(restored.id, insideTerm)).toMatchObject({ id: restored.id, slug: 'arquivo-2' })
    expect(await worlds.getEntity(restored.id, record.id)).toMatchObject({ title: 'Dentro do Codex' })

    worlds.deleteWorld(restored.id)
    expect(await trash.purgeExpired(afterTerm)).toEqual({ worlds: 1, items: 0, assets: 0 })
    expect(await trash.listTrashedWorlds(afterTerm)).toEqual([])
    expect(db.connection.prepare('SELECT count(*) AS total FROM entities WHERE world_id = ?').get(restored.id)).toEqual({ total: 0 })
  })
})
