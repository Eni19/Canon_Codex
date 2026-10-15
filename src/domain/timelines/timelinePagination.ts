import type { selectTimelineAppearances } from './timelineNavigation'

export const TIMELINE_PAGE_SIZE = 50

export function readTimelinePage(params: URLSearchParams): number {
  const value = Number(params.get('page') ?? 1)
  return Number.isSafeInteger(value) && value > 0 ? value : 1
}

function orderedAppearances(selection: ReturnType<typeof selectTimelineAppearances>) {
  return [...selection.periods.flatMap((period) => period.visible), ...selection.undated]
}

/** Find a card in the current selection without changing filters or zoom. */
export function findTimelineAppearancePage(selection: ReturnType<typeof selectTimelineAppearances>, appearanceId: string): number | null {
  const index = orderedAppearances(selection).findIndex((appearance) => appearance.id === appearanceId)
  return index < 0 ? null : Math.floor(index / TIMELINE_PAGE_SIZE) + 1
}

/** Paginate after filtering/zoom, in the same dated-then-undated order in both views. */
export function paginateTimelineSelection(selection: ReturnType<typeof selectTimelineAppearances>, requestedPage: number) {
  const ordered = orderedAppearances(selection)
  const pageCount = Math.max(1, Math.ceil(ordered.length / TIMELINE_PAGE_SIZE))
  const page = Math.min(pageCount, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1))
  const offset = (page - 1) * TIMELINE_PAGE_SIZE
  const items = ordered.slice(offset, offset + TIMELINE_PAGE_SIZE)
  const ids = new Set(items.map((item) => item.id))
  return {
    page, pageCount, items,
    start: ordered.length ? offset + 1 : 0, end: offset + items.length,
    undatedPage: Math.floor((ordered.length - selection.undated.length) / TIMELINE_PAGE_SIZE) + 1,
    periods: selection.periods.map((period) => ({ ...period, visible: period.visible.filter((item) => ids.has(item.id)) }))
      .filter((period) => period.visible.length > 0 || period.scaleHidden > 0),
    undated: selection.undated.filter((item) => ids.has(item.id)),
  }
}
