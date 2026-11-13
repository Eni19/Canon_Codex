import { describe, expect, it } from 'vitest'
import { createDefaultCalendar } from './calendar'
import { projectCalendarWindow } from './calendar-projection'

describe('calendar window composition', () => {
  it('combines seasonal transitions, multiple landmarks, moons and an independent day', () => {
    const calendar = createDefaultCalendar()
    calendar.intercalaryRules.push({ id: 'festival', name: 'Festival', month: 1, everyYears: 1, yearOffset: 0, extendsMonth: false })
    const data = {
      moons: [{ id: 'lua', name: 'Lua', color: '#aabbcc', cycleDays: 8, newMoon: { year: 0, month: 1, day: 1 } }],
      seasons: [{ id: 'verao', name: 'Verão', color: '#ffaa00', start: { month: 1, day: 15 } }],
      landmarks: { categories: [{ id: 'c', name: 'Festa', color: '#aabbcc' }], landmarks: [
        { id: 'a', title: 'A', description: '', categoryId: 'c', kind: 'annual' as const, start: { month: 1, day: 15 } },
        { id: 'b', title: 'B', description: '', categoryId: 'c', kind: 'once' as const, start: { year: 0, month: 1, day: 15 } },
      ] },
    }
    const projection = projectCalendarWindow(calendar, 0, 1, 15, data)
    const transition = projection.days.find((item) => 'day' in item.date && item.date.day === 15)!
    expect(transition.seasonStarts).toBe(true)
    expect(transition.landmarks.map((item) => item.id)).toEqual(['a', 'b'])
    expect(transition.moons).toHaveLength(1)
    expect(projection.days.at(-1)?.date).toEqual({ year: 0, intercalaryRuleId: 'festival' })
    expect(projection.days.at(-1)?.season?.id).toBe('verao')
  })

  it('does not expand a million-day month', () => {
    const calendar = createDefaultCalendar()
    calendar.months[0].length = 1_000_000
    const projection = projectCalendarWindow(calendar, -1, 1, 1_000_000, { moons: [], seasons: [], landmarks: { categories: [], landmarks: [] } })
    expect(projection.days.length).toBeLessThanOrEqual(42)
    expect(projection.days.at(-1)?.date).toEqual({ year: -1, month: 1, day: 1_000_000 })
  })
})
