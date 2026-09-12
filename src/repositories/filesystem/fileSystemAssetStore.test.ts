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

    const originalPath = await store.getVariantPath(worldId, asset.id, 'original')
    const thumbnailPath = await store.getVariantPath(worldId, asset.id, 'thumbnail')
    expect(originalPath).toMatch(/original\.png$/)
    expect(thumbnailPath).toMatch(/thumbnail\.webp$/)
    expect(await readFile(originalPath!)).toEqual(png)
    await expect(readFile(thumbnailPath!)).resolves.toBeInstanceOf(Buffer)
  })

  it('imports from a source path by copying it, leaving the source untouched', async () => {
    const png = await makeTestPng()
    const sourceDir = await mkdtemp(path.join(tmpdir(), 'wiki-source-'))
    const sourcePath = path.join(sourceDir, 'Amadeus Final (2).png')
    await writeFile(sourcePath, png)

    const asset = await store.importFromPath(worldId, sourcePath)

    expect(asset.originalFilename).toBe('Amadeus Final (2).png')
    const originalPath = await store.getVariantPath(worldId, asset.id, 'original')
    expect(await readFile(originalPath!)).toEqual(png)
    expect(await readFile(sourcePath)).toEqual(png) // source preserved, never moved

    await rm(sourceDir, { recursive: true, force: true })
  })

  it('rejects unsupported file types', async () => {
    await expect(store.importFromBuffer(worldId, Buffer.from('not an image'), 'notes.txt', 'text/plain')).rejects.toThrow(
      UnsupportedImageTypeError,
    )
  })

  it('returns null from getAsset/getVariantPath for an unknown asset', async () => {
    expect(await store.getAsset(worldId, crypto.randomUUID())).toBeNull()
    expect(await store.getVariantPath(worldId, crypto.randomUUID(), 'original')).toBeNull()
  })

  it('soft-deletes an asset into trash/', async () => {
    const asset = await store.importFromBuffer(worldId, await makeTestPng(), 'a.png', 'image/png')

    await store.removeAsset(worldId, asset.id)

    expect(await store.getAsset(worldId, asset.id)).toBeNull()
    const worldDir = (await readdir(path.join(workspaceDir, 'worlds')))[0]
    const trashEntries = await readdir(getTrashDir(worldDir))
    expect(trashEntries.some((name) => name.includes(asset.id))).toBe(true)
  })
})
