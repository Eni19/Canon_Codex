import { dateToOrdinal, getMonthLength, isIntercalaryRuleActive, type Calendar } from './calendar'

/** A bounded window into a month, including the continuous weekday position. */
export function projectMonth(calendar: Calendar, year: number, month: number, day = 1) {
  const length = getMonthLength(calendar, year, month)
  if (!Number.isSafeInteger(day) || day < 1 || day > length) throw new RangeError('Dia inválido.')
  const firstOrdinal = dateToOrdinal(calendar, { year, month, day: 1 })
  const weekday = ((firstOrdinal + calendar.weekdayOffset) % 7 + 7) % 7
  // Pages align to week boundaries and never render more than six weeks.
  const page = Math.floor((weekday + day - 1) / 42)
  const start = Math.max(1, page * 42 - weekday + 1)
  const end = Math.min(length, (page + 1) * 42 - weekday)
  const firstWeekday = (weekday + start - 1) % 7
  const days = Array.from({ length: end - start + 1 }, (_, index) => start + index)
  const intercalary = end === length ? calendar.intercalaryRules.filter((rule) => rule.month === month && !rule.extendsMonth && isIntercalaryRuleActive(rule, year)) : []
  return { length, start, end, firstWeekday, days, intercalary }
}

export function adjacentMonth(calendar: Calendar, year: number, month: number, direction: -1 | 1) {
  const index = month - 1 + direction
  if (index < 0) return { year: year - 1, month: calendar.months.length }
  if (index >= calendar.months.length) return { year: year + 1, month: 1 }
  return { year, month: index + 1 }
}
