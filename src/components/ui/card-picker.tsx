'use client'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronsUpDown, Plus, Search, X } from 'lucide-react'
import { assetVariantUrl } from '@/lib/assetUrl'
import { cn } from '@/lib/utils'

export interface CardPickerItem {
  id: string
  title: string
  subtitle?: string
  description?: string
  /** Asset id (never a path — see ADR-003); shown as the card background. */
  imageAssetId?: string
  /** Where the image is anchored when cropped; use 'top' for portraits so faces stay visible. */
  imagePosition?: 'top' | 'center'
}

interface CardPickerBaseProps {
  items: CardPickerItem[]
  /** Heading shown in the modal, e.g. "Escolher local". */
  title: string
  searchPlaceholder?: string
  emptyMessage?: string
  /** Badge on selected cards. */
  selectedLabel?: string
  /** Shown on cards that have no image. */
  fallbackIcon?: ReactNode
}

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const UNAVAILABLE = 'Registro indisponível'

/**
 * Modal with square cards and a search box. Reuse it wherever the user must pick from many items.
 * Single mode: `onSelect` fires on click and the caller closes it. Multiple mode: cards toggle
 * through `onSelect` and the modal stays open until the user presses "Concluir".
 */
export function CardPicker({ items, selectedIds, multiple = false, title, searchPlaceholder = 'Buscar por nome', emptyMessage = 'Nada encontrado.', selectedLabel = 'Selecionado', fallbackIcon, onSelect, onClose }: CardPickerBaseProps & { selectedIds: string[]; multiple?: boolean; onSelect: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { const timer = window.setTimeout(() => inputRef.current?.focus(), 60); return () => window.clearTimeout(timer) }, [])
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const filtered = useMemo(() => {
    const term = normalize(query.trim())
    return term ? items.filter((item) => normalize(`${item.title} ${item.subtitle ?? ''}`).includes(term)) : items
  }, [items, query])

  return createPortal(
    <div className="fixed inset-0 z-[2100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={onClose} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()} className="flex max-h-[calc(100%-1rem)] w-full max-w-5xl flex-col border border-primary/40 bg-popover text-popover-foreground shadow-2xl">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <span className="hidden text-[.65rem] font-extrabold tracking-[.16em] whitespace-nowrap text-primary uppercase sm:block">{title}</span>
          <label className="flex h-10 flex-1 items-center gap-2 border bg-card px-3"><Search className="size-4 text-muted-foreground" /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-10 place-items-center text-muted-foreground hover:text-primary"><X className="size-4" /></button>
        </header>
        <div className="grid grid-cols-2 gap-3.5 overflow-y-auto p-4 sm:grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))]">
          {filtered.map((item) => {
            const isSelected = selected.has(item.id)
            return (
              <button key={item.id} type="button" aria-pressed={isSelected} onClick={() => onSelect(item.id)} className={cn('group relative aspect-square overflow-hidden border bg-card text-left transition hover:-translate-y-0.5 hover:border-primary', isSelected && 'border-primary ring-1 ring-primary')}>
                {item.imageAssetId ? <Image src={assetVariantUrl(item.imageAssetId, 'thumbnail')} alt="" fill sizes="240px" unoptimized draggable={false} className={cn('object-cover', item.imagePosition === 'top' && 'object-top')} /> : <span className="absolute inset-0 grid place-items-center text-primary/60 [&>svg]:size-10">{fallbackIcon}</span>}
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                <span className="absolute inset-x-0 bottom-0 grid gap-0.5 p-3">
                  {item.subtitle && <small className="text-[.52rem] tracking-[.16em] text-primary uppercase">{item.subtitle}</small>}
                  <strong className="font-serif text-base leading-tight text-white">{item.title}</strong>
                  {item.description && <em className="line-clamp-2 text-[.62rem] text-white/70 not-italic">{item.description}</em>}
                </span>
                {isSelected && <i className="absolute top-2 right-2 flex items-center gap-1 bg-primary px-1.5 py-0.5 text-[.55rem] font-bold text-primary-foreground uppercase not-italic"><Check className="size-2.5" />{selectedLabel}</i>}
              </button>
            )
          })}
          {filtered.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>}
        </div>
        {multiple && <footer className="flex items-center justify-between gap-3 border-t px-4 py-3"><span className="text-xs text-muted-foreground">{selectedIds.length} selecionado(s)</span><button type="button" onClick={onClose} className="bg-primary px-4 py-2 text-xs font-bold text-primary-foreground uppercase hover:opacity-90">Concluir</button></footer>}
      </div>
    </div>,
    document.body,
  )
}

