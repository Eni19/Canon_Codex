'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useActionState, useEffect, useMemo, useRef, useState, useTransition, type DragEvent, type ReactNode } from 'react'
import { ArrowUpRight, BookOpen, CalendarDays, Check, ChevronDown, Clock3, Columns3, GripVertical, Info, List, ListFilter, LocateFixed, Pencil, Plus, Search, Sparkles, Trash2, Unlink } from 'lucide-react'
import { addAllTimelineAppearancesAction, addTimelineAppearanceAction, removeTimelineAppearanceAction, restoreTimelineAppearanceAction, type AddTimelineAppearanceState } from '@/app/actions/timelines'
import { TimelineAppearanceFields } from './timeline-appearance-fields'
import { TimelineEditForm } from './timeline-edit-form'
import { TimelineQuickEventForm } from './timeline-quick-event-form'
import { TimelineCosmicCanvas, type TimelineCanvasHandle } from './timeline-cosmic-canvas'
import { animateTimelineRemoval } from './timeline-motion'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatCalendarDate, type Calendar } from '@/domain/worlds/calendar'
import { formatCalendarDateValue } from '@/domain/worlds/calendar-date'
import { initialEventAppearanceDate, type TimelineAppearance, type TimelineData } from '@/domain/timelines/timeline'
import { readTimelineViewState, selectTimelineAppearances, TIMELINE_SCALES, TIMELINE_SCALE_LABELS, updateTimelineViewParams } from '@/domain/timelines/timelineNavigation'
import { buildTimelineCanvasLayout, type TimelineCanvasNode } from '@/domain/timelines/timelineCanvas'
import { readTimelinePage, TIMELINE_PAGE_SIZE } from '@/domain/timelines/timelinePagination'
import type { TimelineScale } from '@/domain/timelines/timelineScale'
import type { Entity } from '@/domain/entities/entity'
import { assetVariantUrl } from '@/lib/assetUrl'
import styles from './timeline.module.css'

const RECORD_DRAG = 'application/x-canon-timeline-record'
const APPEARANCE_DRAG = 'application/x-canon-timeline-appearance'
const initialState: AddTimelineAppearanceState = {}
type Candidate = { record: Entity; date: TimelineAppearance['date']; label: string }
type Undo = { removed: TimelineAppearance; index: number; updatedAt: string }

function ConfirmAdd({ worldId, timelineId, updatedAt, calendar, candidate, onAdded, onCancel }: {
  worldId: string; timelineId: string; updatedAt: string; calendar: Calendar; candidate: Candidate
  onAdded: () => void; onCancel: () => void
}) {
  const [state, action, pending] = useActionState(addTimelineAppearanceAction, initialState)
  useEffect(() => { if (state.saved) onAdded() }, [state.saved, onAdded])
  return <form action={action} className="space-y-4">
    <input type="hidden" name="worldId" value={worldId} />
    <input type="hidden" name="timelineId" value={timelineId} />
    <input type="hidden" name="entityId" value={candidate.record.id} />
    <input type="hidden" name="expectedUpdatedAt" value={updatedAt} />
    <p className="text-sm text-muted-foreground">{candidate.label}: {candidate.record.title}. Confirme ou ajuste a data antes de incluir.</p>
    <TimelineAppearanceFields calendar={calendar} dateKey="appearanceDate" defaults={{ title: null, note: null, date: candidate.date, minimumScale: null, showCover: true }} />
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{pending ? 'Incluindo…' : 'Confirmar inclusão'}</button>
      <button type="button" onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
    </div>
  </form>
}

type Props = {
  worldId: string; timelineId: string; title: string; worldName: string; details: ReactNode
  timeline: TimelineData; calendar: Calendar; records: Entity[]; timelineRecords: Entity[]
  typeLabels: Record<string, string>; scaleDefaults: Record<string, TimelineScale>
}

export function TimelineInteractiveView(props: Props) {
  return <Suspense fallback={<div className={styles.experience}><p className={styles.loading}>Preparando a constelação…</p></div>}><TimelineInteractiveBody {...props} /></Suspense>
}

