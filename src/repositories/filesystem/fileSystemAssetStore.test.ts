import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getTrashDir } from '@/lib/fs/paths'
import { FileSystemAssetStore, UnsupportedImageTypeError } from '@/repositories/filesystem/fileSystemAssetStore'
import { FileSystemWorldRepository } from '@/repositories/filesystem/fileSystemWorldRepository'

async function makeTestPng(): Promise<Buffer> {
  return sharp({ create: { width: 20, height: 10, channels: 3, background: { r: 200, g: 20, b: 20 } } })
    .png()
    .toBuffer()
}

describe('FileSystemAssetStore', () => {
  let workspaceDir: string
  let store: FileSystemAssetStore
  let worldId: string

  beforeEach(async () => {
    workspaceDir = await mkdtemp(path.join(tmpdir(), 'wiki-asset-test-'))
    process.env.WIKI_WORKSPACE_DIR = workspaceDir
    store = new FileSystemAssetStore()
    const [world] = await new FileSystemWorldRepository().listWorlds()
    worldId = world.id
  })

  afterEach(async () => {
    delete process.env.WIKI_WORKSPACE_DIR
    await rm(workspaceDir, { recursive: true, force: true })
  })

  it('imports from a buffer, generating a thumbnail and metadata', async () => {
    const png = await makeTestPng()

    const asset = await store.importFromBuffer(worldId, png, 'amadeus.png', 'image/png')

    expect(asset.mimeType).toBe('image/png')
    expect(asset.width).toBe(20)
    expect(asset.height).toBe(10)
    expect(asset.hasThumbnail).toBe(true)
    expect(asset.sizeBytes).toBe(png.byteLength)

    expect(await store.getVariant(worldId, asset.id, 'original')).toEqual({ bytes: png, mimeType: 'image/png' })
    const thumbnail = await store.getVariant(worldId, asset.id, 'thumbnail')
    expect(thumbnail?.mimeType).toBe('image/webp')
    expect((await sharp(thumbnail!.bytes).metadata()).format).toBe('webp')
  })

  it('imports from a source path by copying it, leaving the source untouched', async () => {
    const png = await makeTestPng()
    const sourceDir = await mkdtemp(path.join(tmpdir(), 'wiki-source-'))
    const sourcePath = path.join(sourceDir, 'Amadeus Final (2).png')
    await writeFile(sourcePath, png)

    const asset = await store.importFromPath(worldId, sourcePath)

    expect(asset.originalFilename).toBe('Amadeus Final (2).png')
    expect(await store.getVariant(worldId, asset.id, 'original')).toEqual({ bytes: png, mimeType: 'image/png' })
    expect(await readFile(sourcePath)).toEqual(png) // source preserved, never moved

    await rm(sourceDir, { recursive: true, force: true })
  })

  it('rejects unsupported file types', async () => {
    await expect(store.importFromBuffer(worldId, Buffer.from('not an image'), 'notes.txt', 'text/plain')).rejects.toThrow(
      UnsupportedImageTypeError,
    )
  })

  it('returns null from getAsset/getVariant for an unknown asset', async () => {
    expect(await store.getAsset(worldId, crypto.randomUUID())).toBeNull()
    expect(await store.getVariant(worldId, crypto.randomUUID(), 'original')).toBeNull()
  })

  it('soft-deletes an asset into trash/', async () => {
    const asset = await store.importFromBuffer(worldId, await makeTestPng(), 'a.png', 'image/png')

    await store.removeAsset(worldId, asset.id)

    expect(await store.getAsset(worldId, asset.id)).toBeNull()
    const worldDir = (await readdir(path.join(workspaceDir, 'worlds')))[0]
    const trashEntries = await readdir(getTrashDir(worldDir))
    expect(trashEntries.some((name) => name.includes(asset.id))).toBe(true)
  })

  it('preserves backgrounds referenced by any saved calendar theme', async () => {
    const repo = new FileSystemWorldRepository()
    const world = await repo.getWorld(worldId)
    const asset = await store.importFromBuffer(worldId, await makeTestPng(), 'synthetic.png', 'image/png')
    const theme = { id: crypto.randomUUID(), name: 'Tema sintético', base: 'codex' as const, colors: { text: '#ffffff', accent: '#ccaa00', surface: '#111111', border: '#999999' }, backgroundAssetId: asset.id, focalPoint: { x: 0.5, y: 0.5 }, overlayOpacity: 0.5 }
    const appearance = { activeTheme: 'codex', customThemes: [theme] }
    await expect(repo.updateCalendarAppearance(worldId, { activeTheme: 'codex', customThemes: [{ ...theme, backgroundAssetId: crypto.randomUUID() }] }, JSON.stringify(world.calendarAppearance))).rejects.toThrow('não existe neste mundo')
    await repo.updateCalendarAppearance(worldId, appearance, JSON.stringify(world.calendarAppearance))
    await store.removeAsset(worldId, asset.id)
    expect(await store.getAsset(worldId, asset.id)).not.toBeNull()
    await expect(repo.updateCalendarAppearance(worldId, appearance, JSON.stringify(world.calendarAppearance))).rejects.toThrow('mudaram')
    await repo.updateCalendarAppearance(worldId, { activeTheme: 'codex', customThemes: [] }, JSON.stringify(appearance))
    await store.removeAsset(worldId, asset.id)
    expect(await store.getAsset(worldId, asset.id)).toBeNull()
  })

  it('imports both calendar background variants with the original', async () => {
    const asset = await store.importFromBuffer(worldId, await makeTestPng(), 'synthetic.png', 'image/png', 'calendar-background')
    for (const name of ['calendar-mobile', 'calendar-desktop'] as const) {
      const variant = await store.getVariant(worldId, asset.id, name)
      expect(variant?.mimeType).toBe('image/webp')
      expect((await sharp(variant!.bytes).metadata()).format).toBe('webp')
    }
  })
})
