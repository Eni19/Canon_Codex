import { describe, expect, it } from 'vitest'
import { createDefaultCalendar } from './calendar'
import { projectAgenda } from './calendar-agenda'

describe('calendar agenda', () => {
  it('selects overlapping intervals and preserves approximate and partial precision', () => {
    const calendar = createDefaultCalendar()
    const entries = projectAgenda(calendar, 1, 2, [
      { id: 'outside', title: 'Fora', date: { start: { year: 1, month: 3, day: 1 } } },
      { id: 'interval', title: 'Festival', date: { start: { year: 1, month: 1, day: 31 }, end: { year: 1, month: 2, day: 2 } } },
      { id: 'partial', title: 'Ano', date: { start: { year: 1 } } },
      { id: 'approx', title: 'Incerto', date: { start: { year: 1, month: 2, day: 12, approximate: true } } },
      { id: 'invalid', title: 'Inválido', date: 'invalido' },
    ])
    expect(entries.map((entry) => entry.id)).toEqual(['partial', 'interval', 'approx'])
    expect(entries.filter((entry) => entry.uncertain).map((entry) => entry.id)).toEqual(['partial', 'approx'])
    expect(entries[2].label).toContain('aprox.')
  })

  it('converts legacy ISO dates using ordinal rather than treating them as fictional dates', () => {
    const calendar = createDefaultCalendar()
    calendar.months[0].name = 'Primeiro'
    expect(projectAgenda(calendar, 2024, 2, [{ id: 'old', title: 'Registro', date: '2024-02-29' }]).map((entry) => entry.id)).toEqual(['old'])
  })
})
