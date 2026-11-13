import { dateToOrdinal, getMonthLength, type Calendar } from './calendar'
import { exactDateToOrdinal, type CalendarExactDate } from './calendar-exact-date'
import { projectCalendarLandmarks, type CalendarLandmarks } from './calendar-landmarks'
import { projectMoonPhase, type CalendarMoon } from './calendar-moon'
import { seasonAtExactDate, type CalendarSeason } from './calendar-season'
import { projectMonth } from './calendar-view'

/** Compose only the visible page of a month; independent days follow its final page. */
export function projectCalendarWindow(calendar: Calendar, year: number, month: number, day: number, content: { moons: CalendarMoon[]; seasons: CalendarSeason[]; landmarks: CalendarLandmarks }) {
  const window = projectMonth(calendar, year, month, day)
  const dates: CalendarExactDate[] = [
    ...window.days.map((number) => ({ year, month, day: number })),
    ...window.intercalary.map((rule) => ({ year, intercalaryRuleId: rule.id })),
  ]
  const first = dateToOrdinal(calendar, { year, month, day: window.start })
  const last = dates.length ? exactDateToOrdinal(calendar, dates[dates.length - 1]) : first
  const landmarks = projectCalendarLandmarks(calendar, content.landmarks, first, last)
  const days = dates.map((date) => {
    const ordinal = exactDateToOrdinal(calendar, date)
    return {
      date, ordinal,
      season: seasonAtExactDate(calendar, content.seasons, date),
      seasonStarts: 'month' in date && content.seasons.some((season) => season.start.month === date.month && season.start.day === date.day),
      moons: content.moons.map((moon) => ({ id: moon.id, ...projectMoonPhase(calendar, moon, ordinal) })),
      landmarks: landmarks.filter((landmark) => landmark.first <= ordinal && landmark.last >= ordinal),
    }
  })
  return { ...window, monthLength: getMonthLength(calendar, year, month), days }
}
