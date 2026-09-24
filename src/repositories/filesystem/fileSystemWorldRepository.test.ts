import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ConcurrentModificationError,
  EntityNotFoundError,
  FileSystemWorldRepository,
} from '@/repositories/filesystem/fileSystemWorldRepository'
import { getTrashDir } from '@/lib/fs/paths'

describe('FileSystemWorldRepository', () => {
  let workspaceDir: string
  let repo: FileSystemWorldRepository
  let worldId: string

  beforeEach(async () => {
    workspaceDir = await mkdtemp(path.join(tmpdir(), 'wiki-repo-test-'))
    process.env.WIKI_WORKSPACE_DIR = workspaceDir
    repo = new FileSystemWorldRepository()
    const [world] = await repo.listWorlds()
    worldId = world.id
  })

  afterEach(async () => {
    delete process.env.WIKI_WORKSPACE_DIR
    await rm(workspaceDir, { recursive: true, force: true })
  })

  it('seeds a default world with all preconfigured entity types', async () => {
    const worlds = await repo.listWorlds()
    expect(worlds).toHaveLength(1)
    expect(worlds[0].entityTypes).toHaveLength(17)
    expect(worlds[0].entityTypes.map((type) => type.id)).toEqual(expect.arrayContaining(['character', 'tale', 'cosmology', 'species', 'naturalScience']))
  })

  it('creates and reads back an entity', async () => {
    const created = await repo.createEntity(worldId, {
      type: 'character',
      title: 'Amadeus Klein',
      aliases: ['Klein'],
      tags: ['investigador'],
      properties: { species: 'Humano' },
    })

    expect(created.id).toBeTruthy()
    expect(created.slug).toBe('amadeus-klein')
    expect(created.relations).toEqual([])

    const fetched = await repo.getEntity(worldId, created.id)
    expect(fetched).toEqual(created)
  })

  it('round-trips one calendar per world without leaking changes between worlds', async () => {
    const second = await repo.updateCalendar(worldId, {
      ...(await repo.getWorld(worldId)).calendar,
      hoursPerDay: 30,
      origin: { name: 'Marco Sintético', month: 3, day: 4 },
    })

    expect(second.calendar.hoursPerDay).toBe(30)
    expect((await repo.getWorld(worldId)).calendar.origin.name).toBe('Marco Sintético')
  })

  it('persists character themes across creation and unrelated edits', async () => {
    const entity = await repo.createEntity(worldId, {
      type: 'character', title: 'Val', theme: 'green', properties: { age: 25 },
    })
    expect((await repo.getEntity(worldId, entity.id))?.theme).toBe('green')
    await repo.updateEntity(worldId, entity.id, { theme: 'violet' })
    await repo.updateEntity(worldId, entity.id, { title: 'Valentina' })
    expect(await repo.getEntity(worldId, entity.id)).toMatchObject({
      title: 'Valentina', theme: 'violet', properties: { age: 25 },
    })
  })

  it('returns null for a missing entity instead of throwing', async () => {
    expect(await repo.getEntity(worldId, crypto.randomUUID())).toBeNull()
  })

  it('updates an entity, recomputing the slug when the title changes', async () => {
    const entity = await repo.createEntity(worldId, { type: 'character', title: 'Old Name' })

    const updated = await repo.updateEntity(worldId, entity.id, { title: 'New Name' })

    expect(updated.title).toBe('New Name')
    expect(updated.slug).toBe('new-name')
    expect(updated.id).toBe(entity.id)
    expect(updated.updatedAt).not.toBe(entity.updatedAt)
  })

  it('removes an existing cover image explicitly', async () => {
    const coverAssetId = crypto.randomUUID()
    const entity = await repo.createEntity(worldId, {
      type: 'tale',
      title: 'Sem capa',
      coverAssetId,
    })

    const updated = await repo.updateEntity(worldId, entity.id, { coverAssetId: null })

    expect(updated.coverAssetId).toBeUndefined()
    expect((await repo.getEntity(worldId, entity.id))?.coverAssetId).toBeUndefined()
  })

  it('rejects a concurrent update when expectedUpdatedAt is stale', async () => {
    const entity = await repo.createEntity(worldId, { type: 'character', title: 'Amadeus' })

    await expect(
      repo.updateEntity(worldId, entity.id, {
        title: 'Someone else won the race',
        expectedUpdatedAt: '1999-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(ConcurrentModificationError)
  })

  it('throws EntityNotFoundError when updating a missing entity', async () => {
    await expect(repo.updateEntity(worldId, crypto.randomUUID(), { title: 'x' })).rejects.toThrow(EntityNotFoundError)
  })

  it('soft-deletes an entity into trash/ instead of erasing it', async () => {
    const entity = await repo.createEntity(worldId, { type: 'character', title: 'Doomed' })

    await repo.deleteEntity(worldId, entity.id)

    expect(await repo.getEntity(worldId, entity.id)).toBeNull()
    const worldDir = (await readdir(path.join(workspaceDir, 'worlds')))[0]
    const trashEntries = await readdir(getTrashDir(worldDir))
    expect(trashEntries.some((name) => name.includes(entity.id))).toBe(true)
  })

  it('round-trips content and defaults to an empty document', async () => {
    const entity = await repo.createEntity(worldId, { type: 'character', title: 'Amadeus' })

    const defaultDoc = await repo.getContent(worldId, entity.id)
    expect(defaultDoc.format).toBe('tiptap-json')

    const customDoc = {
      format: 'tiptap-json' as const,
      schemaVersion: 2,
      pages: [
        { id: 'lore', title: 'Lore', body: { type: 'doc', content: [] } },
        { id: 'tecnica', title: 'Técnica', body: { type: 'doc', content: [{ type: 'paragraph' }] } },
      ],
    }
    await repo.saveContent(worldId, entity.id, customDoc)

    expect(await repo.getContent(worldId, entity.id)).toEqual(customDoc)
  })

  it('manages relations and computes backlinks by scanning targetId', async () => {
    const amadeus = await repo.createEntity(worldId, { type: 'character', title: 'Amadeus Klein' })
    const leo = await repo.createEntity(worldId, { type: 'character', title: 'Leo' })

    const relation = await repo.addRelation(worldId, amadeus.id, {
      sourceId: amadeus.id,
      targetId: leo.id,
      type: 'knows',
      directional: false,
    })

    const withRelation = await repo.getEntity(worldId, amadeus.id)
    expect(withRelation?.relations).toEqual([relation])

    const backlinks = await repo.getBacklinks(worldId, leo.id)
    expect(backlinks).toHaveLength(1)
    expect(backlinks[0].entity.id).toBe(amadeus.id)
    expect(backlinks[0].relation.id).toBe(relation.id)

    await repo.removeRelation(worldId, amadeus.id, relation.id)
    expect((await repo.getEntity(worldId, amadeus.id))?.relations).toEqual([])
    expect(await repo.getBacklinks(worldId, leo.id)).toEqual([])
  })

  it('keeps relations and backlinks intact after the target entity is renamed', async () => {
    const amadeus = await repo.createEntity(worldId, { type: 'character', title: 'Amadeus Klein' })
    const leo = await repo.createEntity(worldId, { type: 'character', title: 'Leo' })
    await repo.addRelation(worldId, amadeus.id, {
      sourceId: amadeus.id,
      targetId: leo.id,
      type: 'knows',
      directional: false,
    })

    await repo.updateEntity(worldId, leo.id, { title: 'Leonardo' })

    const backlinks = await repo.getBacklinks(worldId, leo.id)
    expect(backlinks).toHaveLength(1)
    expect(backlinks[0].entity.id).toBe(amadeus.id)
  })

  it('lists entities filtered by type and tag', async () => {
    await repo.createEntity(worldId, { type: 'character', title: 'A', tags: ['ally'] })
    await repo.createEntity(worldId, { type: 'character', title: 'B', tags: ['rival'] })
    await repo.createEntity(worldId, { type: 'location', title: 'C' })

    expect(await repo.listEntities(worldId, { type: 'location' })).toHaveLength(1)
    expect(await repo.listEntities(worldId, { tag: 'ally' })).toHaveLength(1)
    expect(await repo.listEntities(worldId)).toHaveLength(3)
  })
})
