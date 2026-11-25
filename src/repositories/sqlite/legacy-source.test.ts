import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import { atomicWriteJson, atomicWriteText } from '@/lib/fs/atomicWrite'
import { buildNewEntity } from '@/repositories/filesystem/entityCreation'
import { SqliteDatabase } from './database'
import { readLegacySource } from './legacy-source'
import { SqliteWorldRepository } from './sqliteWorldRepository'

describe('readLegacySource', () => {
  let project: string

  beforeEach(async () => { project = await mkdtemp(path.join(tmpdir(), 'canon-legacy-fixture-')) })
  afterEach(async () => { await rm(project, { recursive: true, force: true }) })

  it('reads active worlds for folder import and includes world trash for library migration', async () => {
    const root = path.join(project, 'workspace')
    const world = { ...createDefaultWorldSeed(), id: crypto.randomUUID(), slug: 'sintetico' }
    const deleted = { ...createDefaultWorldSeed(), id: crypto.randomUUID(), slug: 'apagado' }
    const worldDir = path.join(root, 'worlds', 'copied-folder')
    const removedAt = 1726056000000
    await atomicWriteJson(path.join(worldDir, 'world.json'), world)
    await atomicWriteJson(path.join(root, 'trash', 'worlds', `${deleted.slug}-${removedAt}`, 'world.json'), deleted)

    const timeline = buildNewEntity(world.id, { type: 'timeline', title: 'Linha sintética' })
    const appearance = { id: crypto.randomUUID(), entityId: timeline.id, date: null }
    const entityDir = path.join(worldDir, 'trash', `entity-${timeline.id}-${removedAt}`)
    await atomicWriteJson(path.join(entityDir, 'metadata.json'), { ...timeline, schemaVersion: 3 })
    await atomicWriteJson(path.join(entityDir, 'content.json'), { format: 'tiptap-json', schemaVersion: 1, body: { type: 'doc' } })
    await atomicWriteJson(path.join(entityDir, 'timeline.json'), {
      schemaVersion: 1, worldId: world.id, timelineId: timeline.id, updatedAt: timeline.updatedAt, appearances: [appearance],
    })

    const assetId = crypto.randomUUID()
    const assetDir = path.join(worldDir, 'assets', assetId)
    const original = '<svg/>'
    await atomicWriteJson(path.join(assetDir, 'asset.json'), {
      schemaVersion: 1, id: assetId, worldId: world.id, originalFilename: 'image.svg', mimeType: 'image/svg+xml',
      sizeBytes: Buffer.byteLength(original), hasThumbnail: true, createdAt: world.createdAt,
    })
    await atomicWriteText(path.join(assetDir, 'original.svg'), original)
    await atomicWriteText(path.join(assetDir, 'thumbnail.webp'), 'synthetic thumbnail')
    await atomicWriteText(path.join(assetDir, 'calendar-desktop.webp'), 'synthetic derivative')

    const activeWorlds = await readLegacySource(project, 'folder')
    expect(activeWorlds.map(({ world }) => world.id)).toEqual([world.id])
    const [active] = activeWorlds
    expect(active.entities).toMatchObject([{
      entity: { id: timeline.id, schemaVersion: 4 },
      deletedAt: new Date(removedAt).toISOString(),
      content: { schemaVersion: 2, pages: [{ body: { type: 'doc' } }] },
      timeline: { schemaVersion: 2, appearances: [appearance] },
    }])
    expect(active.assets[0].variants).toMatchObject([
      { variant: 'original', mimeType: 'image/svg+xml' },
      { variant: 'thumbnail', mimeType: 'image/webp' },
      { variant: 'calendar-desktop', mimeType: 'image/webp' },
    ])
    const [variant] = active.assets[0].variants
    expect(variant).not.toHaveProperty('bytes')
    expect(variant.readBytes()).toEqual(new TextEncoder().encode(original))
    const library = await readLegacySource(root, 'library')
    expect(library.map(({ world, deletedAt }) => [world.id, deletedAt]))
      .toEqual([[world.id, null], [deleted.id, new Date(removedAt).toISOString()]])

    await atomicWriteText(path.join(assetDir, 'original.svg'), '<gvg/>')
    const db = new SqliteDatabase(':memory:')
    try {
      expect(() => new SqliteWorldRepository(db).importWorlds(library, true)).toThrow('A variante mudou')
      expect(db.connection.prepare('SELECT count(*) AS count FROM worlds').get()?.count).toBe(0)
    } finally {
      db.close()
    }
  })

  it('rejects duplicate records and identifies the conflicting directories', async () => {
    const world = createDefaultWorldSeed()
    const entity = buildNewEntity(world.id, { type: 'event', title: 'Evento sintético' })
    await atomicWriteJson(path.join(project, 'world.json'), world)
    await atomicWriteJson(path.join(project, 'entities', entity.id, 'metadata.json'), entity)
    await atomicWriteJson(path.join(project, 'trash', `entity-${entity.id}-1726056000000`, 'metadata.json'), entity)
    await expect(readLegacySource(project, 'folder')).rejects.toThrow(/trash.*duplicado.*entities/)
  })

  it.each(['date-migrations', 'origin-backups'])('rejects interrupted operations in %s', async (folder) => {
    const world = createDefaultWorldSeed()
    await atomicWriteJson(path.join(project, 'world.json'), world)
    await atomicWriteJson(path.join(project, folder, `${crypto.randomUUID()}.json`), { worldId: world.id, state: 'applying' })
    await expect(readLegacySource(project, 'folder')).rejects.toThrow('operação de calendário pendente')
  })
})
