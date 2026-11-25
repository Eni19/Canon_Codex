import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { AssetSchema, type Asset, type AssetVariant } from '@/domain/assets/asset'
import { mimeTypeForExtension } from '@/domain/assets/mimeType'
import { WorldSchema } from '@/domain/worlds/world'
import { prepareAssetImage, UnsupportedImageTypeError } from '@/repositories/assetImages'
import type { AssetImportPurpose, AssetStore, AssetVariantData } from '@/repositories/contracts/assetStore'
import type { SqliteDatabase } from './database'

export class SqliteAssetStore implements AssetStore {
  constructor(private readonly db: SqliteDatabase) {}

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
    const { asset, variants } = await prepareAssetImage(worldId, buffer, filename, mimeType, purpose)
    return this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      this.db.connection.prepare('INSERT INTO assets (world_id, id, document) VALUES (?, ?, ?)')
        .run(worldId, asset.id, JSON.stringify(asset))
      const insertVariant = this.db.connection.prepare(
        'INSERT INTO asset_variants (world_id, asset_id, variant, mime_type, bytes) VALUES (?, ?, ?, ?, ?)',
      )
      for (const [variant, data] of variants) {
        insertVariant.run(worldId, asset.id, variant, data.mimeType, data.bytes)
      }
      return asset
    })
  }

  async getAsset(worldId: string, assetId: string): Promise<Asset | null> {
    return this.db.read(() => {
      const row = this.db.connection.prepare(`
        SELECT assets.document
        FROM assets JOIN worlds ON worlds.id = assets.world_id
        WHERE assets.world_id = ? AND assets.id = ?
          AND assets.deleted_at IS NULL AND worlds.deleted_at IS NULL
      `).get(worldId, assetId) as { document: string } | undefined
      return row ? AssetSchema.parse(JSON.parse(row.document)) : null
    })
  }

  async getVariant(worldId: string, assetId: string, variant: AssetVariant): Promise<AssetVariantData | null> {
    return this.db.read(() => {
      const row = this.db.connection.prepare(`
        SELECT asset_variants.bytes, asset_variants.mime_type AS mimeType
        FROM asset_variants
        JOIN assets ON assets.world_id = asset_variants.world_id AND assets.id = asset_variants.asset_id
        JOIN worlds ON worlds.id = assets.world_id
        WHERE asset_variants.world_id = ? AND asset_variants.asset_id = ? AND asset_variants.variant = ?
          AND assets.deleted_at IS NULL AND worlds.deleted_at IS NULL
      `).get(worldId, assetId, variant) as AssetVariantData | undefined
      return row ?? null
    })
  }

  async removeAsset(worldId: string, assetId: string): Promise<void> {
    this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      const row = this.db.connection.prepare('SELECT document FROM worlds WHERE id = ?')
        .get(worldId) as { document: string }
      const world = WorldSchema.parse(JSON.parse(row.document))
      if (world.calendarAppearance.customThemes.some((theme) => theme.backgroundAssetId === assetId)) return

      this.db.connection.prepare('UPDATE assets SET deleted_at = ? WHERE world_id = ? AND id = ? AND deleted_at IS NULL')
        .run(new Date().toISOString(), worldId, assetId)
    })
  }
}
