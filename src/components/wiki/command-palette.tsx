'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import { useCommandPalette } from '@/components/wiki/command-palette-provider'
import { schedulePaletteSearch } from './palette-search'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import type { SearchResultItem } from '@/services/search/searchEntities'

export function CommandPalette({ entityTypes }: { entityTypes: EntityTypeDefinition[] }) {
  const { open, setOpen } = useCommandPalette()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [response, setResponse] = useState<{ query: string; type: string; tagPrefix: string; items: SearchResultItem[] }>()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const tagPrefix = tagInput.trim()

  useEffect(() => {
    if (!open) return
    return schedulePaletteSearch(query, data => {
      setResponse({ query, type, tagPrefix, items: data })
      setSelectedIndex(0)
    }, { type, tagPrefix })
  }, [query, type, tagPrefix, open])

  const typeLabel = entityTypes.find(entityType => entityType.id === type)?.label ?? type
  const current = response?.query === query && response.type === type && response.tagPrefix === tagPrefix
  const results = current ? response.items : []

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
        <div className="grid gap-2 p-2">
          <Input
            autoFocus
            placeholder="Buscar personagens, locais, casos… (#etiqueta filtra)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
          />
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <select
              aria-label="Filtrar por tipo"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={type}
              onChange={event => setType(event.target.value)}
            >
              <option value="">Todos os tipos</option>
              {entityTypes.filter(entityType => entityType.showInSidebar).map(entityType => (
                <option key={entityType.id} value={entityType.id}>{entityType.label}</option>
              ))}
            </select>
            <Input
              aria-label="Filtrar por etiqueta"
              placeholder="Etiqueta"
              value={tagInput}
              onChange={event => setTagInput(event.target.value)}
              onKeyDown={onInputKeyDown}
            />
          </div>
          {(type || tagPrefix) && <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros ativos">
            {type && <Button type="button" size="sm" variant="secondary" onClick={() => setType('')} aria-label={`Remover filtro de tipo ${typeLabel}`}>
              Tipo · {typeLabel}<X aria-hidden="true" />
            </Button>}
            {tagPrefix && <Button type="button" size="sm" variant="secondary" className="max-w-full" onClick={() => setTagInput('')} aria-label={`Remover filtro de etiqueta ${tagPrefix}`}>
              <span className="min-w-0 truncate">Etiqueta · {tagPrefix}</span><X aria-hidden="true" />
            </Button>}
          </div>}
        </div>
        <div className="max-h-80 overflow-y-auto border-t border-border p-1">
          {!current ? (
            <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">Buscando…</p>
          ) : results.length === 0 ? (
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
