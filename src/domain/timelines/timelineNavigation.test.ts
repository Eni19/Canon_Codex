import { describe, expect, it } from 'vitest'
import { createDefaultCalendar } from '@/domain/worlds/calendar'
import type { TimelineAppearance } from './timeline'
import { buildTimelineHorizontalLayout, readTimelineViewState, selectTimelineAppearances, updateTimelineViewParams } from './timelineNavigation'

const calendar = createDefaultCalendar()
const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004']
const records = [
  { id: ids[0], type: 'event', title: 'Origem' },
  { id: ids[1], type: 'character', title: 'Cronista' },
  { id: ids[2], type: 'event', title: 'Depois' },
  { id: ids[3], type: 'location', title: 'Sem data' },
]
const appearances: TimelineAppearance[] = [
  { id: '10000000-0000-4000-8000-000000000001', entityId: ids[0], title: null, note: null, date: { start: { year: -1 } }, minimumScale: null, showCover: true },
  { id: '10000000-0000-4000-8000-000000000002', entityId: ids[1], title: 'Guardiã', note: null, date: { start: { year: 0, month: 2 } }, minimumScale: null, showCover: true },
  { id: '10000000-0000-4000-8000-000000000003', entityId: ids[2], title: null, note: null, date: { start: { year: 1, month: 3, day: 4 } }, minimumScale: 'century', showCover: true },
  { id: '10000000-0000-4000-8000-000000000004', entityId: ids[3], title: null, note: null, date: null, minimumScale: null, showCover: true },
]

describe('navegação da linha do tempo', () => {
  it('agrupa anos negativos e zero sem alterar as aparições ao trocar escala', () => {
    const original = structuredClone(appearances)
    const state = { scale: 'century' as const, query: '', types: [], view: 'vertical' as const }
    const century = selectTimelineAppearances(calendar, appearances, records, { event: 'year', character: 'month', location: 'month' }, state)
    expect(century.periods.map((period) => period.date.year)).toEqual([-100, 0])
    expect(century.periods.map((period) => period.scaleHidden)).toEqual([1, 1])
    expect(century.visible).toBe(2) // a exceção de escala e o item sem data
    const month = selectTimelineAppearances(calendar, appearances, records, { event: 'year', character: 'month', location: 'month' }, { ...state, scale: 'month' })
    expect(month.periods.map((period) => period.visible.length)).toEqual([1, 1, 1])
    expect(appearances).toEqual(original)
  })

  it('combina busca no título do cartão, categorias e Sem data', () => {
    const state = { scale: 'month' as const, query: 'Guardiã', types: ['character'], view: 'vertical' as const }
    const found = selectTimelineAppearances(calendar, appearances, records, {}, state)
    expect(found).toMatchObject({ total: 4, filteredOut: 3, scaleHidden: 0, visible: 1 })
    expect(found.periods[0].visible[0].entityId).toBe(ids[1])
    const undated = selectTimelineAppearances(calendar, appearances, records, {}, { ...state, query: '', types: ['location'] })
    expect(undated.undated).toHaveLength(1)
    expect(undated.periods).toHaveLength(0)
  })

  it('mantém busca e categoria para um registro indisponível na linha', () => {
    const unavailableId = '00000000-0000-4000-8000-000000000005'
    const unavailableAppearance: TimelineAppearance = {
      id: '10000000-0000-4000-8000-000000000005', entityId: unavailableId, title: null, note: null,
      date: null, minimumScale: null, showCover: true,
    }
    const result = selectTimelineAppearances(calendar, [...appearances, unavailableAppearance], [...records, {
      id: unavailableId, type: 'document', title: 'Carta arquivada',
    }], {}, { scale: 'year', query: 'arquivada', types: ['document'], view: 'vertical' })
    expect(result).toMatchObject({ total: 5, filteredOut: 4, scaleHidden: 0, visible: 1 })
    expect(result.undated[0].entityId).toBe(unavailableId)
  })

  it('lê escala, busca, filtros múltiplos e vista da URL', () => {
    const params = new URLSearchParams('scale=day&q=origem&type=event&type=location&type=invalid&view=horizontal')
    expect(readTimelineViewState(params, ['event', 'location'])).toEqual({ scale: 'day', query: 'origem', types: ['event', 'location'], view: 'horizontal' })
    expect(readTimelineViewState(new URLSearchParams('scale=invalid'), [])).toMatchObject({ scale: 'year', view: 'vertical' })
  })

  it('atualiza a vista sem perder o estado dos filtros', () => {
    const updated = updateTimelineViewParams('scale=day&q=origem&type=event&type=location', 'view', 'horizontal')
    expect(updated.toString()).toBe('scale=day&q=origem&type=event&type=location&view=horizontal')
    expect(updateTimelineViewParams(updated, 'view', 'vertical').toString()).toBe('scale=day&q=origem&type=event&type=location&view=vertical')
  })

  it('posiciona intervalos aproximados em trilhas sem sobreposição e mantém o ano zero no eixo', () => {
    const horizontal = buildTimelineHorizontalLayout(calendar, [
      { id: '20000000-0000-4000-8000-000000000001', entityId: ids[0], title: null, note: null, date: { start: { year: -1, approximate: true }, end: { year: 0, month: 2, day: 3 } }, minimumScale: null, showCover: true },
      { id: '20000000-0000-4000-8000-000000000002', entityId: ids[1], title: null, note: null, date: { start: { year: -1, month: 1, day: 2 }, end: { year: -1, month: 1, day: 5 } }, minimumScale: null, showCover: true },
      { id: '20000000-0000-4000-8000-000000000003', entityId: ids[2], title: null, note: null, date: { start: { year: 250, month: 1, day: 1 } }, minimumScale: null, showCover: true },
    ], 'year')

    const first = horizontal.items.find((item) => item.appearance.id.endsWith('001'))!
    const second = horizontal.items.find((item) => item.appearance.id.endsWith('002'))!
    expect(first.interval).toBe(true)
    expect(first.approximate).toBe(true)
    expect(first.endSlot).toBeGreaterThan(first.startSlot)
    expect(second.lane).not.toBe(first.lane)
    expect(horizontal.slotCount).toBeLessThanOrEqual(160)
    expect(horizontal.ticks.some((tick) => tick.label.includes('ano 0'))).toBe(true)
  })

  it('mantém o ano inteiro quando o fim de um intervalo mensal informa somente o ano', () => {
    const horizontal = buildTimelineHorizontalLayout(calendar, [
      { id: '20000000-0000-4000-8000-000000000004', entityId: ids[0], title: null, note: null, date: { start: { year: -1, month: 12 }, end: { year: 0 } }, minimumScale: null, showCover: true },
    ], 'month')

    expect(horizontal.slotCount).toBe(13)
  })
})
