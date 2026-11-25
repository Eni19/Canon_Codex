import 'server-only'
import sharp from 'sharp'
import { ASSET_SCHEMA_VERSION, AssetSchema, type AssetVariant } from '@/domain/assets/asset'
import { extensionForMimeType } from '@/domain/assets/mimeType'
import { newId } from '@/lib/ids'
import type { AssetImportPurpose, AssetVariantData } from '@/repositories/contracts/assetStore'

export class UnsupportedImageTypeError extends Error {
  constructor(mimeType: string) {
    super(`Unsupported image type: ${mimeType}`)
    this.name = 'UnsupportedImageTypeError'
  }
}

export function assetVariantFileName(variant: AssetVariant, mimeType: string): string {
  if (variant !== 'original') return `${variant}.webp`
  const extension = extensionForMimeType(mimeType)
  if (!extension) throw new UnsupportedImageTypeError(mimeType)
  return `original.${extension}`
}

async function createThumbnail(bytes: Buffer) {
  try {
    const { width, height } = await sharp(bytes).metadata()
    const thumbnail = await sharp(bytes)
      .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
    return { width, height, thumbnail }
  } catch {
    // Keep the original available when Sharp cannot decode or resize it.
    return {}
  }
}

export async function prepareAssetImage(
  worldId: string,
  bytes: Buffer,
  filename: string,
  mimeType: string,
  purpose?: AssetImportPurpose,
) {
  if (!extensionForMimeType(mimeType)) throw new UnsupportedImageTypeError(mimeType)

  const { width, height, thumbnail } = await createThumbnail(bytes)
  const variants = new Map<AssetVariant, AssetVariantData>([['original', { bytes, mimeType }]])
  if (thumbnail) variants.set('thumbnail', { bytes: thumbnail, mimeType: 'image/webp' })

  if (purpose === 'calendar-background') {
    for (const [variant, width] of [['calendar-mobile', 768], ['calendar-desktop', 1600]] as const) {
      const output = await sharp(bytes, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer()
      variants.set(variant, { bytes: output, mimeType: 'image/webp' })
    }
  }

  const asset = AssetSchema.parse({
    id: newId(),
    worldId,
    originalFilename: filename,
    mimeType,
    sizeBytes: bytes.byteLength,
    width,
    height,
    hasThumbnail: Boolean(thumbnail),
    createdAt: new Date().toISOString(),
    schemaVersion: ASSET_SCHEMA_VERSION,
  })
  return { asset, variants }
}
