import { describe, expect, it } from 'vitest'
import { createDefaultCalendar, dateToOrdinal } from './calendar'
import { projectMoonPhase, validateCalendarMoon } from './calendar-moon'

const moon = { id: 'lua', name: 'Lua', color: '#aabbcc', cycleDays: 8, newMoon: { year: 0, month: 1, day: 1 } }

describe('calendar moon phases', () => {
  const calendar = createDefaultCalendar()
  const anchor = dateToOrdinal(calendar, moon.newMoon)

  it('projects the eight named phases, light and direction', () => {
    expect(Array.from({ length: 8 }, (_, day) => projectMoonPhase(calendar, moon, anchor + day).phase)).toEqual([
      'Lua nova', 'Crescente', 'Quarto crescente', 'Gibosa crescente', 'Lua cheia', 'Gibosa minguante', 'Quarto minguante', 'Minguante',
    ])
    expect(projectMoonPhase(calendar, moon, anchor).illuminated).toBe(0)
    expect(projectMoonPhase(calendar, moon, anchor + 4).illuminated).toBe(1)
    expect(projectMoonPhase(calendar, moon, anchor + 2).waxing).toBe(true)
    expect(projectMoonPhase(calendar, moon, anchor + 6).waxing).toBe(false)
  })

  it('uses positive modulo before the reference and preserves precision at large ordinals', () => {
    const fractional = { ...moon, cycleDays: 2.125 }
    expect(projectMoonPhase(calendar, fractional, anchor - 1).position).toBeCloseTo(1.125 / 2.125)
    const distant = Number.MAX_SAFE_INTEGER
    expect(projectMoonPhase(calendar, fractional, distant).position).toBe(Number((BigInt(distant) * BigInt(1000)) % BigInt(2125)) / 2125)
  })

  it('continues across year boundaries and independent intercalary days', () => {
    calendar.intercalaryRules.push({ id: 'festival', name: 'Festival', month: 12, everyYears: 1, yearOffset: 0, extendsMonth: false })
    const before = dateToOrdinal(calendar, { year: -1, month: 12, day: 31 })
    const after = dateToOrdinal(calendar, { year: 0, month: 1, day: 1 })
    expect(after - before).toBe(2)
    expect(projectMoonPhase(calendar, moon, before + 1).position).toBe(7 / 8)
    expect(projectMoonPhase(calendar, moon, after).position).toBe(0)
  })

  it('continues the cycle across a month boundary', () => {
    const custom = createDefaultCalendar()
    const last = dateToOrdinal(custom, { year: 1, month: 1, day: 31 })
    const first = dateToOrdinal(custom, { year: 1, month: 2, day: 1 })
    expect(first - last).toBe(1)
    const previous = projectMoonPhase(custom, moon, last).position
    const next = projectMoonPhase(custom, moon, first).position
    expect(next).toBeCloseTo((previous + 1 / moon.cycleDays) % 1)
  })

  it('rejects invalid cycles, dates and unsafe ordinals', () => {
    expect(validateCalendarMoon(calendar, { ...moon, cycleDays: 0 }).success).toBe(false)
    expect(validateCalendarMoon(calendar, { ...moon, cycleDays: 1.2345 }).success).toBe(false)
    expect(validateCalendarMoon(calendar, { ...moon, newMoon: { year: 1, month: 2, day: 29 } }).success).toBe(false)
    expect(() => projectMoonPhase(calendar, moon, Number.MAX_SAFE_INTEGER + 1)).toThrow()
  })
})
