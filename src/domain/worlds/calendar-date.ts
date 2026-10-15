import { z } from 'zod'
import {
  CalendarDateFieldsSchema,
  createDefaultCalendar,
  dateToOrdinal,
  formatCalendarDate,
  getCalendarDateAtOrdinal,
  getCalendarYearLength,
  isIntercalaryRuleActive,
  type Calendar,
  type CalendarDate,
  validateCalendarDate,
} from './calendar'

export const CalendarDateBoundarySchema = CalendarDateFieldsSchema.extend({
  approximate: z.boolean().optional(),
}).superRefine((date, context) => {
  if (date.day !== undefined && date.month === undefined) context.addIssue({ code: 'custom', path: ['day'], message: 'O dia precisa vir acompanhado de um mês.' })
})

export const CalendarDateValueSchema = z.object({
  start: CalendarDateBoundarySchema,
  end: CalendarDateBoundarySchema.optional(),
})

export type CalendarDateBoundary = z.infer<typeof CalendarDateBoundarySchema>
export type CalendarDateValue = z.infer<typeof CalendarDateValueSchema>
export type StoredDateValue = CalendarDateValue | string

export type CalendarDateOrdinalRange = { first: number; last: number }

export type CalendarDateValueValidation =
  | { success: true; data: CalendarDateValue }
  | { success: false; error: string }

export type StoredDateValueParse =
  | { success: true; data: StoredDateValue; source: 'calendar' | 'legacy' }
  | { success: false; error: string }

/**
 * A date property is intentionally not a JavaScript Date. Each boundary keeps only the
 * precision the author entered and can optionally be approximate. An absent end is an
 * open-ended value during this transition; a present end is an interval.
 */
export function validateCalendarDateValue(calendar: Calendar, input: unknown): CalendarDateValueValidation {
  const parsed = CalendarDateValueSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Data inválida.' }

  for (const [label, boundary] of [['início', parsed.data.start], ['fim', parsed.data.end]] as const) {
    if (!boundary) continue
    const validation = validateCalendarDate(calendar, toCalendarDate(boundary))
    if (!validation.success) return { success: false, error: `O ${label} é inválido: ${validation.error}` }
  }

  if (parsed.data.end) {
    const startRange = getCalendarDateBoundaryOrdinalRange(calendar, parsed.data.start)
    const endRange = getCalendarDateBoundaryOrdinalRange(calendar, parsed.data.end)
    if (endRange.last < startRange.first) {
      return { success: false, error: 'O fim não pode ser anterior ao início.' }
    }
  }

  return { success: true, data: parsed.data }
}

/** Accepts the new object and the ISO date strings written by previous versions. */
export function parseStoredDateValue(calendar: Calendar, input: unknown): StoredDateValueParse {
  const parsed = CalendarDateValueSchema.safeParse(input)
  if (parsed.success) {
    const validation = validateCalendarDateValue(calendar, parsed.data)
    return validation.success
      ? { success: true, data: validation.data, source: 'calendar' }
      : { success: false, error: validation.error }
  }

  if (typeof input !== 'string' || input.trim() === '') return { success: false, error: 'Informe uma data.' }
  const legacy = parseLegacyIsoDate(input)
  if (!legacy.success) return legacy

  return { success: true, data: input, source: 'legacy' }
}

export function formatDateFieldValue(calendar: Calendar, input: unknown): string {
  if (input === undefined || input === null || input === '') return ''

  const parsed = CalendarDateValueSchema.safeParse(input)
  if (parsed.success) {
    const validation = validateCalendarDateValue(calendar, parsed.data)
    if (validation.success) return formatCalendarDateValue(calendar, validation.data)
    return `Data inválida: ${validation.error}`
  }

  if (typeof input !== 'string') return 'Data inválida.'
  const legacy = parseLegacyIsoDate(input)
  if (!legacy.success) return `Data legada inválida: ${legacy.error}`

  const ordinal = legacyIsoDateToOrdinal(legacy.data)
  try {
    const converted = getCalendarDateAtOrdinal(calendar, ordinal)
    if (converted.month !== undefined && converted.day !== undefined) {
      return formatCalendarDateValue(calendar, { start: converted })
    }
    const year = formatCalendarDate(calendar, { year: converted.year })
    return `${converted.intercalaryRuleName ?? 'Dia intercalar'}, ${year}`
  } catch (error) {
    return error instanceof Error ? `Data legada não representável: ${error.message}` : 'Data legada não representável.'
  }
}