function TimelineInteractiveBody({ worldId, timelineId, title, worldName, details, timeline, calendar, records, timelineRecords, typeLabels, scaleDefaults }: Props) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const params = searchParams.toString()
  const types = useMemo(() => Object.keys(typeLabels).sort((a, b) => typeLabels[a].localeCompare(typeLabels[b], 'pt-BR')), [typeLabels])
  const view = useMemo(() => {
    const current = new URLSearchParams(params)
    if (!current.has('view')) current.set('view', 'horizontal')
    return readTimelineViewState(current, types)
  }, [params, types])
  const selectionParams = useMemo(() => { const current = new URLSearchParams(params); current.delete('view'); current.delete('page'); return current.toString() }, [params])
  const selected = useMemo(() => selectTimelineAppearances(calendar, timeline.appearances, timelineRecords, scaleDefaults, readTimelineViewState(new URLSearchParams(selectionParams), types)), [calendar, timeline.appearances, timelineRecords, scaleDefaults, selectionParams, types])
  const visibleIds = useMemo(() => new Set([...selected.periods.flatMap(period => period.visible), ...selected.undated].map(appearance => appearance.id)), [selected])
  const layout = useMemo(() => buildTimelineCanvasLayout(calendar, timeline.appearances, view.view), [calendar, timeline.appearances, view.view])
  const visibleNodes = useMemo(() => layout.nodes.filter(node => visibleIds.has(node.appearance.id)), [layout, visibleIds])
  const activeById = useMemo(() => new Map(records.map(record => [record.id, record])), [records])
  const timelineById = useMemo(() => new Map(timelineRecords.map(record => [record.id, record])), [timelineRecords])
  const appearanceById = useMemo(() => new Map(timeline.appearances.map(appearance => [appearance.id, appearance])), [timeline.appearances])
  const canvas = useRef<TimelineCanvasHandle>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [navigatorOpen, setNavigatorOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [undo, setUndo] = useState<Undo | null>(null)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const [dragging, setDragging] = useState(false)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [libraryPage, setLibraryPage] = useState(1)
  const [navigatorPage, setNavigatorPage] = useState(1)
  const candidateReturnFocus = useRef<HTMLElement | null>(null)
  const libraryTrigger = useRef<HTMLButtonElement>(null)
  const navigatorTrigger = useRef<HTMLButtonElement>(null)
  const quickTrigger = useRef<HTMLButtonElement>(null)
  const aboutTrigger = useRef<HTMLButtonElement>(null)
  const navigatorPicked = useRef<string | null>(null)
  const lastEditingId = useRef<string | null>(null)
  const sortedRecords = useMemo(() => [...records].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')), [records])
  const filtered = useMemo(() => sortedRecords.filter(record => (!type || record.type === type) && record.title.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))), [sortedRecords, type, query])
  const libraryPageCount = Math.max(1, Math.ceil(filtered.length / TIMELINE_PAGE_SIZE))
  const currentLibraryPage = Math.min(libraryPage, libraryPageCount)
  const libraryItems = filtered.slice((currentLibraryPage - 1) * TIMELINE_PAGE_SIZE, currentLibraryPage * TIMELINE_PAGE_SIZE)
  const navigatorPageCount = Math.max(1, Math.ceil(visibleNodes.length / TIMELINE_PAGE_SIZE))
  const currentNavigatorPage = Math.min(navigatorPage, navigatorPageCount)
  const navigatorItems = visibleNodes.slice((currentNavigatorPage - 1) * TIMELINE_PAGE_SIZE, currentNavigatorPage * TIMELINE_PAGE_SIZE)
  const detail = detailId ? appearanceById.get(detailId) : null
  const detailRecord = detail ? timelineById.get(detail.entityId) : null
  const detailActive = detail ? activeById.get(detail.entityId) : null
  const editing = editingId ? appearanceById.get(editingId) : null
  const initialId = selectedId ?? visibleNodes[(readTimelinePage(new URLSearchParams(params)) - 1) * TIMELINE_PAGE_SIZE]?.appearance.id

  function setViewParam(key: 'scale' | 'q' | 'type' | 'view', value: string | string[], replace = false) {
    const next = updateTimelineViewParams(searchParams.toString(), key, value)
    window.history[replace ? 'replaceState' : 'pushState'](null, '', `${pathname}${next.size ? `?${next}` : ''}`)
  }

  function showAll() {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('q'); next.delete('type'); next.delete('page'); next.set('scale', 'day')
    window.history.pushState(null, '', `${pathname}?${next}`)
    canvas.current?.restoreFocus()
  }

  function openDetails(id: string) { setSelectedId(id); setDetailId(id) }
  function edit(id: string) { lastEditingId.current = id; setSelectedId(id); setDetailId(null); setEditingId(id) }
  function displayTitle(appearance: TimelineAppearance) { return appearance.title || timelineById.get(appearance.entityId)?.title || 'Registro indisponível' }

  function propose(record: Entity, date: TimelineAppearance['date'], label: string) {
    candidateReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setLibraryOpen(false)
    setCandidate({ record, date, label })
  }
  function chooseRecord(record: Entity) { propose(record, record.type === 'event' ? initialEventAppearanceDate(calendar, record.properties.eventDate) : null, 'Novo cartão') }
  function recordDrop(event: DragEvent<HTMLElement>, node?: TimelineCanvasNode) {
    const record = activeById.get(event.dataTransfer.getData(RECORD_DRAG))
    const date = node?.appearance.date?.start ?? null
    if (record) propose(record, date ? { start: date } : null, date ? `Período ${formatCalendarDate(calendar, date)}` : 'Sem data')
  }
  function addAll() {
    startTransition(async () => {
      try { const result = await addAllTimelineAppearancesAction(worldId, timelineId, timeline.updatedAt); setUndo(null); setMessage(result.added ? `${result.added} registro(s) incluído(s).` : 'Todos os registros ativos já estão representados.') }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível adicionar todos.') }
    })
  }
  function remove(id: string) {
    startTransition(async () => {
      try {
        await animateTimelineRemoval(document.querySelector<HTMLElement>(`[data-appearance-id="${id}"]`))
        const result = await removeTimelineAppearanceAction(worldId, timelineId, id, timeline.updatedAt)
        setDetailId(null); setUndo(result); setMessage('Aparição removida. O registro original permanece.'); canvas.current?.restoreFocus()
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível remover a aparição.') }
    })
  }
  function restore() {
    if (!undo) return
    startTransition(async () => {
      try { await restoreTimelineAppearanceAction(worldId, timelineId, undo.removed, undo.index, undo.updatedAt); setUndo(null); setMessage('Remoção desfeita.') }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível desfazer a remoção.') }
    })
  }

  function card(node: TimelineCanvasNode) {
    const appearance = node.appearance
    const record = timelineById.get(appearance.entityId)
    const active = activeById.get(appearance.entityId)
    const hasCover = active?.coverAssetId && appearance.showCover
    return <article className={styles.mapCard} data-selected={selectedId === appearance.id || undefined} data-unavailable={!active || undefined} data-approximate={appearance.date?.start.approximate || appearance.date?.end?.approximate || undefined} data-map-interactive onFocusCapture={() => setSelectedId(appearance.id)}>
      {hasCover && <div className={styles.mapCover}><Image src={assetVariantUrl(active.coverAssetId!, 'thumbnail')} alt="" fill sizes="288px" className="object-cover" draggable={false} /></div>}
      <div className={styles.cardBody}>
        <p className={styles.cardMeta}>{record ? typeLabels[record.type] ?? record.type : 'Arquivo'}{!active && <span title="Registro indisponível"><Unlink size={11} aria-hidden="true" /><span className="sr-only">Registro indisponível</span></span>}</p>
        <button type="button" data-open-appearance={appearance.id} className={styles.cardTitle} onClick={() => openDetails(appearance.id)}>{displayTitle(appearance)}</button>
        {!hasCover && appearance.note && <p className={styles.cardNote}>{appearance.note}</p>}
        <p className={styles.cardDate} title={appearance.date ? formatCalendarDateValue(calendar, appearance.date) : 'Sem data'}>{appearance.date ? formatCalendarDateValue(calendar, appearance.date) : 'Sem data'}</p>
      </div>
      <footer className={styles.cardFooter}><span className={styles.cardIndex}>{String(node.index + 1).padStart(2, '0')}</span>
        <button type="button" draggable onDragStart={event => { event.dataTransfer.setData(APPEARANCE_DRAG, appearance.id); setDragging(true) }} onDragEnd={() => setDragging(false)} aria-label={`Arrastar cartão ${displayTitle(appearance)}`} title="Arrastar cartão"><GripVertical size={13} aria-hidden="true" /></button>
        <button type="button" data-edit-appearance={appearance.id} onClick={() => edit(appearance.id)} aria-label={`Editar cartão ${displayTitle(appearance)}`} title="Editar cartão"><Pencil size={13} aria-hidden="true" /></button>
        <button type="button" disabled={pending} onClick={() => remove(appearance.id)} aria-label={`Remover da linha ${displayTitle(appearance)}`} title="Remover da linha"><Trash2 size={13} aria-hidden="true" /></button>
      </footer>
    </article>
  }

  function library() {
    return <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Pesquise, filtre e inclua registros. Arraste para um período ou use Adicionar.</p>
      <label className="block text-sm font-medium">Buscar registros
        <input value={query} onChange={(event) => { setQuery(event.target.value); setLibraryPage(1) }} placeholder="Título" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm font-medium">Tipo
        <select value={type} onChange={(event) => { setType(event.target.value); setLibraryPage(1) }} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">Todos os tipos</option>
          {types.map((item) => <option key={item} value={item}>{typeLabels[item] ?? item}</option>)}
        </select>
      </label>
      <button type="button" disabled={pending} onClick={addAll} className="w-full rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50">Adicionar todos os registros ainda ausentes</button>
      <p className="text-xs text-muted-foreground">{filtered.length} de {records.length} registro(s) visível(is) na biblioteca.</p>
      <ul className={styles.libraryList}>
        {libraryItems.map((record) => <li key={record.id} draggable onDragStart={(event) => event.dataTransfer.setData(RECORD_DRAG, record.id)} className={styles.libraryItem}>
          <span>{record.title}<small>{typeLabels[record.type] ?? record.type}</small></span>
          <button type="button" onClick={() => chooseRecord(record)} className={styles.button}><Plus size={12} aria-hidden="true" />Adicionar</button>
        </li>)}
      </ul>
      {libraryPageCount > 1 && <nav aria-label="Páginas da biblioteca" className="flex flex-wrap items-center gap-2 text-xs">
        <button type="button" disabled={currentLibraryPage <= 1} onClick={() => setLibraryPage(currentLibraryPage - 1)} className="rounded-md border border-border px-2 py-1 disabled:opacity-50">Registros anteriores</button>
        <span>{currentLibraryPage} de {libraryPageCount}</span>
        <button type="button" disabled={currentLibraryPage >= libraryPageCount} onClick={() => setLibraryPage(currentLibraryPage + 1)} className="rounded-md border border-border px-2 py-1 disabled:opacity-50">Próximos registros</button>
      </nav>}
      {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>}
    </div>
  }

  return <div className={styles.experience} data-cosmic-timeline>
    <div className={styles.starfield} aria-hidden="true" />
    <TimelineCosmicCanvas key={view.view} ref={canvas} layout={layout} calendar={calendar} visibleIds={visibleIds} selectedId={selectedId} initialId={initialId} renderCard={card} onOpen={openDetails} onSelect={setSelectedId} onRecordDrop={recordDrop} />
    <header className={styles.hero}>
      <div className={styles.heroTitle}><Link href="/timeline" className={styles.eyebrow}><span className={styles.tinyOrbit} />LINHA DO TEMPO<span>/</span>{worldName}</Link><h1>{title}</h1></div>
      <div className={styles.heroActions}>
        <button ref={aboutTrigger} type="button" className={styles.iconButton} onClick={() => setAboutOpen(true)} aria-label="Sobre esta linha" title="Sobre esta linha"><Info size={17} aria-hidden="true" /></button>
        <Link href="/calendar" className={styles.iconButton} aria-label="Calendário do mundo" title="Calendário do mundo"><CalendarDays size={17} aria-hidden="true" /></Link>
        <button ref={quickTrigger} type="button" className={styles.iconButton} onClick={() => setQuickOpen(true)} aria-label="Criar Evento rápido" title="Criar Evento rápido"><Sparkles size={17} aria-hidden="true" /></button>
        <button ref={libraryTrigger} type="button" aria-label="Abrir biblioteca de registros" className={styles.primaryButton} onClick={() => setLibraryOpen(true)}><Plus size={15} aria-hidden="true" /><span>Adicionar registro</span></button>
      </div>
    </header>
    <section className={styles.toolbar} aria-label="Filtros da linha do tempo">
      <div className={styles.viewToggle} role="group" aria-label="Orientação do mapa">{(['horizontal', 'vertical'] as const).map(option => <button key={option} type="button" aria-label={option === 'horizontal' ? 'Vista horizontal' : 'Vista vertical'} title={option === 'horizontal' ? 'Vista horizontal' : 'Vista vertical'} aria-pressed={view.view === option} onClick={() => setViewParam('view', option)}>{option === 'horizontal' ? <Columns3 size={15} aria-hidden="true" /> : <List size={15} aria-hidden="true" />}</button>)}</div>
      <span className={styles.toolbarDivider} />
      <Popover><PopoverTrigger asChild><button type="button" className={styles.filterButton} data-active={view.types.length > 0}><ListFilter size={14} aria-hidden="true" />Categorias<span className={styles.filterBadge}>{view.types.length || '•'}</span><ChevronDown size={12} aria-hidden="true" /></button></PopoverTrigger><PopoverContent align="start" className={`${styles.cosmicPanel} ${styles.filterPopover}`}><fieldset><legend>Categorias na linha</legend><div className={styles.categoryGrid}>{types.map(item => <label key={item} className={styles.category} data-active={view.types.includes(item)}><input type="checkbox" checked={view.types.includes(item)} onChange={event => setViewParam('type', event.target.checked ? [...view.types, item] : view.types.filter(selectedType => selectedType !== item))} /><span>{typeLabels[item]}</span><Check size={12} aria-hidden="true" /></label>)}</div></fieldset></PopoverContent></Popover>
      <label className={styles.scaleSelect}><Clock3 size={14} aria-hidden="true" /><span className="sr-only">Detalhe cronológico</span><select aria-label="Detalhe cronológico" value={view.scale} onChange={event => setViewParam('scale', event.target.value)}>{TIMELINE_SCALES.map(scale => <option key={scale} value={scale}>{TIMELINE_SCALE_LABELS[scale]}</option>)}</select></label>
      <label className={styles.search}><Search size={14} aria-hidden="true" /><span className="sr-only">Buscar cartões</span><input aria-label="Buscar cartões" value={view.query} maxLength={200} onChange={event => setViewParam('q', event.target.value, true)} placeholder="Buscar acontecimentos…" /></label>
      <button ref={navigatorTrigger} type="button" className={styles.navigatorButton} aria-label="Abrir lista de acontecimentos" title="Lista de acontecimentos" onClick={() => setNavigatorOpen(true)}><LocateFixed size={16} aria-hidden="true" /><span>Navegar</span></button>
    </section>
    <div className={styles.stats} role="status" aria-live="polite" aria-atomic="true"><span className={styles.statusDot} /><strong>{selected.visible}</strong><span>visíveis</span><span className={styles.statsSeparator}>/</span><strong>{selected.total}</strong><span>no total</span><span className={styles.hiddenStats}>{selected.filteredOut} por filtro · {selected.scaleHidden} por detalhe</span></div>
    <p className={styles.gestureHint}>ARRASTE PARA EXPLORAR<span>·</span>SCROLL PARA ZOOM</p>
    {selected.visible === 0 && <section className={styles.empty}><span className={styles.emptyOrbit}><Sparkles size={22} aria-hidden="true" /></span><p className={styles.eyebrow}>{selected.total ? 'FORA DESTA SELEÇÃO' : 'UM NOVO UNIVERSO'}</p><h2>{selected.total ? 'Nenhum acontecimento visível' : 'Toda história começa com um ponto.'}</h2><p>{selected.total ? 'Seus registros continuam no mapa. Amplie o detalhe ou ajuste os filtros para reencontrá-los.' : 'Inclua o primeiro registro e comece a conectar os momentos deste mundo.'}</p><button type="button" className={styles.primaryButton} onClick={selected.total ? showAll : () => setLibraryOpen(true)}>{selected.total ? 'Mostrar todos os cartões' : 'Adicionar primeiro registro'}<ArrowUpRight size={14} aria-hidden="true" /></button></section>}
    {dragging && <div className={styles.removeZone} onDragOver={event => { if (event.dataTransfer.types.includes(APPEARANCE_DRAG)) event.preventDefault() }} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData(APPEARANCE_DRAG); setDragging(false); if (id) remove(id) }}><Trash2 size={18} aria-hidden="true" /><span>Remover da linha</span></div>}
    {message && <div className={styles.message} role="status"><span>{message}</span>{undo && <button type="button" disabled={pending} onClick={restore}>Desfazer</button>}<button type="button" className={styles.dismiss} aria-label="Fechar aviso" onClick={() => setMessage('')}>×</button></div>}
    <Sheet open={libraryOpen} onOpenChange={setLibraryOpen} modal={false}><SheetContent className={`${styles.cosmicPanel} ${styles.drawer}`} overlayClassName={styles.overlay} aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); if (!candidate) libraryTrigger.current?.focus({ preventScroll: true }) }}><SheetHeader><SheetTitle><BookOpen size={17} aria-hidden="true" />Biblioteca de registros</SheetTitle></SheetHeader>{library()}</SheetContent></Sheet>
    <Sheet open={navigatorOpen} onOpenChange={setNavigatorOpen}><SheetContent className={`${styles.cosmicPanel} ${styles.drawer}`} overlayClassName={styles.overlay} aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); if (navigatorPicked.current) { canvas.current?.locate(navigatorPicked.current); navigatorPicked.current = null } else navigatorTrigger.current?.focus({ preventScroll: true }) }}><SheetHeader><SheetTitle>Navegar acontecimentos</SheetTitle></SheetHeader><p className={styles.drawerDescription}>Os {visibleNodes.length} cartões desta seleção, em ordem cronológica. Escolha um para localizá-lo no mapa.</p><ol className={styles.navigatorList}>{navigatorItems.map(node => <li key={node.appearance.id}><button type="button" onClick={() => { navigatorPicked.current = node.appearance.id; setSelectedId(node.appearance.id); setNavigatorOpen(false) }}><span>{String(node.index + 1).padStart(2, '0')}</span><div><strong>{displayTitle(node.appearance)}</strong><small>{node.appearance.date ? formatCalendarDateValue(calendar, node.appearance.date) : 'Sem data'}</small></div><LocateFixed size={14} aria-hidden="true" /></button></li>)}</ol><nav className={styles.listPagination} aria-label="Páginas da lista de acontecimentos"><button type="button" disabled={currentNavigatorPage <= 1} onClick={() => setNavigatorPage(currentNavigatorPage - 1)}>Anterior</button><span>{currentNavigatorPage} / {navigatorPageCount}</span><button type="button" disabled={currentNavigatorPage >= navigatorPageCount} onClick={() => setNavigatorPage(currentNavigatorPage + 1)}>Próxima</button></nav>{selected.undated.length > 0 && <button type="button" className={styles.button} onClick={() => { const node = visibleNodes.find(item => item.undated); if (node) { navigatorPicked.current = node.appearance.id; setSelectedId(node.appearance.id); setNavigatorOpen(false) } }}>Ir para Sem data ({selected.undated.length})</button>}</SheetContent></Sheet>
    <Dialog open={Boolean(detail)} onOpenChange={open => { if (!open) setDetailId(null) }}><DialogContent className={`${styles.cosmicPanel} ${styles.detailPanel}`} overlayClassName={styles.overlay} onCloseAutoFocus={event => { event.preventDefault(); if (!editingId) canvas.current?.restoreFocus(selectedId) }}><DialogHeader><DialogTitle>{detail ? displayTitle(detail) : 'Acontecimento'}</DialogTitle><DialogDescription>{detailRecord ? typeLabels[detailRecord.type] ?? detailRecord.type : 'Registro indisponível'}</DialogDescription></DialogHeader>{detail && <>
      {detailActive?.coverAssetId && detail.showCover && <div className={styles.detailCover}><Image src={assetVariantUrl(detailActive.coverAssetId, 'thumbnail')} alt="" fill sizes="480px" className="object-cover" /></div>}
      <p className={styles.detailDate}><CalendarDays size={14} aria-hidden="true" />{detail.date ? formatCalendarDateValue(calendar, detail.date) : 'Sem data'}</p>
      {!detailActive && <p className={styles.unavailable}><Unlink size={13} aria-hidden="true" />Registro indisponível · título, nota e data da aparição permanecem.</p>}
      {detail.note && <p className={styles.fullNote}>{detail.note}</p>}
      <div className={styles.detailActions}><button type="button" className={styles.primaryButton} onClick={() => edit(detail.id)}><Pencil size={14} aria-hidden="true" />Editar cartão</button>{detailActive && <Link className={styles.button} href={`/entity/${detailActive.id}`}>Abrir registro<ArrowUpRight size={14} aria-hidden="true" /></Link>}<button type="button" disabled={pending} className={styles.button} onClick={() => remove(detail.id)}>Remover da linha</button></div>
    </>}</DialogContent></Dialog>
    <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open) setEditingId(null) }}><DialogContent className={`${styles.cosmicPanel} ${styles.editPanel}`} overlayClassName={styles.overlay} onCloseAutoFocus={event => { event.preventDefault(); const id = lastEditingId.current; if (id && !visibleIds.has(id)) setMessage('O cartão está oculto pelos filtros ou detalhe atuais. Seus dados foram preservados.'); canvas.current?.restoreFocus(id, true) }}><DialogHeader><DialogTitle>Editar cartão</DialogTitle><DialogDescription>Altere esta aparição sem modificar o registro original.</DialogDescription></DialogHeader>{editing && <TimelineEditForm key={editing.id} worldId={worldId} timelineId={timelineId} updatedAt={timeline.updatedAt} appearance={editing} calendar={calendar} />}</DialogContent></Dialog>
    <Dialog open={candidate !== null} onOpenChange={open => { if (!open) setCandidate(null) }}><DialogContent className={`${styles.cosmicPanel} ${styles.editPanel}`} overlayClassName={styles.overlay} onCloseAutoFocus={event => { event.preventDefault(); const previous = candidateReturnFocus.current; (previous?.isConnected ? previous : libraryTrigger.current)?.focus({ preventScroll: true }) }}><DialogHeader><DialogTitle>Confirmar aparição</DialogTitle><DialogDescription>A sugestão de data só é gravada após confirmação.</DialogDescription></DialogHeader>{candidate && <ConfirmAdd key={`${candidate.record.id}:${candidate.label}`} worldId={worldId} timelineId={timelineId} updatedAt={timeline.updatedAt} calendar={calendar} candidate={candidate} onCancel={() => setCandidate(null)} onAdded={() => { setCandidate(null); setUndo(null); setMessage('Aparição incluída no mapa.') }} />}</DialogContent></Dialog>
    <Dialog open={quickOpen} onOpenChange={setQuickOpen}><DialogContent className={`${styles.cosmicPanel} ${styles.editPanel}`} overlayClassName={styles.overlay} onCloseAutoFocus={event => { event.preventDefault(); quickTrigger.current?.focus({ preventScroll: true }) }}><DialogHeader><DialogTitle>Criar Evento rápido</DialogTitle><DialogDescription>Um novo acontecimento e sua aparição nesta linha.</DialogDescription></DialogHeader><TimelineQuickEventForm worldId={worldId} timelineId={timelineId} updatedAt={timeline.updatedAt} calendar={calendar} /></DialogContent></Dialog>
    <Dialog open={aboutOpen} onOpenChange={setAboutOpen}><DialogContent className={`${styles.cosmicPanel} ${styles.aboutPanel}`} overlayClassName={styles.overlay} onCloseAutoFocus={event => { event.preventDefault(); aboutTrigger.current?.focus({ preventScroll: true }) }}><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Conteúdo, propriedades, relações e configurações desta linha.</DialogDescription></DialogHeader><Link href={`/entity/${timelineId}/edit`} className={styles.button}><Pencil size={14} aria-hidden="true" />Editar linha e conteúdo</Link>{details}</DialogContent></Dialog>
  </div>
}
