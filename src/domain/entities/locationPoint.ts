import { z } from 'zod'

export const LocationDiscoverySchema = z.object({
  id: z.string().min(1),
  approach: z.string().max(80),
  condition: z.string().max(80),
  information: z.string().max(1200),
})

export const LocationPointSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  kind: z.enum(['text', 'evidence', 'document']),
  targetId: z.uuid().optional(),
  basicDescription: z.string().max(1200).optional(),
  contextualDescription: z.string().max(2400).optional(),
  discoveries: z.array(LocationDiscoverySchema).max(20).default([]),
  /** Legacy description, retained so points created before the discovery-card format still open. */
  description: z.string().max(1000).optional(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
})

export const LocationPointsSchema = z.array(LocationPointSchema).max(30)
export type LocationDiscovery = z.infer<typeof LocationDiscoverySchema>
export type LocationPoint = z.infer<typeof LocationPointSchema>
