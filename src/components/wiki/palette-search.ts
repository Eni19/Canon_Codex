import type { SearchResultItem } from '@/services/search/searchEntities'

export function schedulePaletteSearch(
  query: string,
  update: (results: SearchResultItem[]) => void,
  filters: { type?: string; tagPrefix?: string } = {},
) {
  const controller = new AbortController()
  const params = new URLSearchParams({ q: query })
  if (filters.type) params.set('type', filters.type)
  if (filters.tagPrefix) params.set('tagPrefix', filters.tagPrefix)
  const timer = setTimeout(async () => {
    let results: SearchResultItem[] = []
    try {
      const response = await fetch(`/api/entities/search?${params}`, { signal: controller.signal })
      if (response.ok) results = await response.json()
    } catch {
      // A failed current request displays an empty list.
    }
    if (!controller.signal.aborted) update(results)
  }, 100)
  return () => {
    clearTimeout(timer)
    controller.abort()
  }
}
