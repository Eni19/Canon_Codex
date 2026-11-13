import { describe, expect, it } from 'vitest'
import { createDefaultCalendar, dateToOrdinal } from './calendar'
import { projectCalendarLandmarks, validateCalendarLandmarks, type CalendarLandmarks } from './calendar-landmarks'

describe('calendar landmarks', () => {
  const calendar = createDefaultCalendar()
  const data: CalendarLandmarks = {
    categories: [{ id: 'fest', name: 'Festival', color: '#aabbcc' }],
    landmarks: [
      { id: 'winter', title: 'Virada', categoryId: 'fest', description: '', kind: 'annual', start: { month: 12, day: 30 }, end: { month: 1, day: 2 } },
      { id: 'leap', title: 'Dia especial', categoryId: 'fest', description: '', kind: 'annual', start: { month: 2, day: 29 } },
      { id: 'once', title: 'Marco', categoryId: 'fest', description: '', kind: 'once', start: { year: 0, month: 1, day: 1 } },
    ],
  }
  it('projects annual intervals across year zero and one-time landmarks', () => {
    const first = dateToOrdinal(calendar, { year: 0, month: 1, day: 1 })
    expect(projectCalendarLandmarks(calendar, data, first, first).map((entry) => entry.id)).toEqual(['winter', 'once'])
  })
  it('skips an annual date when its leap day does not exist', () => {
    const find = (year: number) => projectCalendarLandmarks(calendar, data, dateToOrdinal(calendar, { year, month: 2, day: 28 }), dateToOrdinal(calendar, { year, month: 3, day: 1 })).some((item) => item.id === 'leap')
    expect(find(0)).toBe(true)
    expect(find(1)).toBe(false)
  })
  it('rejects missing categories, reversed exact ranges and impossible recurring dates', () => {
    expect(validateCalendarLandmarks(calendar, { ...data, categories: [] }).success).toBe(false)
    expect(validateCalendarLandmarks(calendar, { ...data, landmarks: [{ ...data.landmarks[2], end: { year: -1, month: 1, day: 1 } }] }).success).toBe(false)
    expect(validateCalendarLandmarks(calendar, { ...data, landmarks: [{ ...data.landmarks[1], start: { month: 2, day: 30 } }] }).success).toBe(false)
  })
})