export function formatCalendarDateValue(calendar: Calendar, value: CalendarDateValue): string {
  const start = formatBoundary(calendar, value.start)
  if (!value.end) return start
  return `de ${start} até ${formatBoundary(calendar, value.end)}`
}

export function getDateFieldEditorValue(calendar: Calendar, input: unknown): CalendarDateValue | string | null {
  if (input === undefined || input === null || input === '') return null
  const parsed = parseStoredDateValue(calendar, input)
  if (parsed.success) return parsed.data
  return typeof input === 'string' ? input : null
}

export function parseLegacyIsoDate(input: string):
  | { success: true; data: CalendarDate }
  | { success: false; error: string } {
  const match = /^([+-]?\d{4,6})-(\d{2})-(\d{2})$/.exec(input.trim())
  if (!match) return { success: false, error: 'Use uma data ISO completa no formato AAAA-MM-DD.' }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isSafeInteger(year)) return { success: false, error: 'O ano ISO está fora do limite suportado.' }
  if (month < 1 || month > 12) return { success: false, error: 'O mês ISO não existe.' }
  if (day < 1 || day > gregorianMonthLength(year, month)) return { success: false, error: 'O dia ISO não existe no mês informado.' }
  return { success: true, data: { year, month, day } }
}

function formatBoundary(calendar: Calendar, boundary: CalendarDateBoundary): string {
  const value = formatCalendarDate(calendar, toCalendarDate(boundary))
  return boundary.approximate ? `aprox. ${value}` : value
}

function toCalendarDate(boundary: CalendarDateBoundary): CalendarDate {
  return {
    year: boundary.year,
    ...(boundary.month === undefined ? {} : { month: boundary.month }),
    ...(boundary.day === undefined ? {} : { day: boundary.day }),
  }
}

export function getCalendarDateBoundaryOrdinalRange(calendar: Calendar, boundary: CalendarDateBoundary): CalendarDateOrdinalRange {
  const firstDate: CalendarDate = { year: boundary.year, month: boundary.month ?? 1, day: boundary.day ?? 1 }
  const first = dateToOrdinal(calendar, firstDate)
  if (boundary.month !== undefined && boundary.day !== undefined) return { first, last: first }

  if (boundary.month !== undefined) {
    const intercalaryDays = calendar.intercalaryRules.filter((rule) =>
      rule.month === boundary.month && rule.extendsMonth && isIntercalaryRuleActive(rule, boundary.year)).length
    return { first, last: first + calendar.months[boundary.month - 1].length - 1 + intercalaryDays }
  }

  return { first, last: first + getCalendarYearLength(calendar, boundary.year) - 1 }
}

export function legacyIsoDateToOrdinal(date: CalendarDate): number {
  const defaultCalendar = createDefaultCalendar()
  const yearStart = dateToOrdinal(defaultCalendar, { year: date.year, month: 1, day: 1 })
  const monthLengths = defaultCalendar.months.map((month) => month.length)
  const daysBeforeMonth = monthLengths.slice(0, (date.month ?? 1) - 1).reduce((total, length) => total + length, 0)
  const leapDay = isGregorianLeapYear(date.year) && (date.month ?? 1) > 2 ? 1 : 0
  return yearStart + daysBeforeMonth + leapDay + (date.day ?? 1) - 1
}

function gregorianMonthLength(year: number, month: number): number {
  if (month === 2) return isGregorianLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function isGregorianLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}
