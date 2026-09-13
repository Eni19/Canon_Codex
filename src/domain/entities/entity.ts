import { z } from 'zod'
import { RelationSchema } from '@/domain/relations/relation'
import { CharacterThemeSchema } from './characterTheme'

export const ENTITY_SCHEMA_VERSION = 4

export const EntitySchema = z.object({
  id: z.uuid(),
  worldId: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  aliases: z.array(z.string()),
  tags: z.array(z.string()),
  status: z.string().optional(),
  theme: CharacterThemeSchema.optional(),
  coverAssetId: z.uuid().optional(),
  galleryAssetIds: z.array(z.uuid()).optional(),
  properties: z.record(z.string(), z.unknown()),
  relations: z.array(RelationSchema),
  schemaVersion: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
export type Entity = z.infer<typeof EntitySchema>

export const NewEntityInputSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  status: z.string().optional(),
  theme: CharacterThemeSchema.optional(),
  coverAssetId: z.uuid().optional(),
  galleryAssetIds: z.array(z.uuid()).optional(),
  properties: z.record(z.string(), z.unknown()).default({}),
})
// z.input (not z.infer/output): callers may omit fields that have schema defaults.
export type NewEntityInput = z.input<typeof NewEntityInputSchema>

export const EntityPatchSchema = z
  .object({
    title: z.string().min(1),
    aliases: z.array(z.string()),
    tags: z.array(z.string()),
    status: z.string().optional(),
    theme: CharacterThemeSchema.optional(),
    coverAssetId: z.uuid().nullable().optional(),
    galleryAssetIds: z.array(z.uuid()).optional(),
    properties: z.record(z.string(), z.unknown()),
    expectedUpdatedAt: z.iso.datetime().optional(),
  })
  .partial()
export type EntityPatch = z.infer<typeof EntityPatchSchema>
