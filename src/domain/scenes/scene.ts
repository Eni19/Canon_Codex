import { z } from 'zod'

export const SCENE_SCHEMA_VERSION = 1

export const SceneGridSchema = z.object({
  enabled: z.boolean(), type: z.literal('square'), cellSize: z.number().min(20).max(300),
  offsetX: z.number(), offsetY: z.number(), opacity: z.number().min(0).max(1), snapTokens: z.boolean(),
})
export type SceneGrid = z.infer<typeof SceneGridSchema>

export const SceneSchema = z.object({
  schemaVersion: z.number().int(), id: z.uuid(), worldId: z.string().min(1), title: z.string().min(1),
  description: z.string().optional(), tags: z.array(z.string()),
  background: z.object({ locationId: z.uuid(), assetId: z.uuid(), width: z.number().positive(), height: z.number().positive() }),
  grid: SceneGridSchema,
  canvasSnapshot: z.unknown().nullable(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
})
export type Scene = z.infer<typeof SceneSchema>
export type SceneSummary = Omit<Scene, 'canvasSnapshot'>

export const CreateSceneInputSchema = z.object({
  title: z.string().trim().min(1), description: z.string().trim().optional(), tags: z.array(z.string()).default([]),
  locationId: z.uuid(), assetId: z.uuid(), width: z.number().positive(), height: z.number().positive(),
})
export type CreateSceneInput = z.input<typeof CreateSceneInputSchema>
