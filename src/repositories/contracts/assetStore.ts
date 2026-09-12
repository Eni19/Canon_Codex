import type { Asset, AssetVariant } from '@/domain/assets/asset'

/**
 * The only interface the rest of the app uses to import/resolve/remove binary assets (images).
 * See ADR-001 and ADR-003: callers only ever know an `assetId`, never a filesystem path or URL.
 */
export interface AssetStore {
  /** Copies the file at `sourcePath` into the workspace; the original is never referenced again. */
  importFromPath(worldId: string, sourcePath: string): Promise<Asset>
  importFromBuffer(worldId: string, buffer: Buffer, filename: string, mimeType: string): Promise<Asset>
  getAsset(worldId: string, assetId: string): Promise<Asset | null>
  /** Resolves an asset+variant to a local file path for a Route Handler to stream. */
  getVariantPath(worldId: string, assetId: string, variant: AssetVariant): Promise<string | null>
  /** Soft-delete: moves the asset's folder into `trash/`. */
  removeAsset(worldId: string, assetId: string): Promise<void>
}
