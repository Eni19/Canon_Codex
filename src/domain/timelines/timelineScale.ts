import { z } from 'zod'

export const TimelineScaleSchema = z.enum(['century', 'decade', 'year', 'month', 'day'])
export type TimelineScale = z.infer<typeof TimelineScaleSchema>
