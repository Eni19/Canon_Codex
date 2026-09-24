import { describe, expect, it } from 'vitest'
import {
  CalendarSchema,
  createDefaultCalendar,
  dateToOrdinal,
  formatCalendarDate,
  formatCalendarDateForPreview,
  getCalendarDateAtOrdinal,
  getCalendarYearLength,
  validateCalendarDate,
} from './calendar'

describe('calendário do mundo', () => {
  it('calcula datas antes, no e depois do ano zero sem usar Date', () => {
    const calendar = createDefaultCalendar()

    expect(dateToOrdinal(calendar, { year: -1, month: 1, day: 1 })).toBe(-365)
    expect(dateToOrdinal(calendar, { year: 0, month: 1, day: 1 })).toBe(0)
    expect(dateToOrdinal(calendar, { year: 1, month: 1, day: 1 })).toBe(366)
    expect(formatCalendarDate(calendar, { year: -1, month: 1, day: 1 })).toContain('Antes da Origem')
    expect(formatCalendarDate(calendar, { year: 0, month: 1, day: 1 })).toContain('Origem')
    expect(formatCalendarDate(calendar, { year: 1, month: 1, day: 1 })).toContain('Depois da Origem')
  })

  it('inclui o dia bissexto na duração e faz round-trip ordinal', () => {
    const calendar = createDefaultCalendar()
    const leapDay = dateToOrdinal(calendar, { year: 0, month: 3, day: 1 }) - 1

    expect(getCalendarYearLength(calendar, 0)).toBe(366)
    expect(getCalendarYearLength(calendar, 1)).toBe(365)
    expect(getCalendarDateAtOrdinal(calendar, leapDay)).toMatchObject({
      year: 0,
      intercalaryRuleId: 'gregorian-leap-day',
    })
    expect(getCalendarDateAtOrdinal(calendar, dateToOrdinal(calendar, { year: 1, month: 2, day: 28 }))).toMatchObject({
      year: 1,
      month: 2,
      day: 28,
    })
  })

  it('faz round-trip com meses irregulares e regra intercalar em anos negativos e positivos', () => {
    const calendar = CalendarSchema.parse({
      ...createDefaultCalendar(),
      months: [{ name: 'Aurora', length: 2 }, { name: 'Crepúsculo', length: 3 }],
      intercalaryRules: [{ id: 'extra', name: 'Dia extra', month: 1, everyYears: 2, yearOffset: 0 }],
      origin: { name: 'Marco', month: 2, day: 2 },
    })

    expect(getCalendarYearLength(calendar, -1)).toBe(5)
    expect(getCalendarYearLength(calendar, 0)).toBe(6)
    for (const date of [
      { year: -1, month: 2, day: 3 },
      { year: 0, month: 2, day: 1 },
      { year: 1, month: 1, day: 2 },
    ]) {
      expect(getCalendarDateAtOrdinal(calendar, dateToOrdinal(calendar, date))).toMatchObject(date)
    }
  })

  it('rejeita mês não positivo e data fora do mês com explicação', () => {
    const invalidCalendar = {
      ...createDefaultCalendar(),
      months: [{ name: 'Vazio', length: 0 }],
    }
    const calendarResult = CalendarSchema.safeParse(invalidCalendar)
    expect(calendarResult.success).toBe(false)
    if (!calendarResult.success) expect(calendarResult.error.issues.some((issue) => issue.message.includes('positivo'))).toBe(true)

    const result = validateCalendarDate(createDefaultCalendar(), { year: 0, month: 2, day: 30 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('não existe')
  })

  it('valida regras repetíveis contra os meses existentes', () => {
    const result = CalendarSchema.safeParse({
      ...createDefaultCalendar(),
      intercalaryRules: [{ id: 'r', name: 'Extra', month: 99, everyYears: 2, yearOffset: 0 }],
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some((issue) => issue.message.includes('mês'))).toBe(true)
  })

  it('mantém a prévia segura enquanto um campo numérico inválido é editado', () => {
    const calendar = createDefaultCalendar()
    calendar.months[0].length = Number.MAX_SAFE_INTEGER + 1

    expect(formatCalendarDateForPreview(calendar, { year: 1, month: 1, day: 1 })).toContain('Prévia indisponível')
  })
})
