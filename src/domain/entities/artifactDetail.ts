import { z } from 'zod'

export const ArtifactDetailSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  description: z.string().max(1200),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
})

export const ArtifactDetailsSchema = z.array(ArtifactDetailSchema).max(24)
export type ArtifactDetail = z.infer<typeof ArtifactDetailSchema>
