import { describe, expect, it } from 'vitest'
import { createDefaultCalendar, dateToOrdinal } from './calendar'
import { CalendarExactDateSchema, exactDateAtOrdinal, exactDateToOrdinal } from './calendar-exact-date'

describe('exact calendar dates', () => {
  it('round-trips ordinary and independent intercalary dates across year zero', () => {
    const calendar = createDefaultCalendar()
    calendar.intercalaryRules.push(
      { id: 'festival-a', name: 'Festival A', month: 12, everyYears: 1, yearOffset: 0, extendsMonth: false },
      { id: 'festival-b', name: 'Festival B', month: 12, everyYears: 2, yearOffset: 0, extendsMonth: false },
    )
    for (const year of [-2, -1, 0, 1, 2]) {
      const last = dateToOrdinal(calendar, { year, month: 12, day: 31 })
      const dates = [{ year, month: 12, day: 31 }, { year, intercalaryRuleId: 'festival-a' }, ...(year % 2 === 0 ? [{ year, intercalaryRuleId: 'festival-b' }] : [])]
      dates.forEach((date, index) => {
        expect(exactDateToOrdinal(calendar, date)).toBe(last + index)
        expect(exactDateAtOrdinal(calendar, last + index)).toEqual(date)
      })
      expect(exactDateAtOrdinal(calendar, last + dates.length)).toEqual({ year: year + 1, month: 1, day: 1 })
    }
  })

  it('rejects missing, inactive and month-extending rules and mixed forms', () => {
    const calendar = createDefaultCalendar()
    calendar.intercalaryRules.push({ id: 'festival', name: 'Festival', month: 1, everyYears: 2, yearOffset: 0, extendsMonth: false })
    expect(() => exactDateToOrdinal(calendar, { year: 1, intercalaryRuleId: 'festival' })).toThrow()
    expect(() => exactDateToOrdinal(calendar, { year: 0, intercalaryRuleId: 'gregorian-leap-day' })).toThrow()
    expect(() => exactDateToOrdinal(calendar, { year: 0, intercalaryRuleId: 'missing' })).toThrow()
    expect(CalendarExactDateSchema.safeParse({ year: 0, month: 1, day: 1, intercalaryRuleId: 'festival' }).success).toBe(false)
  })
})
