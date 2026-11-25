import { dateToOrdinal, getCalendarDateAtOrdinal, getCalendarYearLength, isIntercalaryRuleActive, type Calendar, type CalendarDate } from '@/domain/worlds/calendar'
import { CalendarDateValueSchema, getCalendarDateBoundaryOrdinalRange, legacyIsoDateToOrdinal, parseLegacyIsoDate, validateCalendarDateValue, type CalendarDateBoundary } from '@/domain/worlds/calendar-date'
import { exactDateAtOrdinal, exactDateToOrdinal } from '@/domain/worlds/calendar-exact-date'
import { EntitySchema, type Entity } from '@/domain/entities/entity'
import { TimelineDataSchema, type TimelineData } from '@/domain/timelines/timeline'
import { WorldSchema, type World } from '@/domain/worlds/world'
import type { OriginEventPreview } from '@/repositories/contracts/worldRepository'

export interface OriginEntry {
  active: boolean
  entity: Entity
  timeline?: TimelineData
}

interface OriginChange {
  index: number
  entity?: Entity
  timeline?: TimelineData
}

function range(calendar: Calendar, boundary: CalendarDateBoundary): { first: number; last: number } {
  if (boundary.intercalaryRuleId) return getCalendarDateBoundaryOrdinalRange(calendar, boundary)
  const first = dateToOrdinal(calendar, { year: boundary.year, month: boundary.month ?? 1, day: boundary.day ?? 1 })
  if (boundary.day !== undefined) return { first, last: first }
  if (boundary.month === undefined) return { first, last: first + getCalendarYearLength(calendar, boundary.year) - 1 }
  const extras = calendar.intercalaryRules.filter((rule) => rule.month === boundary.month && rule.extendsMonth && isIntercalaryRuleActive(rule, boundary.year)).length
  return { first, last: first + calendar.months[boundary.month - 1].length + extras - 1 }
}

function dateAt(calendar: Calendar, ordinal: number, approximate?: boolean): CalendarDateBoundary {
  return { ...exactDateAtOrdinal(calendar, ordinal), ...(approximate ? { approximate: true } : {}) }
}

function shiftBoundary(calendar: Calendar, boundary: CalendarDateBoundary, shift: number, edge: 'start' | 'end'): { value: CalendarDateBoundary; precisionChanged: boolean } {
  const original = range(calendar, boundary)
  const first = original.first + shift
  const last = original.last + shift
  const firstDate = getCalendarDateAtOrdinal(calendar, first)
  const approximate = boundary.approximate
  if (!boundary.intercalaryRuleId && boundary.day === undefined && firstDate.month === 1 && firstDate.day === 1
    && boundary.month === undefined && range(calendar, { year: firstDate.year }).last === last) {
    return { value: { year: firstDate.year, ...(approximate ? { approximate } : {}) }, precisionChanged: false }
  }
  if (!boundary.intercalaryRuleId && boundary.day === undefined && boundary.month !== undefined && firstDate.month !== undefined && firstDate.day === 1
    && range(calendar, { year: firstDate.year, month: firstDate.month }).last === last) {
    return { value: { year: firstDate.year, month: firstDate.month, ...(approximate ? { approximate } : {}) }, precisionChanged: false }
  }
  return { value: dateAt(calendar, edge === 'start' ? first : last, approximate), precisionChanged: boundary.day === undefined && !boundary.intercalaryRuleId }
}

function shiftDate(calendar: Calendar, input: unknown, shift: number): { value: unknown; precisionChanged: boolean } {
  if (shift === 0) return { value: input, precisionChanged: false }
  if (typeof input === 'string') {
    const legacy = parseLegacyIsoDate(input)
    if (!legacy.success) throw new Error(`Data legada inválida: ${legacy.error}`)
    return { value: { start: dateAt(calendar, legacyIsoDateToOrdinal(legacy.data) + shift) }, precisionChanged: false }
  }
  const valid = validateCalendarDateValue(calendar, input)
  if (!valid.success) throw new Error(valid.error)
  const start = shiftBoundary(calendar, valid.data.start, shift, 'start')
  const end = valid.data.end ? shiftBoundary(calendar, valid.data.end, shift, 'end') : null
  return {
    value: { start: start.value, ...(end ? { end: end.value } : {}) },
    precisionChanged: start.precisionChanged || Boolean(end?.precisionChanged),
  }
}

function eventOrdinal(world: World, entity: Entity): number {
  if (entity.worldId !== world.id || entity.type !== 'event') throw new Error('Escolha um Evento deste mundo.')
  const value = entity.properties.eventDate
  if (typeof value === 'string') {
    const legacy = parseLegacyIsoDate(value)
    if (!legacy.success) throw new Error('O Evento precisa ter data completa e válida.')
    return legacyIsoDateToOrdinal(legacy.data)
  }
  const parsed = CalendarDateValueSchema.safeParse(value)
  if (!parsed.success || !validateCalendarDateValue(world.calendar, value).success || (!parsed.data.start.intercalaryRuleId && (parsed.data.start.month === undefined || parsed.data.start.day === undefined)) || parsed.data.end || parsed.data.start.approximate) {
    throw new Error('O Evento de origem precisa ter uma data exata, completa e sem intervalo.')
  }
  if (parsed.data.start.intercalaryRuleId) return exactDateToOrdinal(world.calendar, { year: parsed.data.start.year, intercalaryRuleId: parsed.data.start.intercalaryRuleId })
  return dateToOrdinal(world.calendar, parsed.data.start as CalendarDate)
}

