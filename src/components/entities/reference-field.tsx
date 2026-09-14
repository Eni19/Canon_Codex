'use client'

import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import type { ReferenceOption } from './property-field'

export function ReferenceField({
  fieldId,
  name,
  label,
  options,
  initialValue,
}: {
  fieldId: string
  name: string
  label: string
  options: ReferenceOption[]
  initialValue?: string
}) {
  const [selected, setSelected] = useState(initialValue ?? '')
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
  const selectedOption = options.find((option) => option.id === selected)
  const matches = useMemo(() => {
    if (!normalizedQuery) return []
    return options
      .filter((option) => option.id !== selected && option.title.toLocaleLowerCase('pt-BR').includes(normalizedQuery))
      .slice(0, 12)
  }, [normalizedQuery, options, selected])

  function choose(id: string) {
    setSelected(id)
    setQuery('')
  }

  return (
    <div className="rounded-md border border-input bg-background/25 p-2">
      <input type="hidden" name={name} value={selected} />
      {selected && (
        <div className="mb-2 flex min-w-0 items-center gap-1 rounded-md border border-primary/25 bg-primary/10 py-1 pr-1 pl-2 text-xs text-foreground">
          <span className="min-w-0 flex-1 truncate">{selectedOption?.title ?? 'Registro indisponível'}</span>
          <button type="button" onClick={() => setSelected('')} className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-primary/15 hover:text-primary" aria-label={'Remover ' + label.toLocaleLowerCase('pt-BR')}>
            <X className="size-3" />
          </button>
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input id={fieldId} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={'Buscar ' + label.toLocaleLowerCase('pt-BR') + '...'} className="pl-8" autoComplete="off" />
      </div>
      {normalizedQuery && (
        <div className="mt-2 max-h-44 overflow-y-auto border-t border-border pt-2">
          {matches.length > 0 ? <div className="grid gap-0.5">{matches.map((option) => (
            <button key={option.id} type="button" onClick={() => choose(option.id)} className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground">{option.title}</button>
          ))}</div> : <p className="px-2 py-3 text-xs text-muted-foreground">Nenhum resultado encontrado.</p>}
          {matches.length === 12 && <p className="px-2 pt-2 text-[0.65rem] text-muted-foreground">Continue digitando para refinar a busca.</p>}
        </div>
      )}
    </div>
  )
}