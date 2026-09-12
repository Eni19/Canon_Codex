import { z } from 'zod'

export const RelationSchema = z.object({
  id: z.uuid(),
  sourceId: z.uuid(),
  targetId: z.uuid(),
  type: z.string().min(1),
  label: z.string().optional(),
  directional: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type Relation = z.infer<typeof RelationSchema>

export const NewRelationInputSchema = RelationSchema.omit({ id: true })
export type NewRelationInput = z.infer<typeof NewRelationInputSchema>
