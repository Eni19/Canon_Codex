import { z } from 'zod'

const MAX_MONTHS = 36
export const MAX_DAYS_IN_MONTH = 1_000_000
const MAX_HOURS_PER_DAY = 1_000

export const CalendarMonthSchema = z.object({
  name: z.string().trim().min(1, 'O nome do mês é obrigatório.').max(60),
  length: z.number().int().positive('O comprimento do mês deve ser positivo.').max(MAX_DAYS_IN_MONTH),
})

export const IntercalaryRuleSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1, 'O nome do dia intercalar é obrigatório.').max(80),
  month: z.number().int().positive('A regra intercalar precisa apontar para um mês positivo.'),
  everyYears: z.number().int().positive('A recorrência precisa ser de pelo menos um ano.'),
  yearOffset: z.number().int().nonnegative().default(0),
  skipEveryYears: z.number().int().positive().optional(),
  includeEveryYears: z.number().int().positive().optional(),
})

export const CalendarOriginSchema = z.object({
  name: z.string().trim().min(1, 'O nome da origem é obrigatório.').max(100),
  month: z.number().int().positive(),
  day: z.number().int().positive(),
})

export const CalendarSchema = z.object({
  daysOfWeek: z.array(z.string().trim().min(1, 'Todo dia da semana precisa ter um nome.').max(40)).length(7, 'Informe exatamente sete dias da semana.'),
  months: z.array(CalendarMonthSchema).min(1, 'Informe pelo menos um mês.').max(MAX_MONTHS),
  hoursPerDay: z.number().int().positive('As horas por dia devem ser positivas.').max(MAX_HOURS_PER_DAY),
  eras: z.object({
    before: z.string().trim().min(1, 'Informe o nome da era anterior à origem.').max(80),
    after: z.string().trim().min(1, 'Informe o nome da era posterior à origem.').max(80),
  }),
  origin: CalendarOriginSchema,
  intercalaryRules: z.array(IntercalaryRuleSchema).max(100),
}).superRefine((calendar, context) => {
  const dayNames = new Set<string>()
  for (const [index, name] of calendar.daysOfWeek.entries()) {
    const normalized = name.toLocaleLowerCase()
    if (dayNames.has(normalized)) context.addIssue({ code: 'custom', path: ['daysOfWeek', index], message: 'Os nomes dos dias da semana precisam ser únicos.' })
    dayNames.add(normalized)
  }

  const monthNames = new Set<string>()
  for (const [index, month] of calendar.months.entries()) {
    const normalized = month.name.toLocaleLowerCase()
    if (monthNames.has(normalized)) context.addIssue({ code: 'custom', path: ['months', index, 'name'], message: 'Os nomes dos meses precisam ser únicos.' })
    monthNames.add(normalized)
  }

  if (calendar.origin.month > calendar.months.length) {
    context.addIssue({ code: 'custom', path: ['origin', 'month'], message: 'A origem precisa apontar para um mês existente.' })
  } else if (calendar.origin.day > calendar.months[calendar.origin.month - 1].length) {
    context.addIssue({ code: 'custom', path: ['origin', 'day'], message: 'O dia da origem não existe no mês escolhido.' })
  }

  const ruleIds = new Set<string>()
  for (const [index, rule] of calendar.intercalaryRules.entries()) {
    if (ruleIds.has(rule.id)) context.addIssue({ code: 'custom', path: ['intercalaryRules', index, 'id'], message: 'Os identificadores das regras intercalares precisam ser únicos.' })
    ruleIds.add(rule.id)
    if (rule.month > calendar.months.length) {
      context.addIssue({ code: 'custom', path: ['intercalaryRules', index, 'month'], message: 'A regra intercalar precisa apontar para um mês existente.' })
    }
    if (rule.yearOffset >= rule.everyYears) {
      context.addIssue({ code: 'custom', path: ['intercalaryRules', index, 'yearOffset'], message: 'O deslocamento deve ser menor que a recorrência.' })
    }
    if (rule.includeEveryYears !== undefined && rule.skipEveryYears === undefined) {
      context.addIssue({ code: 'custom', path: ['intercalaryRules', index, 'includeEveryYears'], message: 'A exceção de inclusão precisa acompanhar uma exceção de salto.' })
    }
  }
})

export type Calendar = z.infer<typeof CalendarSchema>
export type CalendarMonth = z.infer<typeof CalendarMonthSchema>
export type IntercalaryRule = z.infer<typeof IntercalaryRuleSchema>

export const CalendarDateSchema = z.object({
  year: z.number().int().safe(),
  month: z.number().int().positive().optional(),
  day: z.number().int().positive().optional(),
}).superRefine((date, context) => {
  if (date.day !== undefined && date.month === undefined) context.addIssue({ code: 'custom', path: ['day'], message: 'O dia precisa vir acompanhado de um mês.' })
})
export type CalendarDate = z.infer<typeof CalendarDateSchema>

