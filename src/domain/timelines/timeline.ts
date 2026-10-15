import { z } from 'zod'
import { CalendarDateValueSchema, legacyIsoDateToOrdinal, parseLegacyIsoDate, validateCalendarDateValue, type CalendarDateValue } from '@/domain/worlds/calendar-date'
import { dateToOrdinal, getCalendarDateAtOrdinal, type Calendar } from '@/domain/worlds/calendar'
import { TimelineScaleSchema } from './timelineScale'

export const TIMELINE_SCHEMA_VERSION = 2

export { TimelineScaleSchema } from './timelineScale'

export const TimelineAppearanceFieldsSchema = z.object({
  title: z.string().trim().max(120).nullable(),
  note: z.string().trim().max(500).nullable(),
  date: CalendarDateValueSchema.nullable(),
  minimumScale: TimelineScaleSchema.nullable(),
  showCover: z.boolean(),
})
export type TimelineAppearanceFields = z.infer<typeof TimelineAppearanceFieldsSchema>

export const TimelineAppearanceSchema = z.object({
  id: z.uuid(),
  entityId: z.uuid(),
}).extend(TimelineAppearanceFieldsSchema.shape)
export type TimelineAppearance = z.infer<typeof TimelineAppearanceSchema>

export const TimelineDataSchema = z.object({
  schemaVersion: z.literal(TIMELINE_SCHEMA_VERSION),
  worldId: z.uuid(),
  timelineId: z.uuid(),
  updatedAt: z.iso.datetime(),
  appearances: z.array(TimelineAppearanceSchema),
})
export type TimelineData = z.infer<typeof TimelineDataSchema>

const TimelineDataV1Schema = z.object({
  schemaVersion: z.literal(1),
  worldId: z.uuid(),
  timelineId: z.uuid(),
  updatedAt: z.iso.datetime(),
  appearances: z.array(z.object({ id: z.uuid(), entityId: z.uuid(), date: CalendarDateValueSchema.nullable() })),
})

/** Older files are expanded in memory and upgraded on the next write. */
export function parseTimelineData(input: unknown): TimelineData {
  const version = z.object({ schemaVersion: z.number() }).parse(input).schemaVersion
  if (version === TIMELINE_SCHEMA_VERSION) return TimelineDataSchema.parse(input)
  if (version === 1) {
    const old = TimelineDataV1Schema.parse(input)
    return TimelineDataSchema.parse({ ...old, schemaVersion: TIMELINE_SCHEMA_VERSION,
      appearances: old.appearances.map((appearance) => ({ ...appearance, title: null, note: null, minimumScale: null, showCover: true })) })
  }
  throw new Error(`Versão de Linha do Tempo não suportada: ${version}.`)
}

export function emptyTimelineData(worldId: string, timelineId: string): TimelineData {
  return TimelineDataSchema.parse({ schemaVersion: TIMELINE_SCHEMA_VERSION, worldId, timelineId, updatedAt: new Date(0).toISOString(), appearances: [] })
}

export function initialEventAppearanceDate(calendar: Calendar, value: unknown): CalendarDateValue | null {
  const calendarValue = CalendarDateValueSchema.safeParse(value)
  if (calendarValue.success) {
    const valid = validateCalendarDateValue(calendar, calendarValue.data)
    return valid.success ? valid.data : null
  }
  if (typeof value !== 'string') return null
  const legacy = parseLegacyIsoDate(value)
  if (!legacy.success) return null
  const day = getCalendarDateAtOrdinal(calendar, legacyIsoDateToOrdinal(legacy.data))
  if (day.month === undefined || day.day === undefined) return null
  return { start: { year: day.year, month: day.month, day: day.day } }
}

export function appearanceOrdinal(calendar: Calendar, appearance: TimelineAppearance): number | null {
  if (!appearance.date) return null
  const valid = validateCalendarDateValue(calendar, appearance.date)
  if (!valid.success) throw new Error(`A aparição ${appearance.id} possui data inválida: ${valid.error}`)
  const start = valid.data.start
  return dateToOrdinal(calendar, { year: start.year, month: start.month ?? 1, day: start.day ?? 1 })
}

export function orderTimelineAppearances(calendar: Calendar, appearances: TimelineAppearance[]): { dated: TimelineAppearance[]; undated: TimelineAppearance[] } {
  const dated: { appearance: TimelineAppearance; ordinal: number }[] = []
  const undated: TimelineAppearance[] = []
  for (const appearance of appearances) {
    const ordinal = appearanceOrdinal(calendar, appearance)
    if (ordinal === null) undated.push(appearance)
    else dated.push({ appearance, ordinal })
  }
  dated.sort((a, b) => a.ordinal - b.ordinal || a.appearance.id.localeCompare(b.appearance.id))
  return { dated: dated.map(({ appearance }) => appearance), undated }
}
