'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LayoutDashboard,
  Plus,
  Search,
  Settings2,
  Tag,
  TriangleAlert,
  X,
} from 'lucide-react'
import {
  AssetRecordType,
  HTMLContainer,
  MediaHelpers,
  Rectangle2d,
  ShapeUtil,
  T,
  Tldraw,
  createShapeId,
  getSnapshot,
  loadSnapshot,
  type Editor,
  type TLBaseShape,
  type TLEditorSnapshot,
  type TLResizeInfo,
} from 'tldraw'
import 'tldraw/tldraw.css'
import type { BoardDocument } from '@/domain/boards/board'
import type { BoardEntitySummary } from '@/components/boards/board-types'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import { PageScrollLock } from '@/components/entities/page-scroll-lock'
import { assetVariantUrl } from '@/lib/assetUrl'
import styles from './investigation-board.module.css'

const ENTITY_CARD_TYPE = 'entity-card' as const
const OPEN_ENTITY_EVENT = 'canon-codex:open-board-entity'
const ENTITY_DRAG_TYPE = 'application/x-canon-codex-entity'

declare module 'tldraw' {
  interface TLGlobalShapePropsMap {
    [ENTITY_CARD_TYPE]: {
      w: number
      h: number
      entityId: string
      viewMode: string
      showImage: boolean
      showType: boolean
      showTags: boolean
      showStatus: boolean
      customLabel: string
    }
  }
}

type EntityCardShape = TLBaseShape<typeof ENTITY_CARD_TYPE, {
  w: number
  h: number
  entityId: string
  viewMode: string
  showImage: boolean
  showType: boolean
  showTags: boolean
  showStatus: boolean
  customLabel: string
}>

const EntityMapContext = createContext<Map<string, BoardEntitySummary>>(new Map())

function EntityCardContent({ shape }: { shape: EntityCardShape }) {
  const entity = useContext(EntityMapContext).get(shape.props.entityId)
  if (!entity) return <div className={styles.missingCard}><TriangleAlert /><strong>Entidade indisponível</strong><span>{shape.props.entityId}</span></div>
  const portrait = shape.props.viewMode === 'portrait'
  const dossier = shape.props.viewMode === 'dossier'
  return (
    <div className={`${styles.entityCard} ${styles[shape.props.viewMode] ?? ''}`}>
      <span className={styles.pin} />
      {shape.props.showImage && entity.thumbnailAssetId && <Image className={styles.cardImage} src={assetVariantUrl(entity.thumbnailAssetId, portrait || dossier ? 'original' : 'thumbnail')} alt="" width={480} height={480} unoptimized draggable={false} />}
      <div className={styles.cardBody}>
        {shape.props.showType && <span className={styles.entityType}>{entity.typeLabel}</span>}
        <strong className={styles.entityTitle}>{shape.props.customLabel || entity.title}</strong>
        {entity.subtitle && <span className={styles.entitySubtitle}>{entity.subtitle}</span>}
        {shape.props.showStatus && entity.status && <span className={styles.entityStatus}><i />{entity.status}</span>}
        {shape.props.showTags && entity.tags.length > 0 && <div className={styles.entityTags}>{entity.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>}
      </div>
    </div>
  )
}

class EntityCardShapeUtil extends ShapeUtil<EntityCardShape> {
  static override type = ENTITY_CARD_TYPE
  static override props = {
    w: T.number, h: T.number, entityId: T.string, viewMode: T.string,
    showImage: T.boolean, showType: T.boolean, showTags: T.boolean,
    showStatus: T.boolean, customLabel: T.string,
  }
  getDefaultProps(): EntityCardShape['props'] { return { w: 280, h: 170, entityId: '', viewMode: 'card', showImage: true, showType: true, showTags: true, showStatus: true, customLabel: '' } }
  getGeometry(shape: EntityCardShape) { return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true }) }
  component(shape: EntityCardShape) { return <HTMLContainer className={styles.shapeContainer} style={{ width: shape.props.w, height: shape.props.h }}><EntityCardContent shape={shape} /></HTMLContainer> }
  getIndicatorPath(shape: EntityCardShape) { const path = new Path2D(); path.rect(0, 0, shape.props.w, shape.props.h); return path }
  override canResize() { return true }
  override onResize(shape: EntityCardShape, info: TLResizeInfo<EntityCardShape>) {
    return { props: { w: Math.max(160, shape.props.w * info.scaleX), h: Math.max(90, shape.props.h * info.scaleY) } }
  }
  override onDoubleClick(shape: EntityCardShape) { window.dispatchEvent(new CustomEvent(OPEN_ENTITY_EVENT, { detail: shape.props.entityId })) }
  override getAriaDescriptor(shape: EntityCardShape) { return `Referência para entidade ${shape.props.entityId}` }
}

