import 'server-only'
import { copyFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { AssetSchema, ASSET_SCHEMA_VERSION, type Asset, type AssetVariant } from '@/domain/assets/asset'
import { extensionForMimeType, mimeTypeForExtension } from '@/domain/assets/mimeType'
import { atomicWriteJson, ensureDir, pathExists } from '@/lib/fs/atomicWrite'
import { getAssetDir, getAssetMetadataPath, getTrashDir } from '@/lib/fs/paths'
import { newId } from '@/lib/ids'
import { readMigratedJson } from '@/lib/migrations/registry'
import type { AssetStore } from '@/repositories/contracts/assetStore'
import { assetMigrations } from '@/repositories/filesystem/migrations'
import { readWorldByDir, resolveWorldDir } from '@/repositories/filesystem/worldDirRegistry'
import { withWorldWriteLock } from './worldWriteLock'

const THUMBNAIL_MAX_SIZE = 480

export class UnsupportedImageTypeError extends Error {
  constructor(mimeType: string) {
    super(`Unsupported image type: ${mimeType}`)
    this.name = 'UnsupportedImageTypeError'
  }
}

function originalFileName(mimeType: string): string {
  const ext = extensionForMimeType(mimeType)
  if (!ext) throw new UnsupportedImageTypeError(mimeType)
  return `original.${ext}`
}

/** Best-effort: a broken/missing sharp native binding degrades to "no thumbnail", not a failed import. See ADR-001 risk #2. */
async function tryGenerateDerivedData(
  input: Buffer | string,
  assetDir: string,
): Promise<{ width?: number; height?: number; hasThumbnail: boolean }> {
  try {
    const image = sharp(input)
    const metadata = await image.metadata()
    await sharp(input)
      .resize(THUMBNAIL_MAX_SIZE, THUMBNAIL_MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(path.join(assetDir, 'thumbnail.webp'))
    return { width: metadata.width, height: metadata.height, hasThumbnail: true }
  } catch {
    return { hasThumbnail: false }
  }
}

export class FileSystemAssetStore implements AssetStore {
  async importFromPath(worldId: string, sourcePath: string): Promise<Asset> {
    const ext = path.extname(sourcePath).slice(1)
    const mimeType = mimeTypeForExtension(ext)
    if (!mimeType) throw new UnsupportedImageTypeError(ext || '(no extension)')

    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, async () => {
    const assetId = newId()
    const assetDir = getAssetDir(worldDir, assetId)
    await ensureDir(assetDir)

    const originalPath = path.join(assetDir, originalFileName(mimeType))
    await copyFile(sourcePath, originalPath)
    const stats = await stat(originalPath)
    const derived = await tryGenerateDerivedData(originalPath, assetDir)

    const asset = AssetSchema.parse({
      id: assetId,
      worldId,
      originalFilename: path.basename(sourcePath),
      mimeType,
      sizeBytes: stats.size,
      width: derived.width,
      height: derived.height,
      hasThumbnail: derived.hasThumbnail,
      createdAt: new Date().toISOString(),
      schemaVersion: ASSET_SCHEMA_VERSION,
    } satisfies Asset)

    await atomicWriteJson(getAssetMetadataPath(worldDir, assetId), asset)
    return asset
    })
  }

  async importFromBuffer(worldId: string, buffer: Buffer, filename: string, mimeType: string): Promise<Asset> {
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, async () => {
    const assetId = newId()
    const assetDir = getAssetDir(worldDir, assetId)
    await ensureDir(assetDir)

    const originalPath = path.join(assetDir, originalFileName(mimeType))
    await writeFile(originalPath, buffer)
    const derived = await tryGenerateDerivedData(buffer, assetDir)

    const asset = AssetSchema.parse({
      id: assetId,
      worldId,
      originalFilename: filename,
      mimeType,
      sizeBytes: buffer.byteLength,
      width: derived.width,
      height: derived.height,
      hasThumbnail: derived.hasThumbnail,
      createdAt: new Date().toISOString(),
      schemaVersion: ASSET_SCHEMA_VERSION,
    } satisfies Asset)

    await atomicWriteJson(getAssetMetadataPath(worldDir, assetId), asset)
    return asset
    })
  }

  async getAsset(worldId: string, assetId: string): Promise<Asset | null> {
    const worldDir = await resolveWorldDir(worldId)
    const metadataPath = getAssetMetadataPath(worldDir, assetId)
    if (!(await pathExists(metadataPath))) return null
    return readMigratedJson(metadataPath, assetMigrations, AssetSchema)
  }

  async prepareCalendarBackground(worldId: string, assetId: string): Promise<void> {
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, async () => {
      const metadata = getAssetMetadataPath(worldDir, assetId)
      if (!(await pathExists(metadata))) throw new Error('A imagem não existe neste mundo.')
      const asset = await readMigratedJson(metadata, assetMigrations, AssetSchema)
      if (asset.worldId !== worldId || asset.id !== assetId) throw new Error('A imagem pertence a outro mundo.')
      const assetDir = getAssetDir(worldDir, assetId)
      const original = path.join(assetDir, originalFileName(asset.mimeType))
      for (const [variant, width] of [['calendar-mobile', 768], ['calendar-desktop', 1600]] as const) {
        const output = await sharp(original, { limitInputPixels: 40_000_000 }).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer()
        await writeFile(path.join(assetDir, `${variant}.webp`), output, { flag: 'wx' })
      }
    })
  }

  async getVariantPath(worldId: string, assetId: string, variant: AssetVariant): Promise<string | null> {
    const asset = await this.getAsset(worldId, assetId)
    if (!asset) return null

    const worldDir = await resolveWorldDir(worldId)
    const assetDir = getAssetDir(worldDir, assetId)

    if (variant === 'thumbnail') {
      if (!asset.hasThumbnail) return null
      return path.join(assetDir, 'thumbnail.webp')
    }

    if (variant === 'calendar-mobile' || variant === 'calendar-desktop') {
      const variantPath = path.join(assetDir, `${variant}.webp`)
      return (await pathExists(variantPath)) ? variantPath : null
    }

    const originalPath = path.join(assetDir, originalFileName(asset.mimeType))
    return (await pathExists(originalPath)) ? originalPath : null
  }

  async removeAsset(worldId: string, assetId: string): Promise<void> {
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, async () => {
    const world = await readWorldByDir(worldDir)
    if (world.calendarAppearance.customThemes.some((theme) => theme.backgroundAssetId === assetId)) return
    const assetDir = getAssetDir(worldDir, assetId)
    if (!(await pathExists(assetDir))) return

    const trashDir = getTrashDir(worldDir)
    await ensureDir(trashDir)
    await rename(assetDir, path.join(trashDir, `asset-${assetId}-${Date.now()}`))
    })
  }
}
