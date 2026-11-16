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

  it('reads version 1 without rewriting it and saves its styles in version 3', async () => {
    const initial = await repo.getGraphSettings(worldId)
    const file = path.join(root, 'worlds', 'paranormal', 'relationship-graph.json')
    const legacy = { schemaVersion: 1, worldId, revision: 3, positions: initial.positions, preferences: initial.preferences }
    await writeFile(file, JSON.stringify(legacy))
    const migrated = await repo.getGraphSettings(worldId)
    expect(migrated).toMatchObject({ schemaVersion: 3, revision: 3, styles: [], annotations: [] })
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
    expect(saved.schemaVersion).toBe(3)
  })
})
