import { dateToOrdinal, formatCalendarDate, getCalendarDateAtOrdinal, type Calendar, type CalendarDate, type CalendarDateAtOrdinal } from '@/domain/worlds/calendar'
import { getCalendarDateBoundaryOrdinalRange } from '@/domain/worlds/calendar-date'
import type { Entity } from '@/domain/entities/entity'
import { orderTimelineAppearances, type TimelineAppearance } from './timeline'
import type { TimelineScale } from './timelineScale'

export const TIMELINE_SCALES: TimelineScale[] = ['century', 'decade', 'year', 'month', 'day']
export const TIMELINE_SCALE_LABELS: Record<TimelineScale, string> = {
  century: 'Século', decade: 'Década', year: 'Ano', month: 'Mês', day: 'Dia',
}

export type TimelineViewState = { scale: TimelineScale; query: string; types: string[]; view: 'vertical' | 'horizontal' }
export type TimelinePeriod = { key: string; label: string; date: CalendarDate; visible: TimelineAppearance[]; scaleHidden: number }
export type TimelineHorizontalAxisTick = { key: string; label: string; ordinal: number; slot: number }
export type TimelineHorizontalItem = {
  appearance: TimelineAppearance
  startOrdinal: number
  endOrdinal: number
  startSlot: number
  endSlot: number
  lane: number
  interval: boolean
  approximate: boolean
  openEnded: boolean
}
export type TimelineHorizontalLayout = {
  slotCount: number
  laneCount: number
  rangeStartOrdinal: number
  rangeEndOrdinal: number
  ticks: TimelineHorizontalAxisTick[]
  items: TimelineHorizontalItem[]
}

const MAX_HORIZONTAL_SLOTS = 160
const MAX_HORIZONTAL_TICKS = 14

export function readTimelineViewState(params: URLSearchParams, availableTypes: string[]): TimelineViewState {
  const scale = params.get('scale')
  const view = params.get('view')
  const available = new Set(availableTypes)
  return {
    scale: TIMELINE_SCALES.find((item) => item === scale) ?? 'year',
    query: (params.get('q') ?? '').slice(0, 200),
    types: [...new Set(params.getAll('type').filter((item) => available.has(item)))],
    view: view === 'horizontal' ? 'horizontal' : 'vertical',
  }
}

export function updateTimelineViewParams(params: string | URLSearchParams, key: 'scale' | 'q' | 'type' | 'view' | 'page', value: string | string[]): URLSearchParams {
  const next = new URLSearchParams(typeof params === 'string' ? params : params.toString())
  if (key === 'scale' || key === 'q' || key === 'type') next.delete('page')
  next.delete(key)
  for (const item of Array.isArray(value) ? value : [value]) if (item) next.append(key, item)
  return next
}

function periodFor(calendar: Calendar, date: CalendarDate, scale: TimelineScale): { key: string; label: string; date: CalendarDate } {
  const year = scale === 'century' ? Math.floor(date.year / 100) * 100
    : scale === 'decade' ? Math.floor(date.year / 10) * 10 : date.year
  const period: CalendarDate = { year }
  if (scale === 'month' || scale === 'day') {
    if (date.month !== undefined) period.month = date.month
    if (scale === 'day' && date.day !== undefined) period.day = date.day
  }
  const key = `${scale}:${period.year}:${period.month ?? ''}:${period.day ?? ''}`
  const label = scale === 'century' ? `${formatCalendarDate(calendar, { year })} a ${formatCalendarDate(calendar, { year: year + 99 })}`
    : scale === 'decade' ? `${formatCalendarDate(calendar, { year })} a ${formatCalendarDate(calendar, { year: year + 9 })}`
      : formatCalendarDate(calendar, period)
  return { key, label, date: period }
}

export function selectTimelineAppearances(calendar: Calendar, appearances: TimelineAppearance[], records: Pick<Entity, 'id' | 'type' | 'title'>[], defaults: Record<string, TimelineScale>, state: TimelineViewState) {
  const byId = new Map(records.map((record) => [record.id, record]))
  const query = state.query.trim().toLocaleLowerCase('pt-BR')
  const filtered = appearances.filter((appearance) => {
    const record = byId.get(appearance.entityId)
    if (state.types.length && (!record || !state.types.includes(record.type))) return false
    return !query || [appearance.title, record?.title].some((value) => value?.toLocaleLowerCase('pt-BR').includes(query))
  })
  const ordered = orderTimelineAppearances(calendar, filtered)
  const groups = new Map<string, TimelinePeriod>()
  let scaleHidden = 0
  for (const appearance of ordered.dated) {
    const record = byId.get(appearance.entityId)
    const period = periodFor(calendar, appearance.date!.start, state.scale)
    const group = groups.get(period.key) ?? { ...period, visible: [], scaleHidden: 0 }
    const minimum = appearance.minimumScale ?? (record ? defaults[record.type] ?? defaultTimelineScale(record.type) : 'year')
    if (TIMELINE_SCALES.indexOf(state.scale) < TIMELINE_SCALES.indexOf(minimum)) {
      group.scaleHidden += 1
      scaleHidden += 1
    } else group.visible.push(appearance)
    groups.set(period.key, group)
  }
  return {
    periods: [...groups.values()],
    undated: ordered.undated,
    total: appearances.length,
    filteredOut: appearances.length - filtered.length,
    scaleHidden,
    visible: filtered.length - scaleHidden,
  }
}

