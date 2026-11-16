import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWorld } from '@/services/worlds/worldLibrary'
import { FileSystemWorldRepository } from './fileSystemWorldRepository'

describe('graph relationship writes', () => {
  let root: string; let repo: FileSystemWorldRepository; let world: string
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'canon-graph-relations-'))
    process.env.WIKI_WORKSPACE_DIR = root; repo = new FileSystemWorldRepository(); world = (await repo.listWorlds())[0].id
  })
  afterEach(async () => { delete process.env.WIKI_WORKSPACE_DIR; await rm(root, { recursive: true, force: true }) })

  it('creates idempotently, updates, derives backlinks and removes idempotently', async () => {
    const a = await repo.createEntity(world, { type: 'character', title: 'A sintético' })
    const b = await repo.createEntity(world, { type: 'location', title: 'B sintético' })
    const id = randomUUID(); const input = { sourceId: a.id, targetId: b.id, type: 'investiga', directional: true, bidirectional: true, metadata: { synthetic: true } }
    const saved = await repo.addRelation(world, a.id, input, id)
    expect(await repo.addRelation(world, a.id, input, id)).toEqual(saved)
    const freshRepo = new FileSystemWorldRepository()
    expect((await freshRepo.getEntity(world, a.id))?.relations).toEqual([saved])
    expect((await freshRepo.getEntity(world, b.id))?.relations).toEqual([])
    expect((await freshRepo.getBacklinks(world, b.id))[0].relation).toEqual(saved)
    await expect(repo.addRelation(world, a.id, { ...input, type: 'protege' }, id)).rejects.toThrow('já foi usada')
    const edited = await repo.updateRelation(world, saved, { type: 'protege', label: 'guarda', directional: false })
    expect(edited.metadata).toEqual({ synthetic: true })
    expect(edited.bidirectional).toBeUndefined()
    expect(await repo.updateRelation(world, saved, { type: 'protege', label: 'guarda', directional: false })).toEqual(edited)
    expect((await repo.getBacklinks(world, b.id))[0].relation).toEqual(edited)
    await expect(repo.removeRelation(world, a.id, id, saved)).rejects.toThrow('outra aba')
    await repo.removeRelation(world, a.id, id, edited)
    await repo.removeRelation(world, a.id, id, edited)
    expect(await repo.getBacklinks(world, b.id)).toEqual([])
  })

  it('rejects invalid endpoints, cross-world targets and stale edits', async () => {
    const other = await createWorld('Outro sintético', '')
    const a = await repo.createEntity(world, { type: 'character', title: 'Origem' })
    const b = await repo.createEntity(world, { type: 'character', title: 'Destino' })
    const foreign = await repo.createEntity(other.id, { type: 'character', title: 'Outro mundo' })
    await expect(repo.addRelation(world, a.id, { sourceId: b.id, targetId: b.id, type: 'x', directional: true })).rejects.toThrow('origem')
    await expect(repo.addRelation(world, a.id, { sourceId: a.id, targetId: foreign.id, type: 'x', directional: true })).rejects.toThrow()
    const original = await repo.addRelation(world, a.id, { sourceId: a.id, targetId: b.id, type: 'x', directional: true })
    await repo.updateRelation(world, original, { type: 'y', directional: false })
    await expect(repo.updateRelation(world, original, { type: 'z', directional: true })).rejects.toThrow('outra aba')
    await repo.deleteEntity(world, b.id)
    await expect(repo.addRelation(world, a.id, { sourceId: a.id, targetId: b.id, type: 'x', directional: true })).rejects.toThrow()
    expect((await repo.getEntity(world, a.id))?.relations).toHaveLength(1)
  })
})