const TRIGGER_CLASS = 'flex min-h-9 w-full items-center gap-2.5 rounded-md border bg-popover px-3 py-1.5 text-left text-sm text-popover-foreground hover:border-primary disabled:opacity-50'

/** Form field that picks ONE item through a CardPicker. Submits the id through a hidden input named `name`. */
export function CardPickerField({ id, name, value, onChange, placeholder = 'Escolher...', disabled, clearable = false, ...picker }: CardPickerBaseProps & { id?: string; name?: string; value: string; onChange: (id: string) => void; placeholder?: string; disabled?: boolean; clearable?: boolean }) {
  const [open, setOpen] = useState(false)
  const current = picker.items.find((item) => item.id === value)
  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <div className="flex items-stretch gap-1.5">
        <button id={id} type="button" disabled={disabled} onClick={() => setOpen(true)} className={TRIGGER_CLASS}>
          {current?.imageAssetId && <Image src={assetVariantUrl(current.imageAssetId, 'thumbnail')} alt="" width={28} height={28} unoptimized className={cn('size-7 shrink-0 object-cover', current.imagePosition === 'top' && 'object-top')} />}
          <span className="min-w-0 flex-1 truncate">{value ? (current ? current.title : UNAVAILABLE) : <span className="text-muted-foreground">{placeholder}</span>}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
        {clearable && value && <button type="button" onClick={() => onChange('')} aria-label="Limpar seleção" className="grid w-9 shrink-0 place-items-center rounded-md border text-muted-foreground hover:border-primary hover:text-primary"><X className="size-4" /></button>}
      </div>
      {open && <CardPicker {...picker} selectedIds={value ? [value] : []} onSelect={(next) => { onChange(next); setOpen(false) }} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Form field that picks SEVERAL items. `pickableIds` limits what the modal offers; already-selected items keep showing. */
export function CardPickerMultiField({ id, name, value, onChange, pickableIds, addLabel = 'Adicionar', emptyText = 'Nenhum item selecionado.', disabled, ...picker }: CardPickerBaseProps & { id?: string; name?: string; value: string[]; onChange: (ids: string[]) => void; pickableIds?: string[]; addLabel?: string; emptyText?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const byId = useMemo(() => new Map(picker.items.map((item) => [item.id, item])), [picker.items])
  const offered = useMemo(() => pickableIds ? picker.items.filter((item) => pickableIds.includes(item.id)) : picker.items, [picker.items, pickableIds])
  const toggle = (itemId: string) => onChange(value.includes(itemId) ? value.filter((current) => current !== itemId) : [...value, itemId])
  return (
    <div id={id} className="rounded-md border border-input bg-background/25 p-2">
      {name && value.map((itemId) => <input key={itemId} type="hidden" name={name} value={itemId} />)}
      {value.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((itemId) => {
            const item = byId.get(itemId)
            return (
              <span key={itemId} className={cn('inline-flex max-w-full items-center gap-1.5 rounded-md border py-1 pr-1 pl-1.5 text-xs text-foreground', item ? 'border-primary/25 bg-primary/10' : 'border-dashed border-border text-muted-foreground')}>
                {item?.imageAssetId && <Image src={assetVariantUrl(item.imageAssetId, 'thumbnail')} alt="" width={20} height={20} unoptimized className={cn('size-5 shrink-0 rounded-sm object-cover', item.imagePosition === 'top' && 'object-top')} />}
                <span className="truncate">{item ? item.title : UNAVAILABLE}</span>
                <button type="button" disabled={disabled} onClick={() => toggle(itemId)} aria-label={'Remover ' + (item?.title ?? UNAVAILABLE)} className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-primary/15 hover:text-primary"><X className="size-3" /></button>
              </span>
            )
          })}
        </div>
      ) : <p className="mb-2 px-1 text-xs text-muted-foreground">{emptyText}</p>}
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"><Plus className="size-3.5" />{addLabel}</button>
      {open && <CardPicker {...picker} items={offered} multiple selectedIds={value} onSelect={toggle} onClose={() => setOpen(false)} />}
    </div>
  )
}