export function defaultTimelineScale(type: string): TimelineScale {
  if (type === 'event') return 'year'
  if (type === 'character' || type === 'location' || type === 'organization') return 'month'
  return 'day'
}

type HorizontalBounds = {
  appearance: TimelineAppearance
  startOrdinal: number
  endOrdinal: number
  startUnit: CalendarDate
  endUnit: CalendarDate
  interval: boolean
  approximate: boolean
  openEnded: boolean
}

/**
 * Builds the geometry shared by the horizontal renderer and its tests. Positions are
 * ordinal-based, while slots cap the amount of DOM needed for very long timelines.
 */
export function buildTimelineHorizontalLayout(calendar: Calendar, appearances: TimelineAppearance[], scale: TimelineScale): TimelineHorizontalLayout {
  const bounds: HorizontalBounds[] = appearances.filter((appearance) => appearance.date).map((appearance) => {
    const date = appearance.date!
    const startRange = getCalendarDateBoundaryOrdinalRange(calendar, date.start)
    const endRange = date.end ? getCalendarDateBoundaryOrdinalRange(calendar, date.end) : startRange
    return {
      appearance,
      startOrdinal: startRange.first,
      endOrdinal: endRange.last,
      startUnit: horizontalUnitStart(date.start, scale),
      endUnit: horizontalUnitEnd(calendar, date.end ?? date.start, scale),
      interval: Boolean(date.end),
      approximate: Boolean(date.start.approximate || date.end?.approximate),
      openEnded: !date.end,
    }
  })

  if (bounds.length === 0) {
    return { slotCount: 1, laneCount: 0, rangeStartOrdinal: 0, rangeEndOrdinal: 0, ticks: [], items: [] }
  }

  const rangeStartOrdinal = Math.min(...bounds.map((item) => dateToOrdinal(calendar, item.startUnit)))
  const rangeEndOrdinal = Math.max(...bounds.map((item) => Math.max(item.endOrdinal, unitEndOrdinal(calendar, item.endUnit, scale))))
  const unit = horizontalAxisUnit(calendar, bounds, scale, rangeStartOrdinal, rangeEndOrdinal)
  const slotCount = Math.min(MAX_HORIZONTAL_SLOTS, Math.max(1, unit.count))
  const totalDays = rangeEndOrdinal - rangeStartOrdinal + 1

  const toSlot = (ordinal: number, end: boolean): number => {
    const ratio = (ordinal - rangeStartOrdinal) / totalDays
    const raw = end ? Math.ceil(((ordinal + 1) - rangeStartOrdinal) / totalDays * slotCount) : Math.floor(ratio * slotCount)
    return Math.max(0, Math.min(slotCount, raw))
  }

  const sorted = [...bounds].sort((left, right) => left.startOrdinal - right.startOrdinal || left.appearance.id.localeCompare(right.appearance.id))
  const laneEnds: number[] = []
  const items: TimelineHorizontalItem[] = []
  for (const item of sorted) {
    const startSlot = toSlot(item.startOrdinal, false)
    const endSlot = Math.max(startSlot + 1, toSlot(item.openEnded ? rangeEndOrdinal : item.endOrdinal, true))
    let lane = laneEnds.findIndex((end) => startSlot >= end)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = endSlot
    items.push({ ...item, startSlot, endSlot: Math.min(slotCount, endSlot), lane })
  }

  return {
    slotCount,
    laneCount: laneEnds.length,
    rangeStartOrdinal,
    rangeEndOrdinal,
    ticks: buildHorizontalTicks(calendar, unit, scale, rangeStartOrdinal, rangeEndOrdinal, slotCount),
    items,
  }
}

function horizontalUnitStart(boundary: { year: number; month?: number; day?: number }, scale: TimelineScale): CalendarDate {
  if (scale === 'century') return { year: Math.floor(boundary.year / 100) * 100, month: 1, day: 1 }
  if (scale === 'decade') return { year: Math.floor(boundary.year / 10) * 10, month: 1, day: 1 }
  if (scale === 'year') return { year: boundary.year, month: 1, day: 1 }
  if (scale === 'month') return { year: boundary.year, month: boundary.month ?? 1, day: 1 }
  return { year: boundary.year, month: boundary.month ?? 1, day: boundary.day ?? 1 }
}

function horizontalUnitEnd(calendar: Calendar, boundary: { year: number; month?: number; day?: number }, scale: TimelineScale): CalendarDate {
  if (scale === 'month' && boundary.month === undefined) return { year: boundary.year, month: calendar.months.length, day: 1 }
  return horizontalUnitStart(boundary, scale)
}

