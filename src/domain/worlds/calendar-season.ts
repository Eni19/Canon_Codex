import { z } from 'zod'
import { getMonthLength, validateCalendarDate, type Calendar } from './calendar'
import { exactDateToOrdinal, type CalendarExactDate } from './calendar-exact-date'

export const CalendarSeasonSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Informe uma cor hexadecimal válida.'),
  start: z.object({ month: z.number().int().positive(), day: z.number().int().positive() }),
})

export type CalendarSeason = z.infer<typeof CalendarSeasonSchema>
export const CalendarSeasonsSchema = z.array(CalendarSeasonSchema).max(36, 'Configure no máximo 36 estações.')
export type CalendarSeasonValidation =
  | { success: true; data: CalendarSeason[] }
  | { success: false; error: string }

/** Starts must occur every year, including years without intercalary days. */
export function validateCalendarSeasons(calendar: Calendar, input: unknown): CalendarSeasonValidation {
  const parsed = CalendarSeasonsSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Estações inválidas.' }
  const ids = new Set<string>()
  const starts = new Set<string>()
  for (const season of parsed.data) {
    if (ids.has(season.id)) return { success: false, error: 'Os identificadores das estações precisam ser únicos.' }
    ids.add(season.id)
    const month = calendar.months[season.start.month - 1]
    if (!month || season.start.day > month.length) return { success: false, error: `O início de ${season.name} precisa existir em todos os anos.` }
    const start = `${season.start.month}:${season.start.day}`
    if (starts.has(start)) return { success: false, error: 'Duas estações não podem começar no mesmo dia.' }
    starts.add(start)
  }
  return { success: true, data: parsed.data }
}

/** Select the most recent annual start, wrapping to the preceding year if needed. */
export function seasonAtDate(calendar: Calendar, seasons: CalendarSeason[], date: { year: number; month: number; day: number }): CalendarSeason | null {
  const validDate = validateCalendarDate(calendar, date)
  if (!validDate.success) throw new RangeError(validDate.error)
  const validSeasons = validateCalendarSeasons(calendar, seasons)
  if (!validSeasons.success) throw new RangeError(validSeasons.error)
  if (!validSeasons.data.length) return null
  const ordered = [...validSeasons.data].sort((a, b) => a.start.month - b.start.month || a.start.day - b.start.day)
  return ordered.findLast((season) => season.start.month < date.month || (season.start.month === date.month && season.start.day <= date.day)) ?? ordered[ordered.length - 1]
}

export function seasonAtExactDate(calendar: Calendar, seasons: CalendarSeason[], date: CalendarExactDate): CalendarSeason | null {
  exactDateToOrdinal(calendar, date)
  if ('month' in date) return seasonAtDate(calendar, seasons, date)
  const rule = calendar.intercalaryRules.find((item) => item.id === date.intercalaryRuleId)!
  return seasonAtDate(calendar, seasons, { year: date.year, month: rule.month, day: getMonthLength(calendar, date.year, rule.month) })
}
