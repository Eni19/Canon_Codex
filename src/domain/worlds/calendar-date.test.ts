import { describe, expect, it } from 'vitest'
import { CalendarSchema, createDefaultCalendar } from './calendar'
import {
  CalendarDateValueSchema,
  formatDateFieldValue,
  formatCalendarDateValue,
  parseStoredDateValue,
  validateCalendarDateValue,
} from './calendar-date'

describe('valores de data do calendário do mundo', () => {
  it('aceita ano, mês, dia, aproximação e intervalo sem usar Date', () => {
    const calendar = createDefaultCalendar()
    const value = {
      start: { year: -2, month: 2, approximate: true },
      end: { year: 0, month: 3, day: 4 },
    }

    expect(validateCalendarDateValue(calendar, value)).toMatchObject({ success: true })
    expect(formatCalendarDateValue(calendar, value)).toContain('aprox.')
    expect(formatCalendarDateValue(calendar, value)).toContain('até')
    expect(formatCalendarDateValue(calendar, { start: { year: 0 } })).toContain('ano 0')
  })

  it('rejeita lacuna de precisão, data inexistente e intervalo invertido', () => {
    const calendar = createDefaultCalendar()

    expect(CalendarDateValueSchema.safeParse({ start: { year: 1, day: 2 } }).success).toBe(false)
    expect(validateCalendarDateValue(calendar, { start: { year: 0, month: 2, day: 30 } })).toMatchObject({
      success: false,
      error: expect.stringContaining('não existe'),
    })
    expect(validateCalendarDateValue(calendar, { start: { year: 2 }, end: { year: 1 } })).toEqual({
      success: false,
      error: 'O fim não pode ser anterior ao início.',
    })
  })

  it('lê ISO legado e normaliza datas representáveis pelo calendário atual', () => {
    const calendar = createDefaultCalendar()
    const converted = parseStoredDateValue(calendar, '2024-03-01')
    expect(converted).toMatchObject({ success: true, source: 'legacy', data: { start: { year: 2024, month: 3, day: 1 } } })

    const leapDay = parseStoredDateValue(calendar, '2024-02-29')
    expect(leapDay).toMatchObject({ success: true, source: 'legacy', data: { start: { year: 2024, month: 2, day: 29 } } })
    expect(formatDateFieldValue(calendar, '2024-02-29')).toContain('29 de Fevereiro')
  })

  it('usa um segundo calendário sem depender da quantidade de meses gregorianos', () => {
    const calendar = CalendarSchema.parse({
      ...createDefaultCalendar(),
      months: [{ name: 'Aurora', length: 20 }, { name: 'Crepúsculo', length: 20 }],
      intercalaryRules: [],
      origin: { name: 'Marco Lunar', month: 2, day: 3 },
    })
    const value = { start: { year: -1, month: 2, day: 20 }, end: { year: 0, month: 1 } }

    expect(validateCalendarDateValue(calendar, value)).toMatchObject({ success: true })
    expect(formatCalendarDateValue(calendar, value)).toContain('Crepúsculo')
    expect(formatDateFieldValue(calendar, '2000-01-01')).toContain('Aurora')
  })
})
