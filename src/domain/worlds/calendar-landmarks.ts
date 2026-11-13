import { z } from 'zod'
import { getCalendarDateAtOrdinal, getMonthLength, type Calendar } from './calendar'
import { CalendarExactDateSchema, exactDateToOrdinal } from './calendar-exact-date'

const MonthDaySchema = z.object({ month: z.number().int().positive(), day: z.number().int().positive() }).strict()
const CategorySchema = z.object({ id: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(80), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })
const LandmarkFields = { id: z.string().trim().min(1).max(80), title: z.string().trim().min(1).max(120), description: z.string().max(1000), categoryId: z.string().trim().min(1).max(80) }
const LandmarkSchema = z.discriminatedUnion('kind', [
  z.object({ ...LandmarkFields, kind: z.literal('once'), start: CalendarExactDateSchema, end: CalendarExactDateSchema.optional() }),
  z.object({ ...LandmarkFields, kind: z.literal('annual'), start: MonthDaySchema, end: MonthDaySchema.optional() }),
])
export const CalendarLandmarksSchema = z.object({ categories: z.array(CategorySchema).max(100), landmarks: z.array(LandmarkSchema).max(5000) })
export type CalendarLandmarks = z.infer<typeof CalendarLandmarksSchema>

function validAnnualDate(calendar: Calendar, date: z.infer<typeof MonthDaySchema>): boolean {
  const month = calendar.months[date.month - 1]
  if (!month) return false
  return date.day <= month.length + calendar.intercalaryRules.filter((rule) => rule.month === date.month && rule.extendsMonth).length
}

export function validateCalendarLandmarks(calendar: Calendar, input: unknown) {
  const parsed = CalendarLandmarksSchema.safeParse(input)
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Marcos inválidos.' }
  const categoryIds = new Set<string>()
  for (const category of parsed.data.categories) {
    if (categoryIds.has(category.id)) return { success: false as const, error: 'Os identificadores das categorias precisam ser únicos.' }
    categoryIds.add(category.id)
  }
  const ids = new Set<string>()
  for (const landmark of parsed.data.landmarks) {
    if (ids.has(landmark.id)) return { success: false as const, error: 'Os identificadores dos marcos precisam ser únicos.' }
    ids.add(landmark.id)
    if (!categoryIds.has(landmark.categoryId)) return { success: false as const, error: `O marco ${landmark.title} precisa de uma categoria existente.` }
    if (landmark.kind === 'annual') {
      if (!validAnnualDate(calendar, landmark.start) || (landmark.end && !validAnnualDate(calendar, landmark.end))) return { success: false as const, error: `O marco ${landmark.title} usa uma data anual inexistente.` }
    } else {
      try {
        const start = exactDateToOrdinal(calendar, landmark.start)
        if (landmark.end && exactDateToOrdinal(calendar, landmark.end) < start) return { success: false as const, error: `O fim de ${landmark.title} antecede o início.` }
      } catch { return { success: false as const, error: `O marco ${landmark.title} usa uma data inexistente.` } }
    }
  }
  return { success: true as const, data: parsed.data }
}

/** Project only short visible windows, including annual intervals starting in the preceding year. */
export function projectCalendarLandmarks(calendar: Calendar, input: CalendarLandmarks, first: number, last: number) {
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || last < first) throw new RangeError('Intervalo de projeção inválido.')
  const validated = validateCalendarLandmarks(calendar, input)
  if (!validated.success) throw new RangeError(validated.error)
  const firstYear = getCalendarDateAtOrdinal(calendar, first).year
  const lastYear = getCalendarDateAtOrdinal(calendar, last).year
  if (lastYear - firstYear > 2) throw new RangeError('A janela de projeção é grande demais.')
  const occurrences: { id: string; title: string; categoryId: string; first: number; last: number }[] = []
  for (const item of validated.data.landmarks) {
    if (item.kind === 'once') {
      const start = exactDateToOrdinal(calendar, item.start)
      const end = item.end ? exactDateToOrdinal(calendar, item.end) : start
      if (start <= last && end >= first) occurrences.push({ id: item.id, title: item.title, categoryId: item.categoryId, first: start, last: end })
      continue
    }
    for (let year = firstYear - 1; year <= lastYear; year++) {
      const end = item.end ?? item.start
      const crossesYear = end.month < item.start.month || (end.month === item.start.month && end.day < item.start.day)
      const endYear = year + (crossesYear ? 1 : 0)
      const exists = (date: z.infer<typeof MonthDaySchema>, y: number) => date.month <= calendar.months.length && date.day <= getMonthLength(calendar, y, date.month)
      if (!exists(item.start, year) || !exists(end, endYear)) continue
      const startOrdinal = exactDateToOrdinal(calendar, { year, ...item.start })
      const endOrdinal = exactDateToOrdinal(calendar, { year: endYear, ...end })
      if (startOrdinal <= last && endOrdinal >= first) occurrences.push({ id: item.id, title: item.title, categoryId: item.categoryId, first: startOrdinal, last: endOrdinal })
    }
  }
  return occurrences.sort((a, b) => a.first - b.first || a.id.localeCompare(b.id))
}
