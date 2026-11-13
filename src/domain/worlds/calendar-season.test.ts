import { describe, expect, it } from 'vitest'
import { createDefaultCalendar } from './calendar'
import { seasonAtDate, seasonAtExactDate, validateCalendarSeasons } from './calendar-season'

describe('calendar seasons', () => {
  const calendar = createDefaultCalendar()
  const seasons = [
    { id: 'summer', name: 'Verão', color: '#ffbb00', start: { month: 6, day: 15 } },
    { id: 'winter', name: 'Inverno', color: '#5599ff', start: { month: 12, day: 20 } },
    { id: 'spring', name: 'Primavera', color: '#55aa77', start: { month: 3, day: 10 } },
  ]

  it('changes at the beginning of a season and wraps around the year, including year zero', () => {
    for (const year of [-1, 0, 1]) {
      expect(seasonAtDate(calendar, seasons, { year, month: 1, day: 1 })?.id).toBe('winter')
      expect(seasonAtDate(calendar, seasons, { year, month: 3, day: 9 })?.id).toBe('winter')
      expect(seasonAtDate(calendar, seasons, { year, month: 3, day: 10 })?.id).toBe('spring')
      expect(seasonAtDate(calendar, seasons, { year, month: 6, day: 15 })?.id).toBe('summer')
    }
  })

  it('supports no seasons, one season and dates on an extended intercalary day', () => {
    expect(seasonAtDate(calendar, [], { year: 0, month: 1, day: 1 })).toBeNull()
    expect(seasonAtDate(calendar, [seasons[0]], { year: 0, month: 2, day: 29 })?.id).toBe('summer')
    expect(() => seasonAtDate(calendar, seasons, { year: 1, month: 2, day: 29 })).toThrow()
  })

  it('keeps the preceding season on an independent intercalary day', () => {
    const custom = createDefaultCalendar()
    custom.intercalaryRules.push({ id: 'festival', name: 'Festival', month: 12, everyYears: 1, yearOffset: 0, extendsMonth: false })
    expect(seasonAtExactDate(custom, seasons, { year: 0, intercalaryRuleId: 'festival' })?.id).toBe('winter')
  })

  it('rejects duplicate starts and ids, non-recurring days and invalid colors', () => {
    expect(validateCalendarSeasons(calendar, [seasons[0], { ...seasons[1], id: seasons[0].id }]).success).toBe(false)
    expect(validateCalendarSeasons(calendar, [seasons[0], { ...seasons[1], start: seasons[0].start }]).success).toBe(false)
    expect(validateCalendarSeasons(calendar, [{ ...seasons[0], start: { month: 2, day: 29 } }]).success).toBe(false)
    expect(validateCalendarSeasons(calendar, [{ ...seasons[0], color: 'red' }]).success).toBe(false)
  })
})
