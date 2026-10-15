import { z } from 'zod'
import { EntityTypeDefinitionSchema } from '@/domain/entities/entityType'
import { CalendarSchema } from '@/domain/worlds/calendar'
import { TimelineScaleSchema } from '@/domain/timelines/timelineScale'

export const WORLD_SCHEMA_VERSION = 20

export const WorldSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  entityTypes: z.array(EntityTypeDefinitionSchema),
  timelineScaleDefaults: z.record(z.string(), TimelineScaleSchema),
  calendar: CalendarSchema,
  originEventId: z.uuid().optional(),
  schemaVersion: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
export type World = z.infer<typeof WorldSchema>
