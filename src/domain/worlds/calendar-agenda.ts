import { dateToOrdinal, getMonthLength, isIntercalaryRuleActive, type Calendar } from './calendar'
import { formatDateFieldValue, getCalendarDateBoundaryOrdinalRange, legacyIsoDateToOrdinal, parseLegacyIsoDate, parseStoredDateValue } from './calendar-date'

export interface AgendaEvent { id: string; title: string; date: unknown }
export interface AgendaEntry { id: string; title: string; label: string; first: number; last: number; uncertain: boolean }

/** Read each event once and select dates intersecting the month without expanding intervals. */
export function projectAgenda(calendar: Calendar, year: number, month: number, events: AgendaEvent[]): AgendaEntry[] {
  const visibleFirst = dateToOrdinal(calendar, { year, month, day: 1 })
  const visibleLast = visibleFirst + getMonthLength(calendar, year, month) - 1 + calendar.intercalaryRules.filter((rule) => rule.month === month && !rule.extendsMonth && isIntercalaryRuleActive(rule, year)).length
  const entries: AgendaEntry[] = []
  for (const event of events) {
    try {
      const parsed = parseStoredDateValue(calendar, event.date)
      if (!parsed.success) continue
      let first: number
      let last: number
      let uncertain = false
      if (parsed.source === 'legacy' && typeof parsed.data === 'string') {
        const legacy = parseLegacyIsoDate(parsed.data)
        if (!legacy.success) continue
        first = last = legacyIsoDateToOrdinal(legacy.data)
      } else if (typeof parsed.data !== 'string') {
        const { start, end } = parsed.data
        first = getCalendarDateBoundaryOrdinalRange(calendar, start).first
        last = end ? getCalendarDateBoundaryOrdinalRange(calendar, end).last : getCalendarDateBoundaryOrdinalRange(calendar, start).last
        uncertain = (!start.intercalaryRuleId && (start.month === undefined || start.day === undefined)) || Boolean(start.approximate)
          || Boolean(end && ((!end.intercalaryRuleId && (end.month === undefined || end.day === undefined)) || end.approximate))
      } else continue
      if (first <= visibleLast && last >= visibleFirst) entries.push({ id: event.id, title: event.title, label: formatDateFieldValue(calendar, event.date), first, last, uncertain })
    } catch {
      // Invalid or unrepresentable legacy values remain available on the entity itself.
      continue
    }
  }
  return entries.sort((a, b) => a.first - b.first || a.title.localeCompare(b.title, 'pt-BR') || a.id.localeCompare(b.id))
}
