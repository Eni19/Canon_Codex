import { z } from 'zod'
import { CalendarDateFieldsSchema, dateToOrdinal, validateCalendarDate, type Calendar } from './calendar'

const SCALE = 1000

/** Cycles have at most three decimal places, represented as thousandths of a day. */
export const CalendarMoonSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  cycleDays: z.number().min(0.001).max(1_000_000).refine(
    (value) => Math.abs(value * SCALE - Math.round(value * SCALE)) < 0.000001,
    'Use no máximo três casas decimais para o ciclo.',
  ),
  newMoon: CalendarDateFieldsSchema.extend({ month: z.number().int().positive(), day: z.number().int().positive() }),
})

export type CalendarMoon = z.infer<typeof CalendarMoonSchema>
export const CalendarMoonsSchema = z.array(CalendarMoonSchema).max(5, 'Configure no máximo cinco luas.').superRefine((moons, context) => {
  const ids = new Set<string>()
  moons.forEach((moon, index) => {
    if (ids.has(moon.id)) context.addIssue({ code: 'custom', path: [index, 'id'], message: 'Os identificadores das luas precisam ser únicos.' })
    ids.add(moon.id)
  })
})

const PHASES = ['Lua nova', 'Crescente', 'Quarto crescente', 'Gibosa crescente', 'Lua cheia', 'Gibosa minguante', 'Quarto minguante', 'Minguante'] as const

/** Validate the reference against the world's current calendar before storing or projecting it. */
export function validateCalendarMoon(calendar: Calendar, input: unknown) {
  const parsed = CalendarMoonSchema.safeParse(input)
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Lua inválida.' }
  const date = validateCalendarDate(calendar, parsed.data.newMoon)
  if (!date.success) return { success: false as const, error: date.error }
  try { dateToOrdinal(calendar, parsed.data.newMoon) } catch { return { success: false as const, error: 'A data de referência está fora do limite de precisão.' } }
  return { success: true as const, data: parsed.data }
}

/** Project an ordinal day, including independent intercalary days, from a new-moon anchor. */
export function projectMoonPhase(calendar: Calendar, moon: CalendarMoon, ordinal: number) {
  const validation = validateCalendarMoon(calendar, moon)
  if (!validation.success) throw new RangeError(validation.error)
  if (!Number.isSafeInteger(ordinal)) throw new RangeError('O ordinal precisa ser um inteiro seguro.')
  const anchor = dateToOrdinal(calendar, validation.data.newMoon)
  if (!Number.isSafeInteger(anchor)) throw new RangeError('A data de referência está fora do limite de precisão.')
  const cycle = BigInt(Math.round(validation.data.cycleDays * SCALE))
  const difference = (BigInt(ordinal) - BigInt(anchor)) * BigInt(SCALE)
  const remainder = ((difference % cycle) + cycle) % cycle
  const position = Number(remainder) / Number(cycle)
  const illuminated = (1 - Math.cos(2 * Math.PI * position)) / 2
  const phase = PHASES[Math.floor(position * 8 + 0.5) % 8]
  return { position, illuminated, phase, waxing: position < 0.5 }
}
