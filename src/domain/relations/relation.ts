import { z } from 'zod'

export const RelationDirectionSchema = z.enum(['forward', 'both', 'none'])
export type RelationDirection = z.infer<typeof RelationDirectionSchema>

export const RelationSchema = z.object({
  id: z.uuid(),
  sourceId: z.uuid(),
  targetId: z.uuid(),
  type: z.string().min(1),
  label: z.string().optional(),
  directional: z.boolean(),
  bidirectional: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type Relation = z.infer<typeof RelationSchema>

export const RelationChangesSchema = RelationSchema.pick({ type: true, label: true, directional: true, bidirectional: true }).strict()
export type RelationChanges = z.infer<typeof RelationChangesSchema>
export const relationDirection = (relation: Pick<Relation, 'directional' | 'bidirectional'>): RelationDirection =>
  !relation.directional ? 'none' : relation.bidirectional ? 'both' : 'forward'
export const directionFields = (direction: RelationDirection) => ({ directional: direction !== 'none', bidirectional: direction === 'both' })
export const directionMark = (direction: RelationDirection) => direction === 'both' ? '↔' : direction === 'forward' ? '→' : '—'

export const NewRelationInputSchema = RelationSchema.omit({ id: true })
export type NewRelationInput = z.infer<typeof NewRelationInputSchema>