export function planOriginEvent(world: World, entries: OriginEntry[], eventId: string) {
  const target = entries.find((entry) => entry.entity.id === eventId && entry.active)
  if (!target) throw new Error('O Evento não está ativo neste mundo.')
  const oldOrdinal = eventOrdinal(world, target.entity)
  const newOrdinal = dateToOrdinal(world.calendar, { year: 0, month: world.calendar.origin.month, day: world.calendar.origin.day })
  const shift = newOrdinal - oldOrdinal
  const keys = new Map(world.entityTypes.map((type) => [type.id, type.properties.filter((property) => property.kind === 'date').map((property) => property.key)]))
  const changes: OriginChange[] = []
  const examples: OriginEventPreview['examples'] = []
  const worldDates: OriginEventPreview['worldDates'] = []
  let affectedDates = 0
  let precisionChanges = 0
  for (const [index, entry] of entries.entries()) {
    if (entry.entity.worldId !== world.id) throw new Error('O diretório contém um registro de outro mundo.')
    const properties = { ...entry.entity.properties }
    let changed = false
    for (const key of keys.get(entry.entity.type) ?? []) {
      const before = properties[key]
      if (before === undefined || before === null || before === '') continue
      let shifted: ReturnType<typeof shiftDate>
      try { shifted = shiftDate(world.calendar, before, shift) }
      catch (error) { throw new Error(`Não foi possível deslocar ${entry.entity.title} · ${key}: ${error instanceof Error ? error.message : String(error)}`) }
      const after = shifted.value
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        properties[key] = after
        affectedDates++
        if (shifted.precisionChanged) precisionChanges++
        changed = true
        if (examples.length < 8) examples.push({ title: entry.entity.title, field: key, before: JSON.stringify(before), after: JSON.stringify(after), precisionChanged: shifted.precisionChanged })
      }
    }
    const entity = changed ? EntitySchema.parse({ ...entry.entity, properties }) : undefined
    const currentTimeline = entry.timeline
    let timeline: TimelineData | undefined
    if (currentTimeline) {
      const appearances = currentTimeline.appearances.map((appearance) => {
        if (!appearance.date) return appearance
        let shifted: ReturnType<typeof shiftDate>
        try { shifted = shiftDate(world.calendar, appearance.date, shift) }
        catch (error) { throw new Error(`Não foi possível deslocar ${entry.entity.title} · aparição: ${error instanceof Error ? error.message : String(error)}`) }
        if (JSON.stringify(appearance.date) === JSON.stringify(shifted.value)) return appearance
        affectedDates++
        if (shifted.precisionChanged) precisionChanges++
        if (examples.length < 8) examples.push({ title: entry.entity.title, field: 'aparição', before: JSON.stringify(appearance.date), after: JSON.stringify(shifted.value), precisionChanged: shifted.precisionChanged })
        return { ...appearance, date: shifted.value }
      })
      if (appearances.some((appearance, position) => appearance !== currentTimeline.appearances[position])) {
        const updatedAt = new Date(Math.max(Date.now(), Date.parse(currentTimeline.updatedAt) + 1)).toISOString()
        timeline = TimelineDataSchema.parse({ ...currentTimeline, appearances, updatedAt })
      }
    }
    if (entity || timeline) changes.push({ index, entity, timeline })
  }
  const calendarMoons = world.calendarMoons.map((moon) => {
    if (shift === 0) return moon
    let nextDate: CalendarDateBoundary
    try {
      nextDate = dateAt(world.calendar, dateToOrdinal(world.calendar, moon.newMoon) + shift)
      if (nextDate.intercalaryRuleId) throw new Error('O deslocamento alcança um dia intercalar sem referência lunar editável.')
    }
    catch (error) { throw new Error(`Não foi possível deslocar a lua ${moon.name}: ${error instanceof Error ? error.message : String(error)}`) }
    const newMoon = { year: nextDate.year, month: nextDate.month!, day: nextDate.day! }
    affectedDates++
    worldDates.push({ title: moon.name, field: 'lua nova', before: JSON.stringify(moon.newMoon), after: JSON.stringify(newMoon) })
    return { ...moon, newMoon }
  })
  let campaignToday = world.campaignToday
  if (campaignToday && shift !== 0) {
    const before = campaignToday
    campaignToday = exactDateAtOrdinal(world.calendar, exactDateToOrdinal(world.calendar, before) + shift)
    affectedDates++
    worldDates.push({ title: 'Hoje da campanha', field: 'data atual', before: JSON.stringify(before), after: JSON.stringify(campaignToday) })
  }
  const calendarLandmarks = { ...world.calendarLandmarks, landmarks: world.calendarLandmarks.landmarks.map((landmark) => {
    if (landmark.kind !== 'once' || shift === 0) return landmark
    const move = (date: typeof landmark.start) => exactDateAtOrdinal(world.calendar, exactDateToOrdinal(world.calendar, date) + shift)
    const start = move(landmark.start)
    const end = landmark.end ? move(landmark.end) : undefined
    affectedDates += landmark.end ? 2 : 1
    worldDates.push({ title: landmark.title, field: 'marco', before: JSON.stringify({ start: landmark.start, end: landmark.end }), after: JSON.stringify({ start, end }) })
    return { ...landmark, start, ...(end ? { end } : {}) }
  }) }
  const nextWorld = WorldSchema.parse({ ...world, calendarMoons, campaignToday, calendarLandmarks, originEventId: eventId, updatedAt: new Date().toISOString() })
  return {
    preview: { eventId, eventTitle: target.entity.title, shiftDays: shift, affectedEntities: changes.length, affectedDates, precisionChanges, examples, worldDates },
    changes,
    nextWorld,
  }
}
