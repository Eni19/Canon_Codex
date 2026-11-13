import { z } from 'zod'
import { dateToOrdinal, getCalendarDateAtOrdinal, getMonthLength, isIntercalaryRuleActive, type Calendar } from './calendar'

/** Exact dates include ordinary days and independent intercalary days. */
export const CalendarExactDateSchema = z.union([
  z.object({ year: z.number().int().safe(), month: z.number().int().positive(), day: z.number().int().positive() }).strict(),
  z.object({ year: z.number().int().safe(), intercalaryRuleId: z.string().trim().min(1).max(80) }).strict(),
])
export type CalendarExactDate = z.infer<typeof CalendarExactDateSchema>

export function exactDateToOrdinal(calendar: Calendar, input: CalendarExactDate): number {
  const date = CalendarExactDateSchema.parse(input)
  if ('month' in date) return dateToOrdinal(calendar, date)
  const rule = calendar.intercalaryRules.find((item) => item.id === date.intercalaryRuleId)
  if (!rule || rule.extendsMonth || !isIntercalaryRuleActive(rule, date.year)) throw new RangeError('O dia intercalar não existe neste ano.')
  const lastDay = getMonthLength(calendar, date.year, rule.month)
  const prior = calendar.intercalaryRules.filter((item) => item.month === rule.month && !item.extendsMonth && isIntercalaryRuleActive(item, date.year))
  const ordinal = dateToOrdinal(calendar, { year: date.year, month: rule.month, day: lastDay }) + 1 + prior.findIndex((item) => item.id === rule.id)
  if (!Number.isSafeInteger(ordinal)) throw new RangeError('A data está além do limite numérico suportado.')
  return ordinal
}

export function exactDateAtOrdinal(calendar: Calendar, ordinal: number): CalendarExactDate {
  const result = getCalendarDateAtOrdinal(calendar, ordinal)
  if (result.month !== undefined && result.day !== undefined) return { year: result.year, month: result.month, day: result.day }
  if (result.intercalaryRuleId !== undefined) return { year: result.year, intercalaryRuleId: result.intercalaryRuleId }
  throw new RangeError('O ordinal não corresponde a uma data exata.')
}
