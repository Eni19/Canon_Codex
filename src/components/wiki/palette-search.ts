import type { SearchResultItem } from '@/services/search/searchEntities'

export function schedulePaletteSearch(query: string, update: (results: SearchResultItem[]) => void) {
  const controller = new AbortController()
  const timer = setTimeout(async () => {
    let results: SearchResultItem[] = []
    try {
      const response = await fetch(`/api/entities/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
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
