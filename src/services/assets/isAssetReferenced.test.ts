import { describe, expect, it } from 'vitest'
import type { Entity } from '@/domain/entities/entity'
import { isAssetReferenced } from './isAssetReferenced'

const assetId = 'ab8a4f33-6aa9-47b0-9400-6c969181add0'
const entity = {
  coverAssetId: undefined,
  galleryAssetIds: [],
  properties: {},
} as unknown as Entity

describe('isAssetReferenced', () => {
  it('finds assets used as covers, gallery entries, or nested properties', () => {
    expect(isAssetReferenced([{ ...entity, coverAssetId: assetId }], assetId)).toBe(true)
    expect(isAssetReferenced([{ ...entity, galleryAssetIds: [assetId] }], assetId)).toBe(true)
    expect(isAssetReferenced([{ ...entity, properties: { gallery: [{ assetId }] } }], assetId)).toBe(true)
  })

  it('returns false for an orphan asset', () => {
    expect(isAssetReferenced([entity], assetId)).toBe(false)
  })
})