const shapeUtils = [EntityCardShapeUtil]

function createEntityShape(editor: Editor, entityId: string, point?: { x: number; y: number }) {
  const center = point ?? editor.getViewportPageBounds().center
  const id = createShapeId()
  editor.createShape<EntityCardShape>({
    id,
    type: ENTITY_CARD_TYPE,
    x: center.x - 140,
    y: center.y - 85,
    props: { entityId },
  })
  editor.select(id)
  editor.setCurrentTool('select')
}

export function InvestigationBoard({ board, entities }: { board: BoardDocument; entities: BoardEntitySummary[] }) {
  const router = useRouter()
  const editorRef = useRef<Editor | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [query, setQuery] = useState('')
  const [searchResultIds, setSearchResultIds] = useState<string[] | null>(null)
  const [worldPanelOpen, setWorldPanelOpen] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [selectedShape, setSelectedShape] = useState<EntityCardShape | null>(null)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const entityMap = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities])
  const filtered = useMemo(() => !query.trim() || searchResultIds === null ? entities : searchResultIds.map((id) => entityMap.get(id)).filter((entity): entity is BoardEntitySummary => Boolean(entity)), [entities, entityMap, query, searchResultIds])
  const preview = previewId ? entityMap.get(previewId) : undefined

  useEffect(() => () => { cleanupRef.current?.(); if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }, [])
  useEffect(() => {
    // Back/forward navigation may restore an older RSC payload from the client router cache.
    // Refreshing merges current entity summaries without resetting the mounted tldraw editor.
    router.refresh()
  }, [router])
  useEffect(() => {
    const open = (event: Event) => setPreviewId((event as CustomEvent<string>).detail)
    window.addEventListener(OPEN_ENTITY_EVENT, open)
    return () => window.removeEventListener(OPEN_ENTITY_EVENT, open)
  }, [])
  useEffect(() => {
    if (!query.trim()) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/entities/search?q=${encodeURIComponent(query)}&limit=40`, { signal: controller.signal })
        if (!response.ok) return
        const results = await response.json() as Array<{ id: string }>
        setSearchResultIds(results.map((result) => result.id))
      } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setSearchResultIds([]) }
    }, 120)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); event.stopImmediatePropagation(); setPaletteOpen(true) }
      if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !(event.target instanceof HTMLElement && event.target.isContentEditable)) { event.preventDefault(); setPaletteOpen(true) }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const saveDocument = (editor: Editor) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaveState('saving')
      try {
        const { document } = getSnapshot(editor.store)
        const response = await fetch(`/api/boards/${board.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snapshot: { document } }) })
        if (!response.ok) throw new Error('Falha ao salvar')
        setSaveState('saved')
      } catch { setSaveState('error') }
    }, 700)
  }

  const onMount = (editor: Editor) => {
    editorRef.current = editor
    const sessionKey = `canon-codex:board-session:${board.id}`
    const savedSession = window.localStorage.getItem(sessionKey)
    if (savedSession) {
      try { loadSnapshot(editor.store, { session: JSON.parse(savedSession) }) } catch { window.localStorage.removeItem(sessionKey) }
    } else if (editor.getCurrentPageShapes().length > 0) {
      editor.zoomToFit({ animation: { duration: 0 } })
    }
    editor.registerExternalAssetHandler('file', async ({ file, assetId }) => {
      const form = new FormData(); form.set('file', file)
      const response = await fetch('/api/assets', { method: 'POST', body: form })
      if (!response.ok) throw new Error('Não foi possível importar a imagem')
      const { assetId: wikiAssetId } = await response.json() as { assetId: string }
      const size = await MediaHelpers.getImageSize(file)
      return AssetRecordType.create({ id: assetId ?? AssetRecordType.createId(), type: 'image', props: { name: file.name, src: assetVariantUrl(wikiAssetId, 'original'), w: size.w, h: size.h, mimeType: file.type, isAnimated: await MediaHelpers.isAnimated(file), fileSize: file.size }, meta: { wikiAssetId } })
    })
    cleanupRef.current?.()
    const stopDocument = editor.store.listen(() => saveDocument(editor), { source: 'user', scope: 'document' })
    const stopSelection = editor.store.listen(() => {
      const { session } = getSnapshot(editor.store)
      window.localStorage.setItem(sessionKey, JSON.stringify(session))
      const shape = editor.getSelectedShapes().find((item): item is EntityCardShape => item.type === ENTITY_CARD_TYPE)
      setSelectedShape(shape ?? null)
    }, { source: 'all', scope: 'session' })
    cleanupRef.current = () => { stopDocument(); stopSelection() }
  }

  const addEntity = (entityId: string, point?: { x: number; y: number }) => { const editor = editorRef.current; if (!editor) return; createEntityShape(editor, entityId, point); setPaletteOpen(false) }
  const updateEntityShape = (props: Partial<EntityCardShape['props']>) => {
    const editor = editorRef.current
    if (!editor || !selectedShape) return
    editor.updateShape<EntityCardShape>({ id: selectedShape.id, type: ENTITY_CARD_TYPE, props })
    setSelectedShape(editor.getShape<EntityCardShape>(selectedShape.id) ?? null)
  }

  return (
    <EntityMapContext.Provider value={entityMap}>
      <div className={styles.boardShell}>
        <PageScrollLock />
        <header className={styles.boardHeader}>
          <Link href="/boards" className={styles.headerButton} aria-label="Voltar aos quadros"><ArrowLeft /></Link>
          <div className={styles.boardIdentity}><LayoutDashboard /><div><span>Quadro</span><strong>{board.title}</strong></div></div>
          <button className={styles.headerSearch} onClick={() => setPaletteOpen(true)}><Search /><span>Adicionar entidade...</span><kbd>Ctrl K</kbd></button>
          <div className={styles.saveState} data-state={saveState}>{saveState === 'saved' ? <Check /> : saveState === 'error' ? <TriangleAlert /> : <span className={styles.spinner} />}{saveState === 'saved' ? 'Salvo' : saveState === 'error' ? 'Erro ao salvar' : 'Salvando'}</div>
        </header>

        <div className={styles.canvasStage} onDragOver={(event) => { if (event.dataTransfer.types.includes(ENTITY_DRAG_TYPE)) event.preventDefault() }} onDrop={(event) => { const id = event.dataTransfer.getData(ENTITY_DRAG_TYPE); if (!id || !editorRef.current) return; event.preventDefault(); addEntity(id, editorRef.current.screenToPage({ x: event.clientX, y: event.clientY })) }}>
          <Tldraw
            shapeUtils={shapeUtils}
            components={{ PageMenu: null }}
            snapshot={(board.canvasSnapshot ?? undefined) as TLEditorSnapshot | undefined}
            onMount={onMount}
            autoFocus
            colorScheme="dark"
            licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY}
          />
        </div>

        <aside className={`${styles.worldPanel} ${worldPanelOpen ? '' : styles.worldPanelClosed}`}>
          <button className={styles.panelToggle} onClick={() => setWorldPanelOpen((open) => !open)} aria-label={worldPanelOpen ? 'Recolher entidades' : 'Abrir entidades'}>{worldPanelOpen ? <ChevronLeft /> : <ChevronRight />}</button>
          <div className={styles.panelInner}>
            <div className={styles.panelHeading}><span>WORLD</span><small>Arraste para a mesa</small></div>
            <label className={styles.panelSearch}><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar entidades" /></label>
            <div className={styles.entityList}>{filtered.map((entity) => <button key={entity.id} draggable onDragStart={(event) => { event.dataTransfer.setData(ENTITY_DRAG_TYPE, entity.id); event.dataTransfer.effectAllowed = 'copy' }} onClick={() => addEntity(entity.id)} className={styles.entityRow}><span className={styles.rowIcon}><EntityTypeIcon name={entity.typeIcon} /></span><span><strong>{entity.title}</strong><small>{entity.typeLabel}{entity.subtitle ? ` · ${entity.subtitle}` : ''}</small></span><Plus /></button>)}{filtered.length === 0 && <p className={styles.emptySearch}>Nenhuma entidade encontrada.</p>}</div>
          </div>
        </aside>

        {selectedShape && <aside className={styles.inspector}>
          <div className={styles.inspectorHeader}><span><Settings2 /> Aparência</span><button onClick={() => { editorRef.current?.selectNone(); setSelectedShape(null) }}><X /></button></div>
          <label>Visualização<select value={selectedShape.props.viewMode} onChange={(event) => { const viewMode = event.target.value; updateEntityShape(viewMode === 'wide' ? { viewMode, w: 420, h: 190 } : selectedShape.props.viewMode === 'wide' ? { viewMode, w: 280, h: 170 } : { viewMode }) }}><option value="minimal">Mínima</option><option value="card">Cartão</option><option value="portrait">Retrato</option><option value="dossier">Dossiê</option>{entityMap.get(selectedShape.props.entityId)?.type === 'location' && <option value="wide">Local amplo</option>}</select></label>
          <label>Nome personalizado<input value={selectedShape.props.customLabel} onChange={(event) => updateEntityShape({ customLabel: event.target.value })} placeholder={entityMap.get(selectedShape.props.entityId)?.title} /></label>
          {[['showImage', 'Imagem'], ['showType', 'Tipo'], ['showStatus', 'Status'], ['showTags', 'Etiquetas']].map(([key, label]) => <label key={key} className={styles.switchRow}><input type="checkbox" checked={selectedShape.props[key as keyof EntityCardShape['props']] as boolean} onChange={(event) => updateEntityShape({ [key]: event.target.checked })} /><span>{label}</span></label>)}
          <button className={styles.openPreview} onClick={() => setPreviewId(selectedShape.props.entityId)}>Abrir ficha rápida <ExternalLink /></button>
        </aside>}

        {previewId && <aside className={styles.previewPanel}>
          <div className={styles.previewHeader}><span>Ficha rápida</span><button onClick={() => setPreviewId(null)}><X /></button></div>
          {preview ? <><div className={styles.previewPhoto}>{preview.thumbnailAssetId ? <Image src={assetVariantUrl(preview.thumbnailAssetId, 'original')} alt="" width={640} height={480} unoptimized /> : <EntityTypeIcon name={preview.typeIcon} />}</div><div className={styles.previewIntro}><p className={styles.previewType}>{preview.typeLabel}</p><h2>{preview.title}</h2>{preview.subtitle && <p>{preview.subtitle}</p>}{preview.status && <p className={styles.previewStatus}><i />{preview.status}</p>}</div>{preview.aliases.length > 0 && <div className={styles.previewAliases}><span>Também conhecido como</span><p>{preview.aliases.join(' · ')}</p></div>}{preview.fields.length > 0 && <dl className={styles.previewFields}>{preview.fields.map((field) => <div key={field.label} className={field.wide ? styles.previewFieldWide : undefined}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>}<div className={styles.previewTags}>{preview.tags.map((tag) => <span key={tag}><Tag />{tag}</span>)}</div><button className={styles.fullPageButton} onClick={() => router.push(`/entity/${preview.id}`)}>Abrir página completa <ExternalLink /></button></> : <div className={styles.previewMissing}><TriangleAlert /><h2>Entidade indisponível</h2><p>Esta entidade foi removida da wiki, mas sua referência foi preservada no quadro.</p></div>}
        </aside>}

        {paletteOpen && <div className={styles.paletteBackdrop} onMouseDown={() => setPaletteOpen(false)}><div className={styles.palette} onMouseDown={(event) => event.stopPropagation()}><div className={styles.paletteInput}><Search /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Adicionar ao quadro..." /><button onClick={() => setPaletteOpen(false)}><X /></button></div><div className={styles.paletteResults}>{filtered.slice(0, 12).map((entity) => <button key={entity.id} onClick={() => addEntity(entity.id)}><EntityTypeIcon name={entity.typeIcon} /><span><strong>{entity.title}</strong><small>{entity.typeLabel}{entity.subtitle ? ` · ${entity.subtitle}` : ''}</small></span><Plus /></button>)}</div></div></div>}
      </div>
    </EntityMapContext.Provider>
  )
}
