import { z } from 'zod'
import { EntityTypeDefinitionSchema } from '@/domain/entities/entityType'
import { CalendarSchema } from '@/domain/worlds/calendar'

export const WORLD_SCHEMA_VERSION = 17

export const WorldSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  entityTypes: z.array(EntityTypeDefinitionSchema),
  calendar: CalendarSchema,
  schemaVersion: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
export type World = z.infer<typeof WorldSchema>