export type CalendarDateValidation =
  | { success: true; data: CalendarDate }
  | { success: false; error: string }

export interface CalendarDateAtOrdinal {
  year: number
  month?: number
  day?: number
  intercalaryRuleId?: string
  intercalaryRuleName?: string
}

export function createDefaultCalendar(): Calendar {
  return CalendarSchema.parse({
    daysOfWeek: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
    months: [
      ['Janeiro', 31], ['Fevereiro', 28], ['Março', 31], ['Abril', 30], ['Maio', 31], ['Junho', 30],
      ['Julho', 31], ['Agosto', 31], ['Setembro', 30], ['Outubro', 31], ['Novembro', 30], ['Dezembro', 31],
    ].map(([name, length]) => ({ name, length })),
    hoursPerDay: 24,
    eras: { before: 'Antes da Origem', after: 'Depois da Origem' },
    origin: { name: 'Origem', month: 1, day: 1 },
    intercalaryRules: [{
      id: 'gregorian-leap-day',
      name: 'Dia bissexto',
      month: 2,
      everyYears: 4,
      yearOffset: 0,
      skipEveryYears: 100,
      includeEveryYears: 400,
    }],
  })
}

export function validateCalendarDate(calendar: Calendar, input: unknown): CalendarDateValidation {
  const parsed = CalendarDateSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Data inválida.' }
  const date = parsed.data
  if (date.month === undefined) return { success: true, data: date }
  if (date.month > calendar.months.length) return { success: false, error: 'O mês informado não existe neste calendário.' }
  if (date.day !== undefined && date.day > calendar.months[date.month - 1].length) return { success: false, error: 'O dia informado não existe no mês escolhido.' }
  return { success: true, data: date }
}

export function getCalendarYearLength(calendar: Calendar, year: number): number {
  assertSafeInteger(year, 'Ano inválido.')
  return getBaseYearLength(calendar) + calendar.intercalaryRules.filter((rule) => isIntercalaryRuleActive(rule, year)).length
}

export function isIntercalaryRuleActive(rule: IntercalaryRule, year: number): boolean {
  if (mod(year - rule.yearOffset, rule.everyYears) !== 0) return false
  if (rule.skipEveryYears === undefined || mod(year, rule.skipEveryYears) !== 0) return true
  return rule.includeEveryYears !== undefined && mod(year, rule.includeEveryYears) === 0
}

export function dateToOrdinal(calendar: Calendar, input: CalendarDate): number {
  const validation = validateCalendarDate(calendar, input)
  if (!validation.success) {
    throw new CalendarDateError(validation.error)
  }

  const { year, month, day } = validation.data
  if (month === undefined || day === undefined) {
    throw new CalendarDateError('A data precisa informar mês e dia.')
  }

  const ordinal = daysBeforeYear(calendar, year) + daysBeforeMonth(calendar, year, month) + day - 1
    + getIntercalaryDaysBeforeMonth(calendar, year, month)
  return assertSafeInteger(ordinal, 'A data está além do limite numérico suportado.')
}

export function getCalendarDateAtOrdinal(calendar: Calendar, ordinal: number): CalendarDateAtOrdinal {
  assertSafeInteger(ordinal, 'Ordinal inválido.')
  const year = findYearAtOrdinal(calendar, ordinal)
  let remaining = ordinal - daysBeforeYear(calendar, year)

  for (let month = 1; month <= calendar.months.length; month += 1) {
    const monthLength = calendar.months[month - 1].length
    if (remaining < monthLength) return { year, month, day: remaining + 1 }
    remaining -= monthLength

    for (const rule of calendar.intercalaryRules) {
      if (rule.month !== month || !isIntercalaryRuleActive(rule, year)) continue
      if (remaining === 0) return { year, intercalaryRuleId: rule.id, intercalaryRuleName: rule.name }
      remaining -= 1
    }
  }

  throw new CalendarDateError('O ordinal não pôde ser convertido neste calendário.')
}

export function formatCalendarDate(calendar: Calendar, input: CalendarDate): string {
  const validation = validateCalendarDate(calendar, input)
  if (!validation.success) return `Data inválida: ${validation.error}`
  const date = validation.data
  const yearLabel = date.year === 0
    ? `ano 0 · ${calendar.origin.name}`
    : `ano ${date.year} · ${date.year < 0 ? calendar.eras.before : calendar.eras.after}`
  if (date.month === undefined) return yearLabel

  const month = calendar.months[date.month - 1].name
  if (date.day === undefined) return `${month}, ${yearLabel}`
  const weekday = calendar.daysOfWeek[mod(dateToOrdinal(calendar, date), calendar.daysOfWeek.length)]
  return `${weekday}, ${date.day} de ${month}, ${yearLabel}`
}

