'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import { useCommandPalette } from '@/components/wiki/command-palette-provider'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { SearchResultItem } from '@/services/search/searchEntities'

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (!open) return
    const timeout = setTimeout(() => {
      fetch(`/api/entities/search?q=${encodeURIComponent(query)}`)
        .then((response) => (response.ok ? response.json() : []))
        .then((data: SearchResultItem[]) => {
          setResults(data)
          setSelectedIndex(0)
        })
        .catch(() => setResults([]))
    }, 150)
    return () => clearTimeout(timeout)
  }, [query, open])

  function goToEntity(id: string) {
    setOpen(false)
    setQuery('')
    router.push(`/entity/${id}`)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setQuery('')
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && results[selectedIndex]) {
      goToEntity(results[selectedIndex].id)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="top-1/4 max-w-lg translate-y-0 gap-0 p-0" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Buscar</DialogTitle>
          <DialogDescription>Buscar entidades no mundo</DialogDescription>
        </DialogHeader>
        <div className="p-2">
          <Input
            autoFocus
            placeholder="Buscar personagens, locais, casos..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
          />
        </div>
        <div className="max-h-80 overflow-y-auto border-t border-border p-1">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
          ) : (
            results.map((result, index) => (
              <button
                key={result.id}
                type="button"
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => goToEntity(result.id)}
                className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm ${
                  index === selectedIndex ? 'bg-accent text-accent-foreground' : ''
                }`}
              >
                <EntityTypeIcon name={result.typeIcon} className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{result.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{result.typeLabel}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
