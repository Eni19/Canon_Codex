import { z } from 'zod'
import { EntityTypeDefinitionSchema } from '@/domain/entities/entityType'
import { CalendarSchema } from '@/domain/worlds/calendar'
import { CalendarMoonsSchema } from '@/domain/worlds/calendar-moon'
import { CalendarSeasonsSchema } from '@/domain/worlds/calendar-season'
import { CalendarExactDateSchema } from '@/domain/worlds/calendar-exact-date'
import { CalendarLandmarksSchema } from '@/domain/worlds/calendar-landmarks'
import { CalendarAppearanceSchema } from '@/domain/worlds/calendar-appearance'
import { TimelineScaleSchema } from '@/domain/timelines/timelineScale'

export const WORLD_SCHEMA_VERSION = 23

export const WorldSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  entityTypes: z.array(EntityTypeDefinitionSchema),
  timelineScaleDefaults: z.record(z.string(), TimelineScaleSchema),
  calendar: CalendarSchema,
  calendarMoons: CalendarMoonsSchema,
  calendarSeasons: CalendarSeasonsSchema,
  campaignToday: CalendarExactDateSchema.nullable(),
  calendarLandmarks: CalendarLandmarksSchema,
  calendarAppearance: CalendarAppearanceSchema,
  originEventId: z.uuid().optional(),
  schemaVersion: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
export type World = z.infer<typeof WorldSchema>
