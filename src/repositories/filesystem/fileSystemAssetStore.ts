import 'server-only'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AssetSchema, type Asset, type AssetVariant } from '@/domain/assets/asset'
import { mimeTypeForExtension } from '@/domain/assets/mimeType'
import { atomicWriteJson, ensureDir, pathExists } from '@/lib/fs/atomicWrite'
import { getAssetDir, getAssetMetadataPath, getTrashDir } from '@/lib/fs/paths'
import { readMigratedJson } from '@/lib/migrations/registry'
import { assetVariantFileName, prepareAssetImage, UnsupportedImageTypeError } from '@/repositories/assetImages'
import type { AssetImportPurpose, AssetStore, AssetVariantData } from '@/repositories/contracts/assetStore'
import { assetMigrations } from '@/repositories/filesystem/migrations'
import { readWorldByDir, resolveWorldDir } from '@/repositories/filesystem/worldDirRegistry'
import { withWorldWriteLock } from './worldWriteLock'

export { UnsupportedImageTypeError } from '@/repositories/assetImages'

export class FileSystemAssetStore implements AssetStore {
  async importFromPath(worldId: string, sourcePath: string): Promise<Asset> {
    const extension = path.extname(sourcePath).slice(1)
    const mimeType = mimeTypeForExtension(extension)
    if (!mimeType) throw new UnsupportedImageTypeError(extension || '(no extension)')
    return this.importFromBuffer(worldId, await readFile(sourcePath), path.basename(sourcePath), mimeType)
  }

  async importFromBuffer(
    worldId: string,
    buffer: Buffer,
    filename: string,
    mimeType: string,
    purpose?: AssetImportPurpose,
  ): Promise<Asset> {
    const worldDir = await resolveWorldDir(worldId)
    const { asset, variants } = await prepareAssetImage(worldId, buffer, filename, mimeType, purpose)

    return withWorldWriteLock(worldDir, async () => {
      if ((await readWorldByDir(worldDir)).id !== worldId) {
        throw new Error('O mundo não está mais disponível. Atualize a biblioteca.')
      }
      const assetDir = getAssetDir(worldDir, asset.id)
      await ensureDir(assetDir)
      try {
        for (const [variant, data] of variants) {
          await writeFile(path.join(assetDir, assetVariantFileName(variant, mimeType)), data.bytes)
        }
        await atomicWriteJson(getAssetMetadataPath(worldDir, asset.id), asset)
      } catch (error) {
        await rm(assetDir, { recursive: true, force: true })
        throw error
      }
      return asset
    })
  }

  async getAsset(worldId: string, assetId: string): Promise<Asset | null> {
    if (!AssetSchema.shape.id.safeParse(assetId).success) return null
    const worldDir = await resolveWorldDir(worldId)
    const metadataPath = getAssetMetadataPath(worldDir, assetId)
    try {
      const asset = await readMigratedJson(metadataPath, assetMigrations, AssetSchema)
      return asset.worldId === worldId && asset.id === assetId ? asset : null
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async getVariant(worldId: string, assetId: string, variant: AssetVariant): Promise<AssetVariantData | null> {
    const asset = await this.getAsset(worldId, assetId)
    if (!asset || (variant === 'thumbnail' && !asset.hasThumbnail)) return null

    const worldDir = await resolveWorldDir(worldId)
    const file = path.join(getAssetDir(worldDir, assetId), assetVariantFileName(variant, asset.mimeType))
    try {
      const bytes = await readFile(file)
      return { bytes, mimeType: variant === 'original' ? asset.mimeType : 'image/webp' }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async removeAsset(worldId: string, assetId: string): Promise<void> {
    if (!AssetSchema.shape.id.safeParse(assetId).success) return
    const worldDir = await resolveWorldDir(worldId)
    return withWorldWriteLock(worldDir, async () => {
      const world = await readWorldByDir(worldDir)
      if (world.id !== worldId) return
      if (world.calendarAppearance.customThemes.some((theme) => theme.backgroundAssetId === assetId)) return
      const assetDir = getAssetDir(worldDir, assetId)
      if (!(await pathExists(assetDir))) return

      const trashDir = getTrashDir(worldDir)
      await ensureDir(trashDir)
      await rename(assetDir, path.join(trashDir, `asset-${assetId}-${Date.now()}`))
    })
  }
}
