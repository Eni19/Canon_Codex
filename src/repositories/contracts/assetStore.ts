import type { Asset, AssetVariant } from '@/domain/assets/asset'

export type AssetImportPurpose = 'calendar-background'

export interface AssetVariantData {
  bytes: Uint8Array
  mimeType: string
}

/** Image metadata and binary variants scoped to a world. */
export interface AssetStore {
  /** Copies the file at `sourcePath` into storage. */
  importFromPath(worldId: string, sourcePath: string): Promise<Asset>
  /** Calendar backgrounds are published together with both calendar variants. */
  importFromBuffer(worldId: string, buffer: Buffer, filename: string, mimeType: string, purpose?: AssetImportPurpose): Promise<Asset>
  getAsset(worldId: string, assetId: string): Promise<Asset | null>
  getVariant(worldId: string, assetId: string, variant: AssetVariant): Promise<AssetVariantData | null>
  removeAsset(worldId: string, assetId: string): Promise<void>
}