export function formatCalendarDateForPreview(calendar: Calendar, input: CalendarDate): string {
  try {
    return formatCalendarDate(calendar, input)
  } catch (error) {
    if (error instanceof CalendarDateError) return `Prévia indisponível: ${error.message}`
    return 'Prévia indisponível: corrija os valores do calendário.'
  }
}

export class CalendarDateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CalendarDateError'
  }
}

function getBaseYearLength(calendar: Calendar): number {
  return calendar.months.reduce((total, month) => total + month.length, 0)
}

function daysBeforeYear(calendar: Calendar, year: number): number {
  const baseDays = getBaseYearLength(calendar)
  const extraDays = year >= 0
    ? countIntercalaryDaysInRange(calendar, 0, year)
    : -countIntercalaryDaysInRange(calendar, year, 0)
  return assertSafeInteger(year * baseDays + extraDays, 'O ordinal está além do limite numérico suportado.')
}

function countIntercalaryDaysInRange(calendar: Calendar, start: number, end: number): number {
  if (start >= end) return 0
  return calendar.intercalaryRules.reduce((total, rule) => total + countRuleMatchesInRange(rule, start, end), 0)
}

function countRuleMatchesInRange(rule: IntercalaryRule, start: number, end: number): number {
  const base = { residue: mod(rule.yearOffset, rule.everyYears), modulus: rule.everyYears }
  let count = countCongruenceInRange(base, start, end)
  if (rule.skipEveryYears !== undefined) {
    const skipped = mergeCongruences(base, { residue: 0, modulus: rule.skipEveryYears })
    count -= skipped ? countCongruenceInRange(skipped, start, end) : 0
    if (rule.includeEveryYears !== undefined && skipped) {
      const included = mergeCongruences(skipped, { residue: 0, modulus: rule.includeEveryYears })
      count += included ? countCongruenceInRange(included, start, end) : 0
    }
  }
  return count
}

function countCongruenceInRange(congruence: Congruence, start: number, end: number): number {
  const first = Math.ceil((start - congruence.residue) / congruence.modulus)
  const last = Math.ceil((end - congruence.residue) / congruence.modulus)
  return Math.max(0, last - first)
}

interface Congruence { residue: number; modulus: number }

function mergeCongruences(left: Congruence, right: Congruence): Congruence | null {
  const divisor = gcd(left.modulus, right.modulus)
  const difference = right.residue - left.residue
  if (mod(difference, divisor) !== 0) return null

  const leftReduced = left.modulus / divisor
  const rightReduced = right.modulus / divisor
  const multiplier = mod((difference / divisor) * modularInverse(mod(leftReduced, rightReduced), rightReduced), rightReduced)
  const modulus = left.modulus * rightReduced
  return { residue: mod(left.residue + left.modulus * multiplier, modulus), modulus }
}

function modularInverse(value: number, modulus: number): number {
  if (modulus === 1) return 0
  let oldR = value
  let r = modulus
  let oldS = 1
  let s = 0
  while (r !== 0) {
    const quotient = Math.floor(oldR / r)
    ;[oldR, r] = [r, oldR - quotient * r]
    ;[oldS, s] = [s, oldS - quotient * s]
  }
  return mod(oldS, modulus)
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left)
  let b = Math.abs(right)
  while (b !== 0) [a, b] = [b, a % b]
  return a
}

function findYearAtOrdinal(calendar: Calendar, ordinal: number): number {
  const baseDays = getBaseYearLength(calendar)
  const estimate = Math.floor(ordinal / baseDays)
  let low = Math.min(0, estimate - 2)
  let high = Math.max(0, estimate + 2)
  while (daysBeforeYear(calendar, low) > ordinal) low = low - Math.max(1, Math.abs(low))
  while (daysBeforeYear(calendar, high) <= ordinal) high = high + Math.max(1, Math.abs(high))

  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)
    if (daysBeforeYear(calendar, middle) <= ordinal) low = middle
    else high = middle
  }
  return low
}

function daysBeforeMonth(calendar: Calendar, _year: number, month: number): number {
  return calendar.months.slice(0, month - 1).reduce((total, current) => total + current.length, 0)
}

function getIntercalaryDaysBeforeMonth(calendar: Calendar, year: number, month: number): number {
  return calendar.intercalaryRules.filter((rule) => rule.month < month && isIntercalaryRuleActive(rule, year)).length
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function assertSafeInteger(value: number, message: string): number {
  if (!Number.isSafeInteger(value)) throw new CalendarDateError(message)
  return value
}
