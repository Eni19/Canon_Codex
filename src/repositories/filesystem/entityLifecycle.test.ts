import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getEntityMetadataPath, getTimelineDataPath, getTrashDir, getWorldJsonPath } from '@/lib/fs/paths'
import { createWorld } from '@/services/worlds/worldLibrary'
import { FileSystemWorldRepository } from './fileSystemWorldRepository'
import * as atomicWrite from '@/lib/fs/atomicWrite'
import { searchEntities } from '@/services/search/searchEntities'

vi.mock('node:fs/promises', { spy: true })

describe('reconciliação do ciclo de vida de registros', () => {
  let temporary: string
  let repo: FileSystemWorldRepository
  let worldId: string
  let slug: string
  beforeEach(async () => {
    const actual = await vi.importActual<typeof fs>('node:fs/promises')
    vi.mocked(fs.readdir).mockImplementation(actual.readdir)
    temporary = await mkdtemp(path.join(tmpdir(), 'canon-lifecycle-'))
    process.env.WIKI_WORKSPACE_DIR = temporary
    repo = new FileSystemWorldRepository()
    const world = (await repo.listWorlds())[0]
    worldId = world.id
    slug = world.slug
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    delete process.env.WIKI_WORKSPACE_DIR
    await rm(temporary, { recursive: true, force: true })
  })

  async function discard(id: string) {
    const trash = getTrashDir(slug)
    const folder = (await readdir(trash)).find((name) => name.startsWith(`entity-${id}-`))!
    const target = path.resolve(trash, folder)
    if (!target.startsWith(path.resolve(temporary) + path.sep)) throw new Error('Unsafe synthetic path')
    await rm(target, { recursive: true })
  }

  it('cria uma nova origem após descarte definitivo sem exigir navegação intermediária', async () => {
    const input = { type: 'event', title: 'Origem sintética', properties: { eventDate: { start: { year: 0, month: 1, day: 1 } } } }
    const original = await repo.createOriginEvent(worldId, input)
    await repo.deleteEntity(worldId, original.id)
    await discard(original.id)
    await expect(repo.createOriginEvent(worldId, input)).resolves.toHaveProperty('id')
  })

  it('mantém consulta de mundo e busca global disponíveis quando uma linha está corrompida', async () => {
    const person = await repo.createEntity(worldId, { type: 'character', title: 'Pessoa sintética' })
    const line = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha sintética' })
    await writeFile(getTimelineDataPath(slug, line.id), '{inválido')
    await expect(repo.getWorld(worldId)).resolves.toHaveProperty('id', worldId)
    await expect(searchEntities(worldId, 'Pessoa sintética')).resolves.toContainEqual(expect.objectContaining({ id: person.id }))
    await expect(repo.getTimeline(worldId, line.id)).rejects.toThrow()
  })

  it('preserva cartões na lixeira e remove todas as repetições de linhas ativas e na lixeira após descarte', async () => {
    const origin = await repo.createOriginEvent(worldId, { type: 'event', title: 'Marco sintético', properties: { eventDate: { start: { year: 0, month: 3, day: 2 } } } })
    const other = await createWorld('Outro mundo sintético')
    const otherBefore = await repo.getWorld(other.id)
    const before = await repo.getWorld(worldId)
    const first = await repo.createEntity(worldId, { type: 'timeline', title: 'Primeira' })
    const second = await repo.createEntity(worldId, { type: 'timeline', title: 'Segunda' })
    let data = await repo.getTimeline(worldId, first.id)
    data = await repo.addTimelineAppearance(worldId, first.id, origin.id, { start: { year: -1 } }, data.updatedAt, { title: 'Título próprio', note: 'Nota própria' })
    data = await repo.addTimelineAppearance(worldId, first.id, origin.id, null, data.updatedAt)
    const secondData = await repo.getTimeline(worldId, second.id)
    await repo.addTimelineAppearance(worldId, second.id, origin.id, null, secondData.updatedAt)
    await repo.deleteEntity(worldId, second.id)
    await repo.deleteEntity(worldId, origin.id)
    expect(await repo.getEntity(worldId, origin.id)).toBeNull()
    expect((await repo.listTrashedEntities(worldId)).some((entity) => entity.id === origin.id)).toBe(true)
    expect(await repo.getTimeline(worldId, first.id)).toEqual(data)
    expect(await repo.getOriginEvent(worldId)).toMatchObject({ id: origin.id, trashed: true })
    await discard(origin.id)
    const cleaned = await repo.getTimeline(worldId, first.id)
    expect(cleaned.appearances).toEqual([])
    expect(cleaned.updatedAt).not.toBe(data.updatedAt)
    expect(await repo.getTimeline(worldId, first.id)).toEqual(cleaned)
    const secondFolder = (await readdir(getTrashDir(slug))).find((name) => name.startsWith(`entity-${second.id}-`))!
    expect(JSON.parse(await readFile(path.join(getTrashDir(slug), secondFolder, 'timeline.json'), 'utf8')).appearances).toEqual([])
    expect(await repo.getOriginEvent(worldId)).toBeNull()
    const after = await repo.getWorld(worldId)
    expect(after.originEventId).toBeUndefined()
    expect(after.calendar).toEqual(before.calendar)
    expect(await repo.getWorld(other.id)).toEqual(otherBefore)
    await expect(repo.restoreTimelineAppearance(worldId, first.id, data.appearances[0], 0, cleaned.updatedAt)).rejects.toThrow()
  })

  it('não remove aparições nem origem quando metadados existem mas estão inválidos ou incompletos', async () => {
    const record = await repo.createOriginEvent(worldId, { type: 'event', title: 'Origem', properties: { eventDate: { start: { year: 0, month: 1, day: 1 } } } })
    const timeline = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha' })
    const initial = await repo.getTimeline(worldId, timeline.id)
    await repo.addTimelineAppearance(worldId, timeline.id, record.id, null, initial.updatedAt)
    const file = getTimelineDataPath(slug, timeline.id)
    const before = await readFile(file, 'utf8')
    const worldBefore = await readFile(getWorldJsonPath(slug), 'utf8')
    await writeFile(getEntityMetadataPath(slug, record.id), '{broken')
    await expect(repo.getTimeline(worldId, timeline.id)).rejects.toThrow()
    await expect(repo.getOriginEvent(worldId)).rejects.toThrow()
    await rm(getEntityMetadataPath(slug, record.id))
    await expect(repo.getTimeline(worldId, timeline.id)).rejects.toThrow()
    expect(await readFile(file, 'utf8')).toBe(before)
    expect(await readFile(getWorldJsonPath(slug), 'utf8')).toBe(worldBefore)
  })

  it('propaga falhas de acesso à lixeira sem limpar referências ausentes do diretório ativo', async () => {
    const record = await repo.createEntity(worldId, { type: 'event', title: 'Registro' })
    const timeline = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha' })
    const data = await repo.getTimeline(worldId, timeline.id)
    await repo.addTimelineAppearance(worldId, timeline.id, record.id, null, data.updatedAt)
    await repo.deleteEntity(worldId, record.id)
    const before = await readFile(getTimelineDataPath(slug, timeline.id), 'utf8')
    const { readdir: original } = await vi.importActual<typeof fs>('node:fs/promises')
    vi.spyOn(fs, 'readdir').mockImplementation((...args: Parameters<typeof fs.readdir>) => {
      if (String(args[0]) === getTrashDir(slug)) return Promise.reject(Object.assign(new Error('Acesso negado'), { code: 'EACCES' }))
      return original(...args)
    })
    await expect(repo.getTimeline(worldId, timeline.id)).rejects.toThrow('Acesso negado')
    await expect(repo.listTrashedEntities(worldId)).rejects.toThrow('Acesso negado')
    expect(await readFile(getTimelineDataPath(slug, timeline.id), 'utf8')).toBe(before)
  })

  it('retoma uma limpeza interrompida entre arquivos sem regravar linhas já limpas', async () => {
    const record = await repo.createEntity(worldId, { type: 'event', title: 'Registro' })
    const lines = await Promise.all(['A', 'B'].map((title) => repo.createEntity(worldId, { type: 'timeline', title })))
    for (const line of lines) {
      const data = await repo.getTimeline(worldId, line.id)
      await repo.addTimelineAppearance(worldId, line.id, record.id, null, data.updatedAt)
    }
    await repo.deleteEntity(worldId, record.id)
    await discard(record.id)
    const original = atomicWrite.atomicWriteJson
    let writes = 0
    const write = vi.spyOn(atomicWrite, 'atomicWriteJson').mockImplementation(async (file, data) => {
      if (++writes === 2) throw new Error('Gravação interrompida')
      return original(file, data)
    })
    await expect(repo.getTimeline(worldId, lines[0].id)).rejects.toThrow('Gravação interrompida')
    write.mockRestore()
    const partial = await Promise.all(lines.map((line) => readFile(getTimelineDataPath(slug, line.id), 'utf8')))
    const cleanedIndex = partial.findIndex((text) => JSON.parse(text).appearances.length === 0)
    expect(cleanedIndex).toBeGreaterThanOrEqual(0)
    expect((await repo.getTimeline(worldId, lines[0].id)).appearances).toEqual([])
    expect((await repo.getTimeline(worldId, lines[1].id)).appearances).toEqual([])
    expect(await readFile(getTimelineDataPath(slug, lines[cleanedIndex].id), 'utf8')).toBe(partial[cleanedIndex])
  })
})
