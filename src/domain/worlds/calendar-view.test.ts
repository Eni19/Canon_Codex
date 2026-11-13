import { describe, expect, it } from 'vitest'
import { createDefaultCalendar } from './calendar'
import { adjacentMonth, projectMonth } from './calendar-view'

describe('calendar view projection', () => {
  it('navigates through year zero at the ends of the calendar', () => {
    const calendar = createDefaultCalendar()
    expect(adjacentMonth(calendar, -1, 12, 1)).toEqual({ year: 0, month: 1 })
    expect(adjacentMonth(calendar, 0, 12, 1)).toEqual({ year: 1, month: 1 })
    expect(adjacentMonth(calendar, 0, 1, -1)).toEqual({ year: -1, month: 12 })
  })

  it('uses leap days and lists independent intercalary days after their month', () => {
    const calendar = createDefaultCalendar()
    calendar.intercalaryRules.push({ id: 'festival', name: 'Festival', month: 2, everyYears: 1, yearOffset: 0, extendsMonth: false })
    expect(projectMonth(calendar, 0, 2).length).toBe(29)
    expect(projectMonth(calendar, 1, 2).length).toBe(28)
    expect(projectMonth(calendar, 0, 2).intercalary.map((rule) => rule.name)).toEqual(['Festival'])
  })

  it('bounds the first and last pages of a million-day month', () => {
    const calendar = createDefaultCalendar()
    calendar.months[0].length = 1_000_000
    const first = projectMonth(calendar, -1, 1, 1)
    const last = projectMonth(calendar, -1, 1, 1_000_000)
    expect(first.days[0]).toBe(1)
    expect(last.days.at(-1)).toBe(1_000_000)
    expect(first.days.length).toBeLessThanOrEqual(42)
    expect(last.days.length).toBeLessThanOrEqual(42)
  })
})
