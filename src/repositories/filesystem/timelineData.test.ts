import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialEventAppearanceDate, orderTimelineAppearances } from '@/domain/timelines/timeline'
import { getTimelineDataPath } from '@/lib/fs/paths'
import * as atomicWrite from '@/lib/fs/atomicWrite'
import { createWorld } from '@/services/worlds/worldLibrary'
import { FileSystemWorldRepository } from './fileSystemWorldRepository'

describe('aparições de Linha do Tempo', () => {
  let temporary: string
  let repo: FileSystemWorldRepository
  let worldId: string

  beforeEach(async () => {
    temporary = await mkdtemp(path.join(tmpdir(), 'canon-timeline-test-'))
    process.env.WIKI_WORKSPACE_DIR = temporary
    repo = new FileSystemWorldRepository()
    worldId = (await repo.listWorlds())[0].id
  })
  afterEach(async () => {
    delete process.env.WIKI_WORKSPACE_DIR
    await rm(temporary, { recursive: true, force: true })
  })

  it('salva a escala padrão de cada tipo apenas no mundo selecionado', async () => {
    const original = await repo.getWorld(worldId)
    const other = await createWorld('Mundo separado para escalas')
    const changed = await repo.updateTimelineScaleDefaults(worldId, { ...original.timelineScaleDefaults, event: 'decade' })
    expect(changed.timelineScaleDefaults.event).toBe('decade')
    expect((await repo.getWorld(worldId)).timelineScaleDefaults.event).toBe('decade')
    expect((await repo.getWorld(other.id)).timelineScaleDefaults.event).toBe('year')
    await expect(repo.updateTimelineScaleDefaults(worldId, { event: 'day' })).rejects.toThrow()
  })

  it('grava documento versionado separado e preserva aparições repetidas e sem data', async () => {
    const timeline = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha sintética' })
    const record = await repo.createEntity(worldId, { type: 'event', title: 'Registro sintético' })
    let data = await repo.getTimeline(worldId, timeline.id)
    expect(data).toMatchObject({ schemaVersion: 2, worldId, timelineId: timeline.id, appearances: [] })
    data = await repo.addTimelineAppearance(worldId, timeline.id, record.id, { start: { year: -2, month: 3, day: 4 } }, data.updatedAt)
    data = await repo.addTimelineAppearance(worldId, timeline.id, record.id, null, data.updatedAt)
    const reopened = await new FileSystemWorldRepository().getTimeline(worldId, timeline.id)
    expect(reopened.appearances).toHaveLength(2)
    expect(reopened.appearances[0].id).not.toBe(reopened.appearances[1].id)
    expect(reopened.appearances.map((appearance) => appearance.entityId)).toEqual([record.id, record.id])
    expect(reopened.appearances[1].date).toBeNull()
    const world = await repo.getWorld(worldId)
    const stored = JSON.parse(await readFile(getTimelineDataPath(world.slug, timeline.id), 'utf8'))
    expect(stored.schemaVersion).toBe(2)
    expect((await repo.getEntity(worldId, record.id))?.title).toBe('Registro sintético')
  })

  it('ordena por primeiro dia possível, desempata por ID e separa sem data', async () => {
    const timeline = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha' })
    const record = await repo.createEntity(worldId, { type: 'character', title: 'Pessoa' })
    let data = await repo.getTimeline(worldId, timeline.id)
    data = await repo.addTimelineAppearance(worldId, timeline.id, record.id, { start: { year: 2 } }, data.updatedAt)
    data = await repo.addTimelineAppearance(worldId, timeline.id, record.id, { start: { year: -1, month: 2 } }, data.updatedAt)
    data = await repo.addTimelineAppearance(worldId, timeline.id, record.id, null, data.updatedAt)
    const sorted = orderTimelineAppearances((await repo.getWorld(worldId)).calendar, data.appearances)
    expect(sorted.dated.map((appearance) => appearance.date?.start.year)).toEqual([-1, 2])
    expect(sorted.undated).toHaveLength(1)
    const tied = orderTimelineAppearances((await repo.getWorld(worldId)).calendar, [
      { id: '00000000-0000-4000-8000-000000000002', entityId: record.id, date: { start: { year: 1 } }, title: null, note: null, minimumScale: null, showCover: true },
      { id: '00000000-0000-4000-8000-000000000001', entityId: record.id, date: { start: { year: 1 } }, title: null, note: null, minimumScale: null, showCover: true },
    ])
    expect(tied.dated[0].id).toBe('00000000-0000-4000-8000-000000000001')
  })

  it('prepara a data inicial de Evento estruturado ou ISO legado para uma nova aparição', async () => {
    const calendar = (await repo.getWorld(worldId)).calendar
    expect(initialEventAppearanceDate(calendar, { start: { year: 3, month: 2 }, end: { year: 4 } })).toEqual({ start: { year: 3, month: 2 }, end: { year: 4 } })
    expect(initialEventAppearanceDate(calendar, '2024-02-29')).toEqual({ start: { year: 2024, month: 2, day: 29 } })
    expect(initialEventAppearanceDate(calendar, null)).toBeNull()
  })

  it('recusa registro de outro mundo e intervalo inválido sem gravar', async () => {
    const timeline = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha' })
    const local = await repo.createEntity(worldId, { type: 'event', title: 'Local' })
    const otherWorld = await createWorld('Mundo externo sintético')
    const foreign = await repo.createEntity(otherWorld.id, { type: 'event', title: 'Externo' })
    const initial = await repo.getTimeline(worldId, timeline.id)
    await expect(repo.addTimelineAppearance(worldId, timeline.id, foreign.id, null, initial.updatedAt)).rejects.toThrow()
    await expect(repo.addTimelineAppearance(worldId, timeline.id, local.id, { start: { year: 2 }, end: { year: 1 } }, initial.updatedAt)).rejects.toThrow()
    expect(await repo.getTimeline(worldId, timeline.id)).toEqual(initial)
  })

  it('serializa inclusões concorrentes e rejeita versão desconhecida', async () => {
    const timeline = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha' })
    const record = await repo.createEntity(worldId, { type: 'event', title: 'Registro' })
    const initial = await repo.getTimeline(worldId, timeline.id)
    const results = await Promise.allSettled([
      repo.addTimelineAppearance(worldId, timeline.id, record.id, null, initial.updatedAt),
      new FileSystemWorldRepository().addTimelineAppearance(worldId, timeline.id, record.id, null, initial.updatedAt),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect((await repo.getTimeline(worldId, timeline.id)).appearances).toHaveLength(1)
    const world = await repo.getWorld(worldId)
    const file = getTimelineDataPath(world.slug, timeline.id)
    const raw = JSON.parse(await readFile(file, 'utf8'))
    await writeFile(file, JSON.stringify({ ...raw, schemaVersion: 99 }))
    await expect(repo.getTimeline(worldId, timeline.id)).rejects.toThrow()
  })

  it('bloqueia alteração estrutural do calendário com aparição datada', async () => {
    const timeline = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha' })
    const record = await repo.createEntity(worldId, { type: 'character', title: 'Pessoa' })
    const initial = await repo.getTimeline(worldId, timeline.id)
    await repo.addTimelineAppearance(worldId, timeline.id, record.id, { start: { year: 2 } }, initial.updatedAt)
    const current = (await repo.getWorld(worldId)).calendar
    const changed = { ...current, months: current.months.map((month, index) => index === 0 ? { ...month, length: month.length + 1 } : month) }
    await expect(repo.updateCalendar(worldId, changed)).rejects.toThrow('1 campo(s) de data')
  })

  it('lê arquivo v1 e o atualiza para v2 sem perder as aparições', async () => {
    const timeline = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha antiga' })
    const record = await repo.createEntity(worldId, { type: 'event', title: 'Registro' })
    const world = await repo.getWorld(worldId)
    const file = getTimelineDataPath(world.slug, timeline.id)
    const raw = JSON.parse(await readFile(file, 'utf8'))
    const old = { ...raw, schemaVersion: 1, appearances: [{ id: '00000000-0000-4000-8000-000000000001', entityId: record.id, date: { start: { year: -3 } } }] }
    await writeFile(file, JSON.stringify(old))
    const migrated = await repo.getTimeline(worldId, timeline.id)
    expect(migrated.appearances[0]).toMatchObject({ title: null, note: null, minimumScale: null, showCover: true })
    expect(JSON.parse(await readFile(file, 'utf8')).schemaVersion).toBe(1)
    await repo.addTimelineAppearance(worldId, timeline.id, record.id, null, migrated.updatedAt)
    expect(JSON.parse(await readFile(file, 'utf8')).schemaVersion).toBe(2)
    expect((await repo.getTimeline(worldId, timeline.id)).appearances).toHaveLength(2)
  })

  it('mantém cartões independentes do registro e entre si após edição e reabertura', async () => {
    const timeline = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha' })
    const event = await repo.createEntity(worldId, { type: 'event', title: 'Evento', properties: { eventDate: { start: { year: 5 } } } })
    let data = await repo.getTimeline(worldId, timeline.id)
    data = await repo.addTimelineAppearance(worldId, timeline.id, event.id, { start: { year: 5 } }, data.updatedAt)
    data = await repo.addTimelineAppearance(worldId, timeline.id, event.id, { start: { year: 7 } }, data.updatedAt)
    const first = data.appearances[0]
    data = await repo.updateTimelineAppearance(worldId, timeline.id, first.id,
      { title: 'Outro título', note: 'Nota sintética', date: { start: { year: 4 }, end: { year: 6 } }, minimumScale: 'month', showCover: false }, data.updatedAt)
    const reopened = await new FileSystemWorldRepository().getTimeline(worldId, timeline.id)
    expect(reopened.appearances[0]).toMatchObject({ title: 'Outro título', note: 'Nota sintética', minimumScale: 'month', showCover: false, date: { start: { year: 4 }, end: { year: 6 } } })
    expect(reopened.appearances[1].date).toEqual({ start: { year: 7 } })
    expect((await repo.getEntity(worldId, event.id))?.properties.eventDate).toEqual({ start: { year: 5 } })
    await expect(repo.updateTimelineAppearance(worldId, timeline.id, first.id, { title: null, note: null, date: null, minimumScale: null, showCover: true }, data.updatedAt)).resolves.toBeDefined()
    await expect(repo.updateTimelineAppearance(worldId, timeline.id, first.id, { title: null, note: null, date: null, minimumScale: null, showCover: true }, data.updatedAt)).rejects.toThrow('mudou')
  })

  it('cria Evento e aparição juntos e recusa entradas inválidas sem associação parcial', async () => {
    const timeline = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha' })
    const initial = await repo.getTimeline(worldId, timeline.id)
    await expect(repo.createTimelineEvent(worldId, timeline.id, '', { start: { year: 2 } }, initial.updatedAt)).rejects.toThrow()
    await expect(repo.createTimelineEvent(worldId, timeline.id, 'Inválido', { start: { year: 2 }, end: { year: 1 } }, initial.updatedAt)).rejects.toThrow()
    expect((await repo.listEntities(worldId, { type: 'event' })).filter((event) => ['Inválido'].includes(event.title))).toHaveLength(0)
    expect(await repo.getTimeline(worldId, timeline.id)).toEqual(initial)
    const created = await repo.createTimelineEvent(worldId, timeline.id, 'Novo Evento', { start: { year: 2, month: 3, day: 4 } }, initial.updatedAt)
    expect(created.timeline.appearances.at(-1)?.entityId).toBe(created.entity.id)
    expect(created.timeline.appearances.at(-1)?.date).toEqual(created.entity.properties.eventDate)
    expect((await repo.getEntity(worldId, created.entity.id))?.title).toBe('Novo Evento')
    await repo.updateEntity(worldId, created.entity.id, { properties: { eventDate: { start: { year: 8 } } } })
    expect((await repo.getTimeline(worldId, timeline.id)).appearances.at(-1)?.date).toEqual({ start: { year: 2, month: 3, day: 4 } })
  })

  it('desfaz o Evento novo quando a gravação da aparição falha', async () => {
    const timeline = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha' })
    const initial = await repo.getTimeline(worldId, timeline.id)
    const world = await repo.getWorld(worldId)
    const file = getTimelineDataPath(world.slug, timeline.id)
    const originalWrite = atomicWrite.atomicWriteJson
    const spy = vi.spyOn(atomicWrite, 'atomicWriteJson').mockImplementation(async (target, value) => {
      if (target === file && typeof value === 'object' && value !== null && 'appearances' in value && Array.isArray(value.appearances) && value.appearances.length > 0) {
        throw new Error('falha sintética de gravação')
      }
      return originalWrite(target, value)
    })
    try {
      await expect(repo.createTimelineEvent(worldId, timeline.id, 'Evento falho', { start: { year: 2 } }, initial.updatedAt)).rejects.toThrow('falha sintética')
    } finally { spy.mockRestore() }
    expect((await repo.listEntities(worldId, { type: 'event' })).some((event) => event.title === 'Evento falho')).toBe(false)
    expect(await repo.getTimeline(worldId, timeline.id)).toEqual(initial)
  })

  it('adiciona todos os ativos uma vez e permite duplicação individual posterior', async () => {
    const timeline = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha' })
    const event = await repo.createEntity(worldId, { type: 'event', title: 'Evento', properties: { eventDate: { start: { year: 2 } } } })
    const undated = await repo.createEntity(worldId, { type: 'character', title: 'Pessoa' })
    const trashed = await repo.createEntity(worldId, { type: 'location', title: 'Na lixeira' })
    await repo.deleteEntity(worldId, trashed.id)
    const initial = await repo.getTimeline(worldId, timeline.id)
    const first = await repo.addAllTimelineAppearances(worldId, timeline.id, initial.updatedAt)
    expect(first.added).toBe(3) // A própria linha também é um registro ativo.
    expect(first.timeline.appearances.some((appearance) => appearance.entityId === trashed.id)).toBe(false)
    expect(first.timeline.appearances.find((appearance) => appearance.entityId === event.id)?.date).toEqual({ start: { year: 2 } })
    expect(first.timeline.appearances.find((appearance) => appearance.entityId === undated.id)?.date).toBeNull()
    const repeated = await repo.addAllTimelineAppearances(worldId, timeline.id, first.timeline.updatedAt)
    expect(repeated.added).toBe(0)
    expect(repeated.timeline).toEqual(first.timeline)
    const duplicated = await repo.addTimelineAppearance(worldId, timeline.id, event.id, null, repeated.timeline.updatedAt)
    expect(duplicated.appearances.filter((appearance) => appearance.entityId === event.id)).toHaveLength(2)
  })

  it('remove uma aparição e desfaz com ID e campos intactos, isolando mundos', async () => {
    const timeline = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha' })
    const record = await repo.createEntity(worldId, { type: 'event', title: 'Registro' })
    const otherWorld = await createWorld('Outro mundo sintético')
    const foreign = await repo.createEntity(otherWorld.id, { type: 'event', title: 'Externo' })
    let data = await repo.getTimeline(worldId, timeline.id)
    data = await repo.addTimelineAppearance(worldId, timeline.id, record.id, { start: { year: 3 } }, data.updatedAt, { title: 'Cartão', note: 'Nota' })
    data = await repo.addTimelineAppearance(worldId, timeline.id, record.id, null, data.updatedAt)
    const first = data.appearances[0]
    const removal = await repo.removeTimelineAppearance(worldId, timeline.id, first.id, data.updatedAt)
    expect(removal.timeline.appearances).toHaveLength(1)
    expect(removal.removed).toEqual(first)
    await expect(repo.restoreTimelineAppearance(worldId, timeline.id, { ...first, entityId: foreign.id }, removal.index, removal.timeline.updatedAt)).rejects.toThrow()
    expect(await repo.getTimeline(worldId, timeline.id)).toEqual(removal.timeline)
    const restored = await repo.restoreTimelineAppearance(worldId, timeline.id, removal.removed, removal.index, removal.timeline.updatedAt)
    expect(restored.appearances).toEqual(data.appearances)
    await expect(repo.restoreTimelineAppearance(worldId, timeline.id, removal.removed, removal.index, removal.timeline.updatedAt)).rejects.toThrow('mudou')
  })

  it('desfaz a remoção de um cartão cujo registro original já está na lixeira', async () => {
    const timeline = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha' })
    const record = await repo.createEntity(worldId, { type: 'event', title: 'Arquivado' })
    let data = await repo.getTimeline(worldId, timeline.id)
    data = await repo.addTimelineAppearance(worldId, timeline.id, record.id, null, data.updatedAt)
    await repo.deleteEntity(worldId, record.id)
    const removal = await repo.removeTimelineAppearance(worldId, timeline.id, data.appearances[0].id, data.updatedAt)
    const restored = await repo.restoreTimelineAppearance(worldId, timeline.id, removal.removed, removal.index, removal.timeline.updatedAt)
    expect(restored.appearances).toEqual(data.appearances)
  })
})
