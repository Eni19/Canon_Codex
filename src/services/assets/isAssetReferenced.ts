import type { Entity } from '@/domain/entities/entity'

function containsAssetId(value: unknown, assetId: string): boolean {
  if (value === assetId) return true
  if (Array.isArray(value)) return value.some((item) => containsAssetId(item, assetId))
  if (value && typeof value === 'object') return Object.values(value).some((item) => containsAssetId(item, assetId))
  return false
}

export function isAssetReferenced(entities: Entity[], assetId: string): boolean {
  return entities.some((entity) =>
    entity.coverAssetId === assetId ||
    entity.galleryAssetIds?.includes(assetId) === true ||
    containsAssetId(entity.properties, assetId),
  )
}