function nextHorizontalUnit(calendar: Calendar, unit: CalendarDate, scale: TimelineScale): CalendarDate | null {
  if (scale === 'day') return null
  if (scale === 'month') {
    if (unit.month! < calendar.months.length) return { year: unit.year, month: unit.month! + 1, day: 1 }
    return { year: unit.year + 1, month: 1, day: 1 }
  }
  const step = scale === 'century' ? 100 : scale === 'decade' ? 10 : 1
  return { year: unit.year + step, month: 1, day: 1 }
}

function unitEndOrdinal(calendar: Calendar, unit: CalendarDate, scale: TimelineScale): number {
  const start = dateToOrdinal(calendar, unit)
  const next = nextHorizontalUnit(calendar, unit, scale)
  return next ? dateToOrdinal(calendar, next) - 1 : start
}

function horizontalAxisUnit(calendar: Calendar, bounds: HorizontalBounds[], scale: TimelineScale, rangeStartOrdinal: number, rangeEndOrdinal: number) {
  if (scale === 'day') {
    return {
      count: rangeEndOrdinal - rangeStartOrdinal + 1,
      ordinalAt: (index: number) => rangeStartOrdinal + index,
      dateAt: (index: number) => getCalendarDateAtOrdinal(calendar, rangeStartOrdinal + index),
    }
  }

  if (scale === 'month') {
    const months = calendar.months.length
    const first = Math.min(...bounds.map((item) => item.startUnit.year * months + item.startUnit.month! - 1))
    const last = Math.max(...bounds.map((item) => item.endUnit.year * months + item.endUnit.month! - 1))
    return {
      count: last - first + 1,
      ordinalAt: (index: number) => {
        const monthIndex = first + index
        const year = Math.floor(monthIndex / months)
        const month = ((monthIndex % months) + months) % months + 1
        return dateToOrdinal(calendar, { year, month, day: 1 })
      },
      dateAt: (index: number) => {
        const monthIndex = first + index
        const year = Math.floor(monthIndex / months)
        return { year, month: ((monthIndex % months) + months) % months + 1 }
      },
    }
  }

  const step = scale === 'century' ? 100 : scale === 'decade' ? 10 : 1
  const first = Math.min(...bounds.map((item) => item.startUnit.year))
  const last = Math.max(...bounds.map((item) => item.endUnit.year))
  return {
    count: Math.floor((last - first) / step) + 1,
    ordinalAt: (index: number) => dateToOrdinal(calendar, { year: first + index * step, month: 1, day: 1 }),
    dateAt: (index: number) => ({ year: first + index * step }),
  }
}

function buildHorizontalTicks(calendar: Calendar, unit: ReturnType<typeof horizontalAxisUnit>, scale: TimelineScale, rangeStartOrdinal: number, rangeEndOrdinal: number, slotCount: number): TimelineHorizontalAxisTick[] {
  const stride = Math.max(1, Math.ceil(unit.count / MAX_HORIZONTAL_TICKS))
  const indices = new Set<number>()
  for (let index = 0; index < unit.count; index += stride) indices.add(index)
  indices.add(unit.count - 1)

  if (scale !== 'day') {
    const zero = horizontalUnitStart({ year: 0, month: 1, day: 1 }, scale)
    const zeroOrdinal = dateToOrdinal(calendar, zero)
    if (zeroOrdinal >= rangeStartOrdinal && zeroOrdinal <= rangeEndOrdinal) {
      const firstDate = unit.dateAt(0)
      const firstMonth = 'month' in firstDate && typeof firstDate.month === 'number' ? firstDate.month : 1
      const zeroIndex = scale === 'month'
        ? (0 - firstDate.year) * calendar.months.length + 1 - firstMonth
        : (0 - firstDate.year) / (scale === 'century' ? 100 : scale === 'decade' ? 10 : 1)
      if (Number.isInteger(zeroIndex) && zeroIndex >= 0 && zeroIndex < unit.count) indices.add(zeroIndex)
    }
  } else {
    const zeroOrdinal = dateToOrdinal(calendar, { year: 0, month: 1, day: 1 })
    if (zeroOrdinal >= rangeStartOrdinal && zeroOrdinal <= rangeEndOrdinal) indices.add(zeroOrdinal - rangeStartOrdinal)
  }

  return [...indices].sort((left, right) => left - right).map((index) => {
    const ordinal = unit.ordinalAt(index)
    const slot = Math.max(0, Math.min(slotCount - 1, Math.floor((ordinal - rangeStartOrdinal) / (rangeEndOrdinal - rangeStartOrdinal + 1) * slotCount)))
    return { key: `${scale}:${ordinal}`, label: formatHorizontalTick(calendar, scale, unit.dateAt(index)), ordinal, slot }
  })
}

function formatHorizontalTick(calendar: Calendar, scale: TimelineScale, input: CalendarDate | CalendarDateAtOrdinal): string {
  if ('intercalaryRuleName' in input) return `${input.intercalaryRuleName} · ano ${input.year}`
  if (scale === 'day' && input.month !== undefined && input.day !== undefined) return formatCalendarDate(calendar, input)
  return formatCalendarDate(calendar, { year: input.year, ...(input.month === undefined ? {} : { month: input.month }) })
}
