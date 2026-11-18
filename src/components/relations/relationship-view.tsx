'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowLeftRight, ArrowRight, Crosshair, Ellipsis, Folder, Link2, List, Minus, MousePointer2, MoveUpRight, Plus, Search, SlidersHorizontal, Square, X, type LucideIcon } from 'lucide-react'
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { CardPickerField } from '@/components/ui/card-picker'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cardCenter, organizeGraph, type ArrowEndpoint, type Point } from '@/domain/relations/graphGeometry'
import { externalFolderLinks, folderPositions, indexGraphFolders, moveFolderMembers, type GraphFolder } from '@/domain/relations/graphFolders'
import type { FreeArrow, GraphSettings } from '@/domain/relations/graphSettings'
import { buildGraphCatalog, GraphStylesSchema, type GraphStyle } from '@/domain/relations/graphStyles'
import { directionMark, relationDirection, type Relation } from '@/domain/relations/relation'
import { relationshipNeighborhoodSlice, type GraphEntity, type NeighborhoodDirection } from '@/domain/relations/relationshipGraph'
import { FreeArrowForm } from './graph-free-arrows'
import { FolderMoveForm, FolderNameForm, GraphFoldersPanel } from './graph-folders-panel'
import { CreateGraphRelation, EditGraphRelation } from './graph-relation-forms'
import { GraphStyleLegend } from './graph-style-legend'
import form from './graph-forms.module.css'
import type { createRelationshipScene, GraphTool, SceneState } from './relationship-scene'
import { useGraphAutosave } from './use-graph-autosave'

type Panel = 'options' | 'filters' | 'legend' | 'records' | 'connect' | 'arrow' | 'card' | 'relation' | 'annotation' | 'folders' | 'folder' | 'folder-links'
const panelTitle: Record<Panel, string> = { options: 'Mais ferramentas', filters: 'Busca e filtros', legend: 'Legenda e estilos', records: 'Registros e vínculos', connect: 'Conectar registros', arrow: 'Seta livre', card: 'Registro', relation: 'Editar vínculo', annotation: 'Seta livre', folders: 'Pastas', folder: 'Pasta', 'folder-links': 'Vínculos externos' }
const panelIcon: Record<Panel, LucideIcon> = { options: Ellipsis, filters: Search, legend: SlidersHorizontal, records: List, connect: Link2, arrow: MoveUpRight, card: Square, relation: Link2, annotation: MoveUpRight, folders: Folder, folder: Folder, 'folder-links': Link2 }
const linkStyle = 'text-primary underline underline-offset-2'
const pageSize = 25
const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim()
const directions = [
  { id: 'outgoing', icon: ArrowRight, label: 'Ida', description: 'Vínculos que saem do registro' },
  { id: 'incoming', icon: ArrowLeft, label: 'Volta', description: 'Vínculos que chegam ao registro' },
  { id: 'both', icon: ArrowLeftRight, label: 'Ambos', description: 'Vínculos nos dois sentidos' },
] as const

function useGraphSearch() {
  const [draft, setDraft] = useState('')
  const [applied, setApplied] = useState('')
  useEffect(() => {
    if (draft === applied) return
    const timer = setTimeout(() => setApplied(draft), 500)
    return () => clearTimeout(timer)
  }, [draft, applied])
  return { draft, applied, setDraft, apply: () => setApplied(draft), clear: () => { setDraft(''); setApplied('') } }
}

function TargetSearch({ search, matches, choose, fit }: { search: ReturnType<typeof useGraphSearch>; matches: GraphEntity[]; choose: (id: string) => void; fit: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus({ preventScroll: true }) }, [])
  const typed = !!normalize(search.draft)
  return <form className="pointer-events-auto grid w-full gap-2" onSubmit={(event) => { event.preventDefault(); search.apply() }}>
    <label className={form.field}>Buscar cartão de destino
      <input ref={input} type="search" className={form.control} value={search.draft} placeholder="Digite um nome…" onChange={(event) => search.setDraft(event.target.value)} onBlur={search.apply} />
    </label>
    {typed && matches.length === 0 && <p className="text-muted-foreground">Nenhum cartão com esse nome.</p>}
    {typed && matches.length === 1 && <Button type="button" variant="outline" className="min-w-0 justify-start" onClick={() => choose(matches[0].id)}><ArrowRight aria-hidden="true" /><span className="truncate">{matches[0].title}</span></Button>}
    {typed && matches.length > 1 && <details className="rounded-md border bg-background px-2 py-1">
      <summary className="cursor-pointer text-sm">{matches.length} correspondências · escolher na lista</summary>
      {matches.length > 0 && <ul className="mt-1 max-h-28 overflow-y-auto" aria-label="Cartões que correspondem à busca">
        {matches.slice(0, 12).map((item) => <li key={item.id}><button type="button" className="block min-h-8 w-full truncate rounded px-1.5 text-left hover:bg-accent" onClick={() => choose(item.id)}>{item.title}</button></li>)}
        {matches.length > 12 && <li className="px-1.5 py-1 text-xs text-muted-foreground">Digite mais para encontrar outros resultados.</li>}
      </ul>}
    </details>}
    {typed && matches.length > 0 && search.draft === search.applied && <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={fit}><Crosshair aria-hidden="true" />Enquadrar resultados</Button>}
  </form>
}

function Tool({ icon: Icon, label, pressed, onClick, primary, expanded }: {
  icon: LucideIcon; label: string; pressed?: boolean; onClick: () => void; primary?: boolean; expanded?: boolean
}) {
  return <Tooltip>
    <TooltipTrigger asChild>
      <Button type="button" size="icon" variant={primary ? 'default' : pressed ? 'secondary' : 'ghost'} aria-label={label}
        aria-pressed={pressed} aria-expanded={expanded} className="size-11 shrink-0 aria-pressed:ring-1 aria-pressed:ring-primary/50" onClick={onClick}>
        <Icon aria-hidden="true" className="size-5" />
      </Button>
    </TooltipTrigger>
    <TooltipContent sideOffset={8}>{label}</TooltipContent>
  </Tooltip>
}

