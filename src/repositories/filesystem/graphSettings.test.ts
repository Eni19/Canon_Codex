import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { FileSystemWorldRepository } from './fileSystemWorldRepository'
import { createWorld } from '@/services/worlds/worldLibrary'

describe('graph settings persistence', () => {
  let root: string
  let repo: FileSystemWorldRepository
  let worldId: string
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'canon-graph-test-'))
    process.env.WIKI_WORKSPACE_DIR = root
    repo = new FileSystemWorldRepository()
    worldId = (await repo.listWorlds())[0].id
  })
  afterEach(async () => { delete process.env.WIKI_WORKSPACE_DIR; await rm(root, { recursive: true, force: true }) })

  it('persists positions and preferences, isolates worlds, and permits identical retries', async () => {
    const other = await createWorld('Mundo sintético', '')
    const initial = await repo.getGraphSettings(worldId)
    const id = randomUUID()
    const edited = { ...initial, positions: { [id]: { x: -12, y: 34 } }, preferences: { type: 'character', relationType: 'investiga' } }
    const saved = await repo.saveGraphSettings(worldId, edited)
    expect(saved.revision).toBe(1)
    expect(await repo.getGraphSettings(worldId)).toEqual(saved)
    expect(await repo.saveGraphSettings(worldId, edited)).toEqual(saved)
    expect((await repo.getGraphSettings(other.id)).positions).toEqual({})
    await expect(repo.saveGraphSettings(other.id, edited)).rejects.toThrow('mundo ativo mudou')
  })

  it('rejects stale conflicting writes but preserves the first save', async () => {
    const initial = await repo.getGraphSettings(worldId)
    const first = { ...initial, positions: { [randomUUID()]: { x: 10, y: 20 } } }
    const second = { ...initial, positions: { [randomUUID()]: { x: 30, y: 40 } } }
    const saved = await repo.saveGraphSettings(worldId, first)
    await expect(repo.saveGraphSettings(worldId, second)).rejects.toThrow('outra aba')
    expect(await repo.getGraphSettings(worldId)).toEqual(saved)
    expect((await repo.saveGraphSettings(worldId, { ...saved, positions: {} })).positions).toEqual({})
  })

  it('propagates read errors and allows a retry after the obstacle is removed', async () => {
    const initial = await repo.getGraphSettings(worldId)
    const file = path.join(root, 'worlds', 'paranormal', 'relationship-graph.json')
    await mkdir(file)
    await expect(repo.saveGraphSettings(worldId, { ...initial, positions: { [randomUUID()]: { x: 1, y: 2 } } })).rejects.toThrow()
    await rm(file, { recursive: true })
    expect((await repo.saveGraphSettings(worldId, { ...initial, positions: { [randomUUID()]: { x: 1, y: 2 } } })).revision).toBe(1)
  })

  it('reads version 1 without rewriting it and saves its styles in version 4', async () => {
    const initial = await repo.getGraphSettings(worldId)
    const file = path.join(root, 'worlds', 'paranormal', 'relationship-graph.json')
    const legacy = { schemaVersion: 1, worldId, revision: 3, positions: initial.positions, preferences: initial.preferences }
    await writeFile(file, JSON.stringify(legacy))
    const migrated = await repo.getGraphSettings(worldId)
    expect(migrated).toMatchObject({ schemaVersion: 4, revision: 3, styles: [], annotations: [], folders: [] })
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(legacy)
    const style = { type: 'investiga', color: '#a64b39', stroke: 'dashed' as const, tip: 'triangle' as const, symbol: 'none' as const, meaning: 'Procura pistas', hidden: false }
    const saved = await repo.saveGraphSettings(worldId, { ...migrated, styles: [style] })
    expect(saved.revision).toBe(4)
    expect(await repo.getGraphSettings(worldId)).toEqual(saved)
  })
  it('upgrades version 2 in memory and persists free arrows', async () => {
    const initial = await repo.getGraphSettings(worldId)
    const file = path.join(root, 'worlds', 'paranormal', 'relationship-graph.json')
    const legacy = { schemaVersion: 2, worldId, revision: 2, positions: initial.positions, preferences: initial.preferences, styles: [] }
    await writeFile(file, JSON.stringify(legacy))
    const read = await repo.getGraphSettings(worldId)
    expect(read.annotations).toEqual([])
    const arrow = { id: randomUUID(), start: { x: 1, y: 2 }, end: { x: 3, y: 4 }, color: '#a64b39', stroke: 'dashed' as const }
    const saved = await repo.saveGraphSettings(worldId, { ...read, annotations: [arrow] })
    expect((await repo.getGraphSettings(worldId)).annotations).toEqual([arrow])
    expect(saved.schemaVersion).toBe(4)
    const anchored = { ...arrow, startCardId: randomUUID(), endCardId: randomUUID() }
    await repo.saveGraphSettings(worldId, { ...saved, annotations: [arrow, { ...anchored, id: randomUUID() }] })
    const [legacyArrow, attachedArrow] = (await repo.getGraphSettings(worldId)).annotations
    expect(legacyArrow).toEqual(arrow)
    expect(attachedArrow).toMatchObject({ startCardId: anchored.startCardId, endCardId: anchored.endCardId })
  })

  it('migrates a version 3 view and persists mixed folders without changing records or links', async () => {
    const person = await repo.createEntity(worldId, { type: 'character', title: 'Pessoa sintética' })
    const event = await repo.createEntity(worldId, { type: 'event', title: 'Evento sintético' })
    const other = await createWorld('Outro mundo sintético', '')
    const place = await repo.createEntity(other.id, { type: 'location', title: 'Lugar de outro mundo' })
    const link = await repo.addRelation(worldId, person.id, { sourceId: person.id, targetId: event.id, type: 'presenciou', directional: true })
    const positions = { [person.id]: { x: 120, y: 36 } }
    const legacy = { schemaVersion: 3, worldId, revision: 2, positions, preferences: { type: '', relationType: '' }, styles: [], annotations: [] }
    const file = path.join(root, 'worlds', 'paranormal', 'relationship-graph.json')
    await writeFile(file, JSON.stringify(legacy))
    const initial = await repo.getGraphSettings(worldId)
    expect(initial).toMatchObject({ ...legacy, schemaVersion: 4, folders: [] })
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(legacy)
    const folder = { id: randomUUID(), name: 'Investigação', collapsed: true, members: [person.id, event.id] }
    const saved = await repo.saveGraphSettings(worldId, { ...initial, folders: [folder] })
    expect((await new FileSystemWorldRepository().getGraphSettings(worldId)).folders).toEqual([folder])
    expect((await repo.getGraphSettings(other.id)).folders).toEqual([])
    await expect(repo.saveGraphSettings(worldId, { ...saved, folders: [{ ...folder, members: [...folder.members, place.id] }] })).rejects.toThrow('neste mundo')
    const removed = await repo.saveGraphSettings(worldId, { ...saved, folders: [] })
    expect(removed).toMatchObject({ positions, folders: [] })
    expect((await repo.getEntity(worldId, person.id))?.relations).toContainEqual(link)
    await repo.saveGraphSettings(worldId, { ...removed, folders: [folder] })
    await repo.deleteEntity(worldId, event.id)
    const trashed = await repo.getGraphSettings(worldId)
    expect((await repo.saveGraphSettings(worldId, { ...trashed, folders: [{ ...folder, collapsed: false }] })).folders[0].members).toContain(event.id)
  })
})
