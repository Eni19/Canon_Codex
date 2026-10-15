import { describe, expect, it } from 'vitest'
import { createTimelineStressFixture } from '../../../scripts/timeline-stress-fixture'
import { buildTimelineHorizontalLayout, selectTimelineAppearances, updateTimelineViewParams } from './timelineNavigation'
import { findTimelineAppearancePage, paginateTimelineSelection, readTimelinePage, TIMELINE_PAGE_SIZE } from './timelinePagination'

const { world, records, timeline } = createTimelineStressFixture()
const state = { scale: 'day' as const, query: '', types: [], view: 'vertical' as const }

describe('paginação de linhas grandes', () => {
  it('localiza a nova página por ID após editar uma data, inclusive ao mover para Sem data', () => {
    const editedId = timeline.appearances[1].id
    const original = selectTimelineAppearances(world.calendar, timeline.appearances, records, {}, state)
    expect(findTimelineAppearancePage(original, editedId)).toBe(1)
    const moved = timeline.appearances.map((item) => item.id === editedId ? { ...item, date: { start: { year: 60, month: 2, day: 1 } } } : item)
    const selection = selectTimelineAppearances(world.calendar, moved, records, {}, state)
    const destination = findTimelineAppearancePage(selection, editedId)
    expect(destination).toBe(9)
    expect(paginateTimelineSelection(selection, destination!).items.some((item) => item.id === editedId)).toBe(true)
    const undated = selectTimelineAppearances(world.calendar, moved.map((item) => item.id === editedId ? { ...item, date: null } : item), records, {}, state)
    const undatedPage = findTimelineAppearancePage(undated, editedId)!
    expect(paginateTimelineSelection(undated, undatedPage).undated.some((item) => item.id === editedId)).toBe(true)
  })

  it('informa ausência na seleção quando a edição oculta o cartão por busca ou escala', () => {
    const editedId = timeline.appearances[1].id
    const renamed = timeline.appearances.map((item) => item.id === editedId ? { ...item, title: 'Novo título' } : item)
    const filtered = selectTimelineAppearances(world.calendar, renamed, records, {}, { ...state, query: 'Aparição sintética 002' })
    expect(findTimelineAppearancePage(filtered, editedId)).toBeNull()
    const detailed = timeline.appearances.map((item) => item.id === editedId ? { ...item, minimumScale: 'day' as const } : item)
    const broad = selectTimelineAppearances(world.calendar, detailed, records, {}, { ...state, scale: 'year' })
    expect(findTimelineAppearancePage(broad, editedId)).toBeNull()
    expect(findTimelineAppearancePage(broad, 'missing')).toBeNull()
  })

  it('percorre 500 aparições em ambas as vistas, sem duplicar, perder ou alterar cartões', () => {
    const before = structuredClone(timeline)
    const selection = selectTimelineAppearances(world.calendar, timeline.appearances, records, {}, state)
    const ids: string[] = []
    for (let requested = 1; requested <= 10; requested++) {
      const page = paginateTimelineSelection(selection, requested)
      expect(page.items).toHaveLength(TIMELINE_PAGE_SIZE)
      expect(page.pageCount).toBe(10)
      const dated = page.periods.flatMap((period) => period.visible)
      const horizontal = buildTimelineHorizontalLayout(world.calendar, dated, 'day')
      expect(new Set(horizontal.items.map((item) => item.appearance.id))).toEqual(new Set(dated.map((item) => item.id)))
      expect([...dated, ...page.undated].map((item) => item.id)).toEqual(page.items.map((item) => item.id))
      ids.push(...page.items.map((item) => item.id))
    }
    expect(new Set(ids).size).toBe(500)
    expect(new Set(ids)).toEqual(new Set(timeline.appearances.map((item) => item.id)))
    expect(timeline).toEqual(before)
    const undated = paginateTimelineSelection(selection, 10)
    expect(undated.undated).toHaveLength(50)
    expect(undated.undatedPage).toBe(10)
  })

  it('filtra antes da paginação e mantém totais e intervalos completos', () => {
    const selection = selectTimelineAppearances(world.calendar, timeline.appearances, records, {}, { ...state, query: 'Aparição sintética 001' })
    const page = paginateTimelineSelection(selection, 999)
    expect(page.page).toBe(1)
    expect(page.items).toHaveLength(1)
    expect(selection.visible).toBe(1)
    const full = selectTimelineAppearances(world.calendar, timeline.appearances, records, {}, state)
    const first = paginateTimelineSelection(full, 1)
    expect(first.items.find((item) => item.date?.end)).toEqual(expect.objectContaining({ date: expect.objectContaining({ end: expect.any(Object) }) }))
  })

  it('trata ausência de resultados, páginas inválidas e alteração de filtros sem links mortos', () => {
    for (const value of ['0', '-2', 'NaN', '2.5', 'Infinity', '9007199254740992']) {
      expect(readTimelinePage(new URLSearchParams({ page: value }))).toBe(1)
    }
    expect(readTimelinePage(new URLSearchParams('page=3'))).toBe(3)
    const empty = selectTimelineAppearances(world.calendar, [], records, {}, state)
    expect(paginateTimelineSelection(empty, 10)).toMatchObject({ page: 1, pageCount: 1, start: 0, end: 0, items: [] })
    expect(updateTimelineViewParams('page=8&scale=day&q=teste', 'view', 'horizontal').get('page')).toBe('8')
    for (const key of ['q', 'type', 'scale'] as const) {
      expect(updateTimelineViewParams('page=8', key, 'event').has('page')).toBe(false)
    }
  })
})
