import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emptyContentDocument } from '@/domain/content/contentDocument'
import { SqliteDatabase } from './database'
import { SqliteWorldRepository } from './sqliteWorldRepository'

describe('biblioteca SQLite', () => {
  let directory: string
  let db: SqliteDatabase
  let repo: SqliteWorldRepository

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'canon-sqlite-'))
    db = new SqliteDatabase(path.join(directory, 'codex.sqlite'))
    repo = new SqliteWorldRepository(db)
  })

  afterEach(async () => {
    db.close()
    await rm(directory, { recursive: true, force: true })
  })

  it('preserva artigos e revisões no backup, com paginação e isolamento entre mundos', async () => {
    const first = repo.createWorld('Primeiro')
    const second = repo.createWorld('Segundo')
    const doc = {
      ...emptyContentDocument(),
      pages: [{ id: 'nota', title: 'Nota sintética', body: { type: 'doc', content: [] } }],
    }
    const article = await repo.createEntity(first.id, { type: 'character', title: 'Um' }, doc)
    const other = await repo.createEntity(first.id, { type: 'location', title: 'Dois' })
    await repo.createEntity(second.id, { type: 'character', title: 'Outro mundo' })
    const revision = (await repo.listArticleSources(first.id)).find(({ entity }) => entity.id === article.id)?.revision
    await repo.saveContent(first.id, article.id, { ...doc, pages: [{ ...doc.pages[0], title: 'Nova nota' }] })
    const page = await repo.listArticleSources(first.id, undefined, 1)
    const next = await repo.listArticleSources(first.id, page[0].entity.id, 1)
    expect([...page, ...next].map(({ entity }) => entity.id).sort()).toEqual([article.id, other.id].sort())
    await repo.deleteEntity(first.id, other.id)

    const backup = path.join(directory, 'backup.sqlite')
    await db.backupTo(backup)
    db.close()
    db = new SqliteDatabase(backup)
    repo = new SqliteWorldRepository(db)
    expect(await repo.listArticleSources(first.id)).toMatchObject([{
      entity: { id: article.id }, content: { pages: [{ id: 'nota', title: 'Nova nota' }] }, revision: Number(revision) + 1,
    }])
    expect(await repo.listArticleSources(second.id)).toMatchObject([{ entity: { title: 'Outro mundo' } }])
    expect(await repo.listTrashedEntities(first.id)).toMatchObject([{ id: other.id }])
  })

  it('reverte registro e conteúdo quando a gravação composta falha', async () => {
    const world = repo.createWorld('Mundo de teste')
    const doc = emptyContentDocument()
    const article = await repo.createEntity(world.id, { type: 'character', title: 'Antes' }, doc)
    const previous = await repo.listArticleSources(world.id)
    db.connection.exec(`
      CREATE TRIGGER reject_content BEFORE UPDATE OF content ON entities
      BEGIN SELECT RAISE(ABORT, 'Falha sintética'); END;
    `)
    await expect(repo.updateEntity(world.id, article.id, { title: 'Depois' }, doc)).rejects.toThrow('Falha sintética')
    expect(await repo.listArticleSources(world.id)).toEqual(previous)
  })

  it('cria o mundo inicial uma vez e preserva uma biblioteca esvaziada', async () => {
    const [seed] = await repo.listWorlds()
    expect(seed.name).toBe('Canon Codex')
    repo.deleteWorld(seed.id)
    expect(await repo.listWorlds()).toEqual([])
    expect(() => repo.importWorlds([], true)).toThrow(/banco SQLite novo/)
  })

  it('preserva cartões na lixeira e retrocede uma criação rápida incompleta', async () => {
    const world = repo.createWorld('Cronologia sintética')
    const line = await repo.createEntity(world.id, { type: 'timeline', title: 'Linha' })
    const timeline = await repo.getTimeline(world.id, line.id)
    const date = { start: { year: 0, month: 1, day: 2 } }
    const { entity, timeline: updated } = await repo.createTimelineEvent(world.id, line.id, 'Evento', date, timeline.updatedAt)
    await repo.deleteEntity(world.id, entity.id)
    expect((await repo.getTimeline(world.id, line.id)).appearances).toEqual(updated.appearances)
    db.connection.exec(`
      CREATE TRIGGER reject_appearance BEFORE INSERT ON timeline_appearances
      BEGIN SELECT RAISE(ABORT, 'Falha sintética'); END;
    `)
    await expect(repo.createTimelineEvent(world.id, line.id, 'Evento incompleto', date, updated.updatedAt)).rejects.toThrow('Falha sintética')
    expect(await repo.listCalendarAgenda(world.id)).toEqual([])
    expect(await repo.getTimeline(world.id, line.id)).toEqual(updated)
  })
})