function GraphPanel({ panel, children, footer, onClose }: { panel: Panel; children: ReactNode; footer?: ReactNode; onClose: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const Icon = panelIcon[panel]
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  return <aside aria-labelledby="relationship-panel-title" className={form.panel + ' absolute inset-x-2 bottom-17 z-10 flex max-h-[min(64%,40rem)] flex-col overflow-hidden rounded-2xl border text-popover-foreground lg:inset-x-auto lg:top-4 lg:right-4 lg:bottom-auto lg:max-h-[calc(100%-6rem)] lg:w-96'}>
    <header className="flex shrink-0 items-center gap-3 border-b px-4 py-1.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-primary"><Icon className="size-4" aria-hidden="true" /></span>
      <h2 ref={heading} tabIndex={-1} id="relationship-panel-title" className="min-w-0 flex-1 font-serif text-lg leading-tight outline-none">{panelTitle[panel]}</h2>
      <Tool icon={X} label="Fechar painel" onClick={onClose} />
    </header>
    <div className={form.panelContent + ' space-y-4 overflow-y-auto overscroll-contain p-4 text-sm'}>{children}</div>
    {footer && <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t px-4 py-2">{footer}</footer>}
  </aside>
}

function Pager({ page, total, setPage }: { page: number; total: number; setPage: (page: number) => void }) {
  if (total <= 1) return null
  return <div className="flex flex-wrap items-center gap-2">
    <Button size="sm" variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>Anterior</Button>
    <span>Página {page + 1} de {total}</span>
    <Button size="sm" variant="outline" disabled={page === total - 1} onClick={() => setPage(page + 1)}>Próxima</Button>
  </div>
}

export function RelationshipView({ entities, relations: initialRelations, initialFocus, initialSettings, typeLabels }: {
  entities: GraphEntity[]; relations: Relation[]; initialFocus?: string; initialSettings: GraphSettings; typeLabels: Record<string, string>
}) {
  const [relations, setRelations] = useState(initialRelations)
  const [styles, setStyles] = useState(() => buildGraphCatalog(initialRelations.map((item) => item.type), initialSettings.styles))
  const [positions, setPositions] = useState(initialSettings.positions)
  const [automatic, setAutomatic] = useState(() => organizeGraph(entities.map((item) => item.id), initialRelations, initialSettings.positions))
  const [annotations, setAnnotations] = useState(initialSettings.annotations)
  const [folders, setFolders] = useState(initialSettings.folders)
  const [selectedFolder, setSelectedFolder] = useState('')
  const [locatedCard, setLocatedCard] = useState('')
  const [revealedFolder, setRevealedFolder] = useState(() => initialSettings.folders.find((folder) => initialFocus && folder.members.includes(initialFocus))?.id ?? '')
  const [recordFolder, setRecordFolder] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkIds, setBulkIds] = useState<string[]>([])
  const [type, setType] = useState(() => entities.some((item) => item.type === initialSettings.preferences.type) ? initialSettings.preferences.type : '')
  const [relationType, setRelationType] = useState(() => initialRelations.some((item) => item.type === initialSettings.preferences.relationType) ? initialSettings.preferences.relationType : '')
  const [focus, setFocus] = useState(() => entities.some((item) => item.id === initialFocus) ? initialFocus ?? '' : '')
  const [depth, setDepth] = useState(1)
  const [direction, setDirection] = useState<NeighborhoodDirection>('both')
  const search = useGraphSearch()
  const nextSearch = useGraphSearch()
  const focusField = useId()
  const [panel, setPanel] = useState<Panel | null>(null)
  const [tool, setTool] = useState<GraphTool>('move')
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [arrowStart, setArrowStart] = useState<ArrowEndpoint | null>(null)
  const [arrowEnd, setArrowEnd] = useState<ArrowEndpoint | null>(null)
  const [selectedCard, setSelectedCard] = useState('')
  const [selectedEdge, setSelectedEdge] = useState('')
  const [selectedArrow, setSelectedArrow] = useState('')
  const [page, setPage] = useState(0)
  const [list, setList] = useState<'items' | 'relations'>('items')
  const [listQuery, setListQuery] = useState('')
  const [reset, setReset] = useState(false)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState<'loading' | 'ready' | 'error'>('loading')
  const host = useRef<HTMLDivElement>(null)
  const tools = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const scene = useRef<ReturnType<typeof createRelationshipScene> | null>(null)
  const view = useGraphAutosave(initialSettings)
  const types = useMemo(() => [...new Set(entities.map((item) => item.type))].sort(), [entities])
  const relationTypes = useMemo(() => [...new Set(relations.map((item) => item.type))].sort(), [relations])
  const byId = useMemo(() => new Map(entities.map((item) => [item.id, item])), [entities])
  const activeIds = useMemo(() => new Set(byId.keys()), [byId])
  const membership = useMemo(() => indexGraphFolders(folders), [folders])
  const collapsedFolders = useMemo(() => new Set(folders.filter((folder) => folder.collapsed && folder.id !== revealedFolder).map((folder) => folder.id)), [folders, revealedFolder])
  const labels = useMemo(() => new Map(entities.map((item) => [item.id, normalize(item.title)])), [entities])
  const pickerItems = useMemo(() => entities.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: [typeLabels[item.type] ?? item.type, membership.get(item.id)?.name].filter(Boolean).join(' · '),
  })), [entities, typeLabels, membership])
  const graph = useMemo(() => {
    const hidden = new Set(styles.filter((item) => item.hidden).map((item) => item.type))
    const available = relations.filter((relation) => !hidden.has(relation.type) && (!relationType || relation.type === relationType))
    const incoming = new Map(entities.map((item) => [item.id, [] as Relation[]]))
    const outgoing = new Map(entities.map((item) => [item.id, [] as Relation[]]))
    for (const relation of available) { outgoing.get(relation.sourceId)?.push(relation); incoming.get(relation.targetId)?.push(relation) }
    return { entities, relations: available, incoming, outgoing }
  }, [entities, relations, relationType, styles])
  const neighborhood = useMemo(() => focus ? relationshipNeighborhoodSlice(graph, focus, depth, direction) : undefined, [graph, focus, depth, direction])
  const candidates = useMemo(() => entities.filter((item) => (!neighborhood || neighborhood.entityIds.has(item.id)) && (!type || item.type === type || item.id === focus)), [entities, neighborhood, type, focus])
  const choosingDestination = !!(tool === 'connect' ? source && !target : tool === 'arrow' && arrowStart && !arrowEnd)
  const canvasSearch = choosingDestination && (nextSearch.draft || nextSearch.applied) ? nextSearch : search
  const term = normalize(canvasSearch.draft)
  const previewingSearch = term !== normalize(canvasSearch.applied)
  const keepIds = useMemo(() => new Set([source, target, arrowStart?.cardId, arrowEnd?.cardId, locatedCard].filter(Boolean)), [source, target, arrowStart, arrowEnd, locatedCard])
  const visible = useMemo(() => {
    const matches = candidates.filter((item) => previewingSearch || labels.get(item.id)?.includes(term))
    for (const item of entities) if (keepIds.has(item.id) && !matches.includes(item)) matches.push(item)
    return matches
  }, [candidates, entities, keepIds, labels, previewingSearch, term])
  const visibleIds = useMemo(() => new Set(visible.map((item) => item.id)), [visible])
  const dimmedIds = useMemo(() => new Set(previewingSearch ? visible.filter((item) => !keepIds.has(item.id) && !labels.get(item.id)?.includes(term)).map((item) => item.id) : []), [visible, keepIds, labels, previewingSearch, term])
  const visibleRelations = useMemo(() => graph.relations.filter((item) => visibleIds.has(item.sourceId) && visibleIds.has(item.targetId) && (!neighborhood || neighborhood.relationIds.has(item.id))), [graph, neighborhood, visibleIds])
  const canvasIds = useMemo(() => new Set([...visibleIds].filter((id) => {
    const folder = membership.get(id)
    return !folder || !collapsedFolders.has(folder.id) || keepIds.has(id) || (!!term && !dimmedIds.has(id))
  })), [visibleIds, membership, collapsedFolders, keepIds, term, dimmedIds])
  const visibleRelationIds = useMemo(() => new Set(visibleRelations.filter((item) => canvasIds.has(item.sourceId) && canvasIds.has(item.targetId)).map((item) => item.id)), [visibleRelations, canvasIds])
  const dimmedRelationIds = useMemo(() => new Set(visibleRelations.filter((item) => dimmedIds.has(item.sourceId) || dimmedIds.has(item.targetId)).map((item) => item.id)), [visibleRelations, dimmedIds])
  const nextTerm = normalize(nextSearch.draft)
  const targetMatches = choosingDestination && nextTerm ? candidates.filter((item) => labels.get(item.id)?.includes(nextTerm)) : []
  const displayedPositions = useMemo(() => ({ ...automatic, ...positions }), [automatic, positions])
  const folderPoints = useMemo(() => folderPositions(folders, displayedPositions, activeIds), [folders, displayedPositions, activeIds])
  const externalLinks = useMemo(() => externalFolderLinks(visibleRelations, membership), [visibleRelations, membership])
  const aggregatedLinks = useMemo(() => new Map([...externalLinks].map(([id, links]) => [id, links.filter((link) =>
    (membership.get(link.sourceId)?.id === id && !canvasIds.has(link.sourceId)) ||
    (membership.get(link.targetId)?.id === id && !canvasIds.has(link.targetId)),
  )])), [canvasIds, externalLinks, membership])
  const filteredCanvas = !!(term || type || relationType || focus)
  const sceneFolders = useMemo(() => folders.flatMap((folder) => {
    const members = folder.members.filter((id) => visibleIds.has(id) && !dimmedIds.has(id)).length
    const position = folderPoints.get(folder.id)
    if (!position || (filteredCanvas && !members && selectedFolder !== folder.id)) return []
    return [{ id: folder.id, name: folder.name, position, collapsed: collapsedFolders.has(folder.id), members, links: aggregatedLinks.get(folder.id)?.length ?? 0 }]
  }), [folders, folderPoints, visibleIds, dimmedIds, filteredCanvas, selectedFolder, collapsedFolders, aggregatedLinks])
  const filtersActive = !!(search.draft || type || relationType || focus || styles.some((item) => item.hidden))
  const selected = relations.find((edge) => edge.id === selectedEdge)
  const card = byId.get(selectedCard)
  const arrow = annotations.find((item) => item.id === selectedArrow)
  const folder = folders.find((item) => item.id === selectedFolder)
  const folderForCard = membership.get(selectedCard)
  const relationLabel = (edge: Relation) => `${byId.get(edge.sourceId)?.title} ${directionMark(relationDirection(edge))} ${byId.get(edge.targetId)?.title} · ${edge.label || edge.type}`
  const listed = panel !== 'records' ? [] : list === 'items'
    ? (recordFolder ? entities.filter((item) => membership.get(item.id)?.id === recordFolder) : visible)
      .filter((item) => normalize(`${item.title} ${membership.get(item.id)?.name ?? ''}`).includes(normalize(listQuery)))
      .map((item) => ({ id: item.id, label: item.title }))
    : visibleRelations.filter((edge) => normalize(relationLabel(edge)).includes(normalize(listQuery))).map((edge) => ({ id: edge.id, label: relationLabel(edge) }))
  const total = Math.max(1, Math.ceil(listed.length / pageSize))
  const current = Math.min(page, total - 1)
  const folderLinks = (folder && (collapsedFolders.has(folder.id) ? aggregatedLinks : externalLinks).get(folder.id)) ?? []
  const linkPages = Math.max(1, Math.ceil(folderLinks.length / pageSize))
  const linkPage = Math.min(page, linkPages - 1)

  function clearDraft() { setTool('move'); setSource(''); setTarget(''); setArrowStart(null); setArrowEnd(null); nextSearch.clear() }
  function openPanel(next: Panel, restore = true) {
    const active = document.activeElement
    if (restore && active instanceof HTMLElement && active !== document.body && !active.closest('aside')) opener.current = active
    setPanel(next); setReset(false)
  }
  function putFocusBack() {
    requestAnimationFrame(() => {
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true })
      else tools.current?.querySelector('button')?.focus({ preventScroll: true })
    })
  }
  function closePanel() { setPanel(null); clearDraft(); putFocusBack() }
  function selectTool(next: GraphTool) {
    if (next === tool || next === 'move') { closePanel(); return }
    clearDraft(); setTool(next); setPanel(null)
    const active = document.activeElement
    if (active instanceof HTMLElement && tools.current?.contains(active)) opener.current = active
  }
  function locateRecord(id: string) {
    const containing = membership.get(id)
    if (containing && collapsedFolders.has(containing.id)) setFolderCollapsed(containing.id, false)
    if (!visibleIds.has(id) || dimmedIds.has(id)) setLocatedCard(id)
    scene.current?.focus(id)
  }
  function selectRecord(id: string, center: boolean) {
    setSelectedCard(id); setSelectedEdge(''); setSelectedArrow('')
    openPanel('card')
    if (center) locateRecord(id)
  }
  function selectRelation(id: string) {
    setSelectedEdge(id); setSelectedCard(''); setSelectedArrow(''); openPanel('relation')
  }
  function selectAnnotation(id: string) {
    setSelectedArrow(id); setSelectedEdge(''); setSelectedCard(''); openPanel('annotation')
  }
  function updateAnnotations(next: FreeArrow[]) {
    setAnnotations(next); view.edit((current) => ({ ...current, annotations: next }))
  }
  function saveFolders(next: GraphFolder[]) {
    setFolders(next)
    view.edit((current) => ({ ...current, folders: next }))
  }
  function setFolderCollapsed(id: string, collapsed: boolean) {
    if (revealedFolder === id) setRevealedFolder('')
    if (collapsed && membership.get(locatedCard)?.id === id) setLocatedCard('')
    saveFolders(folders.map((item) => item.id === id ? { ...item, collapsed } : item))
  }
  function inspectFolder(id: string, linksOnly = false) {
    clearDraft()
    setSelectedFolder(id)
    setPage(0)
    openPanel(linksOnly ? 'folder-links' : 'folder')
  }
  function openRecords(folderId = '') {
    setRecordFolder(folderId)
    setList('items')
    setListQuery('')
    setPage(0)
    setBulkMode(false)
    setBulkIds([])
    openPanel('records')
  }
  function moveRecords(ids: readonly string[], destination: string) {
    if (!ids.length) return
    saveFolders(moveFolderMembers(folders, ids, destination))
    setBulkIds([])
    setNotice(ids.length === 1 ? 'Registro movido.' : `${ids.length} registros movidos.`)
  }
  function updateStyle(style: GraphStyle) {
    const next = styles.some((item) => item.type === style.type)
      ? styles.map((item) => item.type === style.type ? style : item)
      : [...styles, style]
    if (!GraphStylesSchema.safeParse(next).success) { setNotice('Não foi possível salvar o tipo de seta.'); return }
    setStyles(next); view.edit((current) => ({ ...current, styles: next })); setNotice('')
  }
  function changeFilters(nextType: string, nextRelation: string) {
    setLocatedCard('')
    setType(nextType); setRelationType(nextRelation)
    setPage(0)
    if (type !== nextType || relationType !== nextRelation) view.edit((current) => ({ ...current, preferences: { type: nextType, relationType: nextRelation } }))
  }
  function clearFilters() {
    setLocatedCard('')
    search.clear(); setFocus(''); setDirection('both'); setDepth(1); setPage(0)
    const next = styles.map((item) => ({ ...item, hidden: false }))
    const saveStyles = styles.some((item) => item.hidden) && GraphStylesSchema.safeParse(next).success
    if (styles.some((item) => item.hidden)) setStyles(next)
    if (saveStyles || type || relationType) view.edit((current) => ({ ...current, preferences: { type: '', relationType: '' }, styles: saveStyles ? next : current.styles }))
    setType(''); setRelationType('')
  }
  function chooseFocus(id: string) {
    setLocatedCard('')
    setFocus(id); setDepth(1); setPage(0)
    if (!id) setDirection('both')
  }
  function endpointFor(id: string): ArrowEndpoint | null {
    const position = displayedPositions[id]
    return position ? { point: cardCenter(position), cardId: id } : null
  }
  function openConnection(from: string, to: string) {
    clearDraft()
    setTool('connect'); setSource(from); setTarget(to)
    openPanel('connect', false)
  }
  function markArrow(start: ArrowEndpoint | null, end: ArrowEndpoint | null) {
    if (start?.cardId && end?.cardId) {
      openConnection(start.cardId, end.cardId)
      return
    }
    setArrowStart(start); setArrowEnd(end)
    nextSearch.clear()
    if (start && end) openPanel('arrow', false)
  }
  function chooseTarget(id: string) {
    if (tool === 'connect') { setTarget(id); openPanel('connect', false) }
    else {
      const endpoint = endpointFor(id)
      if (endpoint) markArrow(arrowStart, endpoint)
    }
    nextSearch.clear()
  }
  function changeArrowEnd(id: string, end: 'start' | 'end', endpoint: ArrowEndpoint) {
    const anchor = end === 'start' ? 'startCardId' : 'endCardId'
    updateAnnotations(annotations.map((item) => item.id === id ? { ...item, [end]: endpoint.point, [anchor]: endpoint.cardId } : item))
  }
  function restore() {
    setPositions({})
    setAutomatic(organizeGraph(entities.map((item) => item.id), relations))
    view.edit((current) => ({ ...current, positions: {} }))
    setReset(false); setNotice('Organização restaurada.')
  }
  function saveRelation(relation: Relation) {
    setRelations((current) => [...current.filter((item) => item.id !== relation.id), relation])
    setStyles((current) => buildGraphCatalog([relation.type], current))
    clearDraft(); selectRelation(relation.id)
  }

  const sceneState = useMemo<SceneState>(() => ({
    entities, relations, styles, annotations, folders: sceneFolders, membership, visibleIds: canvasIds, visibleRelationIds, dimmedIds, dimmedRelationIds, positions: displayedPositions, typeLabels,
    tool, source, target, selectedCard, selectedEdge, selectedArrow, arrowStart, arrowEnd,
  }), [entities, relations, styles, annotations, sceneFolders, membership, canvasIds, visibleRelationIds, dimmedIds, dimmedRelationIds, displayedPositions, typeLabels, tool, source, target, selectedCard, selectedEdge, selectedArrow, arrowStart, arrowEnd])
  const selectOnCanvas = useEffectEvent((hit: Parameters<Parameters<typeof createRelationshipScene>[1]['select']>[0], point: Point) => {
    const hitCard = hit?.kind === 'card' || hit?.kind === 'port' ? hit.id : ''
    if (hitCard && (!canvasIds.has(hitCard) || dimmedIds.has(hitCard))) return
    if (tool === 'connect' && hitCard) {
      if (!source || target) { setSource(hitCard); setTarget(''); nextSearch.clear() }
      else chooseTarget(hitCard)
    } else if (tool === 'arrow' && (!hit || hitCard)) {
      const endpoint = hitCard ? endpointFor(hitCard) ?? { point } : { point }
      if (!arrowStart || arrowEnd) markArrow(endpoint, null)
      else markArrow(arrowStart, endpoint)
    } else if (tool === 'move') {
      if (hit?.kind === 'port') { clearDraft(); setTool('connect'); setSource(hit.id); setPanel(null) }
      else if (hit?.kind === 'card') selectRecord(hit.id, false)
      else if (hit?.kind === 'edge') selectRelation(hit.id)
      else if (hit?.kind === 'arrow') selectAnnotation(hit.id)
      else if (hit?.kind === 'folder') setFolderCollapsed(hit.id, !collapsedFolders.has(hit.id))
      else if (hit?.kind === 'folder-links') inspectFolder(hit.id, true)
      else if (!hit) { setPanel(null); setSelectedCard(''); setSelectedEdge(''); setSelectedArrow(''); setSelectedFolder('') }
    }
  })
  const connectOnCanvas = useEffectEvent((from: string, to: string) => {
    openConnection(from, to)
  })
  const moveCard = useEffectEvent((id: string, point: Point) => {
    setPositions((current) => ({ ...current, [id]: point }))
    view.edit((current) => ({ ...current, positions: { ...current.positions, [id]: point } }))
  })
  const moveArrow = useEffectEvent((id: string, end: 'start' | 'end', endpoint: ArrowEndpoint) => changeArrowEnd(id, end, endpoint))
  const cancel = useEffectEvent(() => { if (panel || tool !== 'move') closePanel() })
  const init = useEffectEvent((canvas: ReturnType<typeof createRelationshipScene>) => {
    canvas.sync(sceneState)
    if (focus && visibleIds.has(focus)) canvas.focus(focus)
    else canvas.fit()
  })
  useEffect(() => {
    let disposed = false
    let canvas: ReturnType<typeof createRelationshipScene> | undefined
    void import('./relationship-scene').then(({ createRelationshipScene }) => {
      if (disposed || !host.current) return
      canvas = createRelationshipScene(host.current, {
        select: (hit, point) => selectOnCanvas(hit, point),
        connect: (from, to) => connectOnCanvas(from, to),
        move: (id, point) => moveCard(id, point),
        moveArrow: (id, end, point) => moveArrow(id, end, point),
        cancel: () => cancel(),
      })
      scene.current = canvas
      init(canvas)
      setLoading('ready')
    }).catch(() => { if (!disposed) { canvas?.destroy(); canvas = undefined; scene.current = null; setLoading('error') } })
    return () => { disposed = true; scene.current = null; canvas?.destroy() }
  }, [])
  useEffect(() => { scene.current?.sync(sceneState) }, [sceneState])

  return <section aria-labelledby="relationship-heading" className="absolute inset-0 isolate overflow-hidden bg-background" data-relationship-surface>
    <h1 id="relationship-heading" className="sr-only">Relacionamentos</h1>
    <div ref={host} data-relationship-canvas aria-hidden="true" className="absolute inset-0 touch-none overflow-hidden bg-[radial-gradient(circle,var(--border)_0.75px,transparent_0.75px)] bg-size-[22px_22px]" />
    <div ref={tools} role="group" aria-label="Ferramentas do grafo" className="absolute top-3 left-3 z-20 flex items-center gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg md:top-4 md:left-4">
      <Tool icon={MousePointer2} label="Selecionar e mover" pressed={tool === 'move'} onClick={() => selectTool('move')} />
      <Tool icon={Link2} label="Conectar" primary pressed={tool === 'connect'} onClick={() => selectTool('connect')} />
      <Tool icon={MoveUpRight} label="Seta livre" pressed={tool === 'arrow'} onClick={() => selectTool('arrow')} />
      <span className="relative">
        <Tool icon={SlidersHorizontal} label={filtersActive ? 'Busca e filtros (ativos)' : 'Busca e filtros'} expanded={panel === 'filters'} onClick={() => { if (panel === 'filters') closePanel(); else { clearDraft(); openPanel('filters') } }} />
        {filtersActive && <span aria-hidden="true" className="pointer-events-none absolute top-1 right-1 size-2 rounded-full bg-primary" />}
      </span>
      <Tool icon={Folder} label="Pastas" expanded={panel === 'folders' || panel === 'folder' || panel === 'folder-links'} onClick={() => { if (panel === 'folders') closePanel(); else { clearDraft(); openPanel('folders') } }} />
      <Tool icon={Ellipsis} label="Mais" expanded={panel === 'options'} onClick={() => { if (panel === 'options') closePanel(); else { clearDraft(); openPanel('options') } }} />
    </div>
    <div role="group" aria-label="Câmera do grafo" className="absolute right-3 bottom-3 z-20 flex gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg md:right-4 md:bottom-4">
      <Tool icon={Minus} label="Reduzir zoom" onClick={() => scene.current?.zoom(1 / 1.25)} />
      <Tool icon={Plus} label="Ampliar zoom" onClick={() => scene.current?.zoom(1.25)} />
      <Tool icon={Crosshair} label="Enquadrar" onClick={() => scene.current?.fit()} />
    </div>
    {tool !== 'move' && <div className="pointer-events-none absolute top-18 left-3 z-1 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-md border bg-popover p-2 text-sm text-popover-foreground md:top-19 md:left-4 md:max-w-80">
      <p role="status">{tool === 'connect' ? target ? 'Revise e confirme o vínculo.' : source ? 'Clique num cartão de destino ou busque pelo nome.' : 'Clique num cartão de origem ou arraste de uma porta.'
        : arrowEnd ? 'Confirme a seta livre.' : arrowStart ? 'Escolha o destino. Entre dois cartões, a seta vira um vínculo.' : 'Marque o início num cartão ou no fundo.'}</p>
      {choosingDestination && !panel && <TargetSearch search={nextSearch} matches={targetMatches} choose={chooseTarget} fit={() => scene.current?.fit()} />}
      {!panel && <Button size="sm" variant="outline" className="pointer-events-auto" onClick={() => openPanel(tool === 'connect' ? 'connect' : 'arrow', false)}>
        {tool === 'connect' ? 'Escolher nos campos' : 'Escolher cartões'}
      </Button>}
      {!panel && <Button size="sm" variant="ghost" className="pointer-events-auto" onClick={closePanel}>Cancelar</Button>}
    </div>}
    <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
      {(loading !== 'ready' || (visible.length === 0 && (entities.length > 0 || sceneFolders.length === 0))) && <div className="pointer-events-auto max-w-xs rounded-lg border bg-popover px-4 py-3 text-center text-sm text-popover-foreground shadow-sm">
        {loading === 'loading' ? <p role="status">Carregando grafo…</p> : loading === 'error' ? <><p role="alert">Não foi possível abrir o canvas.</p><Button size="sm" variant="outline" onClick={() => location.reload()}>Tentar novamente</Button></>
          : entities.length === 0 ? <><p>Crie um registro para começar.</p><Link href="/codex" className={linkStyle}>Abrir o Codex</Link></>
            : <><p>Nenhum registro no recorte.</p><Button size="sm" variant="outline" onClick={clearFilters}>Limpar filtros</Button></>}
      </div>}
    </div>
    <div className="absolute bottom-4 left-3 z-20 max-w-[calc(100%-11rem)] text-xs md:left-4">
      <p role="status" className={view.status.kind === 'queued' || view.status.kind === 'saving' ? 'rounded border bg-popover px-2 py-1 text-popover-foreground' : 'sr-only'}>
        {view.status.kind === 'queued' ? 'Salvamento pendente…' : view.status.kind === 'saving' ? 'Salvando vista…' : view.status.kind === 'saved' ? 'Vista salva.' : ''}
      </p>
      {view.status.kind === 'error' && <div className="mb-14 max-w-xs space-y-2 rounded-md border border-danger bg-popover p-2 md:mb-0">
        <p role="alert">{view.status.message}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={view.retry}>Repetir</Button>
          <Button size="sm" variant="outline" onClick={() => { if (window.confirm('Recarregar e descartar as mudanças ainda não salvas?')) location.reload() }}>Recarregar</Button>
        </div>
      </div>}
    </div>
    <p className="sr-only" role="status">{notice}</p>
    {panel && <GraphPanel key={panel} panel={panel} onClose={closePanel} footer={panel === 'filters' && <>
      <p role="status" className="w-full text-xs text-muted-foreground">{visible.length - dimmedIds.size} registros · {visibleRelations.length - dimmedRelationIds.size} vínculos</p>
      {filtersActive && <Button size="sm" variant="ghost" onClick={clearFilters}>Limpar filtros</Button>}
      {filtersActive && !previewingSearch && visible.length > 0 && <Button size="sm" variant="outline" onClick={() => { scene.current?.fit(); closePanel() }}>Enquadrar resultados</Button>}
    </>}>
      {panel === 'options' && <>
        <div className="grid gap-2">
          <Button variant="outline" className="justify-start" onClick={() => openPanel('legend')}>Legenda e estilos</Button>
          <Button variant="outline" className="justify-start" onClick={() => openRecords()}>Registros e vínculos</Button>
          {annotations.length > 0 && <Button variant="outline" className="justify-start" onClick={() => selectAnnotation(annotations[0].id)}>Setas livres</Button>}
          {entities.length > 0 && <Button variant="outline" className="justify-start" onClick={() => { if (Object.keys(positions).length) setReset(true); else restore() }}>Restaurar organização</Button>}
        </div>
        {reset && <div className={`${form.feedback} ${form.reveal} space-y-2`}>
          <p>Descartar todas as posições fixadas?</p>
          <Button size="sm" variant="destructive" onClick={restore}>Confirmar restauração</Button>{' '}
          <Button size="sm" variant="ghost" onClick={() => setReset(false)}>Cancelar</Button>
        </div>}
        {notice && <p>{notice}</p>}
      </>}
      {panel === 'filters' && <>
        <form onSubmit={(event) => { event.preventDefault(); search.apply() }}>
          <label className={form.field}>Buscar registro
            <span className={form.search}><Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="search" className={form.control} value={search.draft} placeholder="Digite parte do nome…" onChange={(event) => { search.setDraft(event.target.value); setPage(0); setLocatedCard('') }} onBlur={search.apply} />
            </span>
          </label>
        </form>
        <div className="space-y-3">
          <div className={form.field}><label htmlFor={focusField}>A partir de um registro</label>
            <CardPickerField id={focusField} items={pickerItems} title="Escolher registro de referência" value={focus} placeholder="Mundo inteiro · escolher um registro" triggerClassName={form.control} clearable onChange={chooseFocus} />
          </div>
          {focus && <div className={form.reveal + ' space-y-2'}>
            <div role="group" aria-label="Sentido dos vínculos" className="grid grid-cols-3 gap-1">
              {directions.map(({ id, label, icon: Icon }) => <Button key={id} type="button" variant={direction === id ? 'default' : 'outline'} size="sm" className="min-h-9" aria-pressed={direction === id} onClick={() => { setDirection(id); setPage(0) }}><Icon aria-hidden="true" />{label}</Button>)}
            </div>
            <p className="text-xs text-muted-foreground">{directions.find((option) => option.id === direction)?.description}. Vínculos de duas direções ou sem direção aparecem em todos os modos.</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Distância: {depth} {depth === 1 ? 'passo' : 'passos'}</span>
              <Button size="sm" variant="outline" onClick={() => { setDepth((level) => level + 1); setPage(0) }}>Expandir conexões</Button>
            </div>
          </div>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={form.field}>Tipo de registro <select className={form.control} value={type} onChange={(event) => changeFilters(event.target.value, relationType)}><option value="">Todos os registros</option>{types.map((item) => <option key={item} value={item}>{typeLabels[item] ?? item}</option>)}</select></label>
          <label className={form.field}>Tipo de vínculo <select className={form.control} value={relationType} onChange={(event) => changeFilters(type, event.target.value)}><option value="">Todos os vínculos</option>{relationTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
      </>}
      {panel === 'legend' && <><GraphStyleLegend styles={styles} relations={relations} update={updateStyle} />{notice && <p role="alert">{notice}</p>}</>}
      {panel === 'folders' && <GraphFoldersPanel folders={folders} memberCount={(item) => item.members.filter((id) => activeIds.has(id)).length} isCollapsed={(item) => collapsedFolders.has(item.id)}
        add={(name) => { const id = crypto.randomUUID(); saveFolders([...folders, { id, name, collapsed: false, members: [] }]); inspectFolder(id) }}
        open={(id) => inspectFolder(id)} />}
      {panel === 'folder' && folder && <>
        <h3 className="break-words text-lg">{folder.name}</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setFolderCollapsed(folder.id, !collapsedFolders.has(folder.id))}>{collapsedFolders.has(folder.id) ? 'Expandir pasta' : 'Recolher pasta'}</Button>
          <Button size="sm" variant="outline" onClick={() => { scene.current?.focus(folder.id, true); closePanel() }}>Ver pasta no grafo</Button>
          <Button size="sm" variant="outline" onClick={() => openRecords(folder.id)}>Ver registros da pasta</Button>
          <Button size="sm" variant="outline" onClick={() => inspectFolder(folder.id, true)}>Ver vínculos externos</Button>
        </div>
        <FolderNameForm key={folder.id} folders={folders} folder={folder} save={(name) => saveFolders(folders.map((item) => item.id === folder.id ? { ...item, name } : item))} />
        {reset ? <div className={`${form.feedback} ${form.error} ${form.reveal} space-y-2`}>
          <p>Os registros voltam à vista principal, com suas posições e vínculos.</p>
          <Button size="sm" variant="destructive" onClick={() => { saveFolders(folders.filter((item) => item.id !== folder.id)); setSelectedFolder(''); openPanel('folders'); setNotice('Pasta excluída.') }}>Confirmar exclusão</Button>{' '}
          <Button size="sm" variant="ghost" onClick={() => setReset(false)}>Cancelar</Button>
        </div> : <Button size="sm" variant="ghost" onClick={() => setReset(true)}>Excluir pasta</Button>}
      </>}
      {panel === 'folder-links' && folder && <>
        <h3 className="break-words text-lg">{folder.name}</h3>
        <Button size="sm" variant="outline" onClick={() => inspectFolder(folder.id)}>Abrir painel da pasta</Button>
        <p role="status">{folderLinks.length ? `${folderLinks.length} ${folderLinks.length === 1 ? 'vínculo externo' : 'vínculos externos'}` : 'Nenhum vínculo externo no recorte.'}</p>
        <ul className="divide-y">{folderLinks.slice(linkPage * pageSize, (linkPage + 1) * pageSize).map((edge) => <li key={edge.id}>
          <button type="button" className="min-h-9 w-full py-1.5 text-left hover:text-primary hover:underline" onClick={() => selectRelation(edge.id)}>{relationLabel(edge)}</button>
        </li>)}</ul>
        <Pager page={linkPage} total={linkPages} setPage={setPage} />
      </>}
      {panel === 'records' && <>
        {recordFolder && <div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-lg">{folder?.name}</h3><Button size="sm" variant="outline" onClick={() => openRecords()}>Todos os registros</Button></div>}
        {!recordFolder && <div className="flex gap-2">
          <Button size="sm" variant={list === 'items' ? 'default' : 'outline'} aria-pressed={list === 'items'} onClick={() => { setList('items'); setPage(0) }}>Registros</Button>
          <Button size="sm" variant={list === 'relations' ? 'default' : 'outline'} aria-pressed={list === 'relations'} onClick={() => { setList('relations'); setPage(0) }}>Vínculos</Button>
        </div>}
        <label className={form.field}>Buscar na lista <input type="search" className={form.control} value={listQuery} onChange={(event) => { setListQuery(event.target.value); setPage(0) }} /></label>
        <p role="status">{listed.length} {list === 'items' ? 'registros' : 'vínculos'}</p>
        {list === 'items' && folders.length > 0 && <Button size="sm" variant={bulkMode ? 'secondary' : 'outline'} aria-pressed={bulkMode} onClick={() => { setBulkMode(!bulkMode); setBulkIds([]) }}>{bulkMode ? 'Cancelar seleção' : 'Selecionar para mover'}</Button>}
        {list === 'items' && bulkMode && <><p role="status">{bulkIds.length} selecionados</p><FolderMoveForm folders={folders} count={bulkIds.length} onMove={(destination) => moveRecords(bulkIds, destination)} /></>}
        <ul className="divide-y">{listed.slice(current * pageSize, (current + 1) * pageSize).map((item) => {
          const context = list === 'items' && !recordFolder ? membership.get(item.id)?.name : undefined
          const label = <>{item.label}{context && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Folder aria-hidden="true" className="size-3" />{context}</span>}</>
          return <li key={item.id}>{list === 'items' && bulkMode ? <label className="flex min-h-9 cursor-pointer items-center gap-2 py-1.5">
            <input type="checkbox" checked={bulkIds.includes(item.id)} onChange={(event) => setBulkIds(event.target.checked ? [...bulkIds, item.id] : bulkIds.filter((id) => id !== item.id))} />
            <span>{label}</span>
          </label> : <button type="button" className="min-h-9 w-full py-1.5 text-left underline-offset-2 hover:text-primary hover:underline" onClick={() => list === 'items' ? selectRecord(item.id, true) : selectRelation(item.id)}>{label}</button>}</li>
        })}</ul>
        <Pager page={current} total={total} setPage={setPage} />
      </>}
      {panel === 'connect' && <CreateGraphRelation worldId={initialSettings.worldId} entities={entities} styles={styles} typeLabels={typeLabels} source={source} target={target} setSource={setSource} setTarget={setTarget} onCreated={saveRelation} onStyleCreated={updateStyle} />}
      {panel === 'card' && card && <>
        <div><h3 className="text-lg">{card.title}</h3><p className="text-muted-foreground">{typeLabels[card.type] ?? card.type}</p></div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/entity/${card.id}`} className={linkStyle}>Abrir ficha</Link>
          <Button size="sm" variant="outline" onClick={() => { locateRecord(card.id); closePanel() }}>Ver no grafo</Button>
          <Button size="sm" variant="outline" onClick={() => { clearDraft(); setTool('connect'); setSource(card.id); setPanel(null) }}>Conectar a partir daqui</Button>
          <Button size="sm" variant="outline" onClick={() => { clearDraft(); setTool('arrow'); setArrowStart(endpointFor(card.id)); setPanel(null) }}>Seta a partir daqui</Button>
          <Button size="sm" variant="outline" onClick={() => { chooseFocus(card.id); openPanel('filters') }}>Filtrar vizinhança</Button>
        </div>
        {folderForCard && <Button size="sm" variant="ghost" className="max-w-full whitespace-normal" onClick={() => inspectFolder(folderForCard.id)}><Folder aria-hidden="true" />{folderForCard.name}</Button>}
        {folders.length > 0 ? <FolderMoveForm key={folderForCard?.id ?? 'root'} folders={folders} count={1} current={folderForCard?.id ?? ''} onMove={(destination) => moveRecords([card.id], destination)} />
          : <Button size="sm" variant="ghost" onClick={() => openPanel('folders')}>Organizar em pastas</Button>}
        {!relations.some((edge) => edge.sourceId === card.id || edge.targetId === card.id) && <p className="text-muted-foreground">Sem vínculos.</p>}
      </>}
      {panel === 'relation' && selected && <>
        <p className={form.preview + ' wrap-anywhere'}><Link href={`/entity/${selected.sourceId}`} className={linkStyle}>{byId.get(selected.sourceId)?.title}</Link>
          {' '}{directionMark(relationDirection(selected))}{' '}
          <Link href={`/entity/${selected.targetId}`} className={linkStyle}>{byId.get(selected.targetId)?.title}</Link></p>
        <EditGraphRelation key={selected.id} worldId={initialSettings.worldId} relation={selected} styles={styles} onUpdated={saveRelation}
          onRemoved={(id) => { setRelations((current) => current.filter((item) => item.id !== id)); setSelectedEdge(''); closePanel(); setNotice('Vínculo removido.') }} />
      </>}
      {panel === 'arrow' && <FreeArrowForm start={arrowStart} end={arrowEnd} items={pickerItems} choose={(end, id) => {
        const point = endpointFor(id)
        if (point) markArrow(end === 'start' ? point : arrowStart, end === 'end' ? point : arrowEnd)
      }} save={(item) => {
        if (annotations.length >= 1000) { setNotice('O limite é de 1000 setas livres.'); return }
        updateAnnotations([...annotations, item]); clearDraft(); selectAnnotation(item.id)
      }} />}
      {panel === 'annotation' && arrow && <>
        <label className={form.field}>Anotação <select className={form.control} value={arrow.id} onChange={(event) => setSelectedArrow(event.target.value)}>
          {annotations.map((item, index) => <option key={item.id} value={item.id}>Seta {index + 1}</option>)}
        </select></label>
        <FreeArrowForm key={arrow.id} existing={arrow} start={{ point: arrow.start, cardId: arrow.startCardId }} end={{ point: arrow.end, cardId: arrow.endCardId }} items={pickerItems}
          choose={(end, id) => { const point = endpointFor(id); if (point) changeArrowEnd(arrow.id, end, point) }}
          save={(item) => updateAnnotations(annotations.map((entry) => entry.id === item.id ? item : entry))} />
        <Button size="sm" variant="destructive" onClick={() => { updateAnnotations(annotations.filter((item) => item.id !== arrow.id)); setSelectedArrow(''); closePanel() }}>Apagar seta livre</Button>
      </>}
    </GraphPanel>}
  </section>
}
