import { z } from 'zod'

export const ASSET_SCHEMA_VERSION = 1

export const AssetVariantSchema = z.enum(['original', 'thumbnail'])
export type AssetVariant = z.infer<typeof AssetVariantSchema>

export const AssetSchema = z.object({
  id: z.uuid(),
  worldId: z.string().min(1),
  originalFilename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  hasThumbnail: z.boolean(),
  createdAt: z.iso.datetime(),
  schemaVersion: z.number().int(),
})
export type Asset = z.infer<typeof AssetSchema>
