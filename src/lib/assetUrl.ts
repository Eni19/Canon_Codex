import type { AssetVariant } from '@/domain/assets/asset'

/** Builds the URL the browser fetches an asset from — never a filesystem path. See ADR-003. */
export function assetVariantUrl(assetId: string, variant: AssetVariant = 'thumbnail'): string {
  return `/api/assets/${assetId}/${variant}`
}
