'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  LayoutDashboard,
  Maximize,
  Minus,
  Plus,
  Redo2,
  Search,
  Settings2,
  Tag,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from 'lucide-react'
import type { BoardDocument } from '@/domain/boards/board'
import { CARD_DEFAULT, CARD_WIDE, readBoardCanvas, type BoardCanvas, type BoardCard, type GeoType } from '@/domain/boards/boardCanvas'
import type { CameraState } from '@/domain/canvas/camera'
import type { BoardEntitySummary } from '@/components/boards/board-types'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import { PageScrollLock } from '@/components/entities/page-scroll-lock'
import { assetVariantUrl } from '@/lib/assetUrl'
import { canvasDraftKey, readCanvasDraft, sendCanvasSave, writeCanvasDraft } from '@/lib/canvas/canvas-drafts'
import { boardFontVariables } from './board-fonts'
import type { BoardEditor, BoardStyleState, BoardTool } from './board-stage'
import { BoardToolbar } from './board-toolbar'
import { toast } from 'sonner'
import styles from './investigation-board.module.css'

const ENTITY_DRAG_TYPE = 'application/x-canon-codex-entity'

export function InvestigationBoard({ board, entities }: { board: BoardDocument; entities: BoardEntitySummary[] }) {
  const router = useRouter()
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<BoardEditor | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cameraTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [query, setQuery] = useState('')
  const [searchResultIds, setSearchResultIds] = useState<string[] | null>(null)
  const [worldPanelOpen, setWorldPanelOpen] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [selectedCard, setSelectedCard] = useState<BoardCard | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  const [tool, setToolState] = useState<BoardTool>('select')
  const [geoType, setGeoTypeState] = useState<GeoType>('rectangle')
  const [styleState, setStyleState] = useState<BoardStyleState>({ visible: false, color: null, size: null })
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [zoom, setZoom] = useState(1)
  const [history, setHistory] = useState({ undo: false, redo: false })
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const draftKey = canvasDraftKey('board', board.id)
  // Lido uma vez (o componente é recriado por quadro). A versão em memória vence a da página, que o
  // roteador pode ter guardado antes das últimas alterações. Um canvas ilegível não abre o editor.
  const [initialCanvas] = useState<BoardCanvas | null>(() => { try { return readBoardCanvas(readCanvasDraft(draftKey) ?? board.canvasSnapshot) } catch { return null } })
  const entityMap = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities])
  const filtered = useMemo(() => !query.trim() || searchResultIds === null ? entities : searchResultIds.map((id) => entityMap.get(id)).filter((entity): entity is BoardEntitySummary => Boolean(entity)), [entities, entityMap, query, searchResultIds])
  const preview = previewId ? entityMap.get(previewId) : undefined
  const cameraKey = `canon-codex:board-camera:${board.id}`

  useEffect(() => () => { if (cameraTimerRef.current) clearTimeout(cameraTimerRef.current) }, [])
  useEffect(() => {
    // Back/forward navigation may restore an older RSC payload from the client router cache.
    // Refreshing merges current entity summaries without resetting the mounted editor.
    router.refresh()
  }, [router])
  useEffect(() => {
    if (!query.trim()) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/entities/search?q=${encodeURIComponent(query)}&limit=40`, { signal: controller.signal })
        if (!response.ok) return
        const results = await response.json() as Array<{ id: string }>
        if (!controller.signal.aborted) setSearchResultIds(results.map((result) => result.id))
      } catch { if (!controller.signal.aborted) setSearchResultIds([]) }
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

  const saveDocument = (editor: BoardEditor) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      saveTimerRef.current = null
      setSaveState('saving')
      try {
        const canvas = editor.getCanvas()
        writeCanvasDraft(draftKey, canvas)
        const response = await sendCanvasSave(`/api/boards/${board.id}`, { snapshot: canvas })
        if (!response.ok) throw new Error('Falha ao salvar')
        setSaveState('saved')
      } catch { setSaveState('error') }
    }, 700)
  }
  /** Salva na hora o que estiver esperando: ao sair do quadro ou fechar a aba. */
  const flushSave = useEffectEvent(() => {
    const editor = editorRef.current
    if (!saveTimerRef.current || !editor) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = null
    const canvas = editor.getCanvas()
    writeCanvasDraft(draftKey, canvas)
    void sendCanvasSave(`/api/boards/${board.id}`, { snapshot: canvas }).catch(() => undefined)
  })
  useEffect(() => {
    const onPageHide = () => flushSave()
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [])
  const syncSelection = (editor: BoardEditor) => {
    const card = editor.getSelectedShapes().find((shape): shape is BoardCard => shape.kind === 'card')
    setSelectedCard(card ?? null)
    setHasSelection(editor.getSelectedIds().length > 0)
    setStyleState(editor.getStyleState())
  }
  const onDocumentChanged = useEffectEvent(() => {
    const editor = editorRef.current
    if (!editor) return
    saveDocument(editor)
    syncSelection(editor)
    setHistory({ undo: editor.canUndo(), redo: editor.canRedo() })
  })
  const onSelectionChanged = useEffectEvent(() => { const editor = editorRef.current; if (editor) syncSelection(editor) })
  const onCameraChanged = useEffectEvent(() => {
    const editor = editorRef.current
    if (!editor) return
    setZoom(editor.getZoom())
    if (cameraTimerRef.current) clearTimeout(cameraTimerRef.current)
    cameraTimerRef.current = setTimeout(() => window.localStorage.setItem(cameraKey, JSON.stringify(editor.getCamera())), 300)
  })
  const onToolChanged = useEffectEvent(() => { const editor = editorRef.current; if (editor) { setToolState(editor.getTool()); setGeoTypeState(editor.getGeoType()); setStyleState(editor.getStyleState()) } })
  const insertImages = (files: File[], client?: { clientX: number; clientY: number }) => {
    void editorRef.current?.insertImages(files, client).catch(() => toast.error('Não foi possível importar a imagem.'))
  }
  const initialEntities = useEffectEvent(() => entityMap)
  useEffect(() => {
    const host = canvasHostRef.current
    if (!host || !initialCanvas) return
    let disposed = false, editor: BoardEditor | null = null
    let camera: CameraState | null = null
    try {
      const saved = JSON.parse(window.localStorage.getItem(cameraKey) ?? 'null') as CameraState | null
      if (saved && [saved.x, saved.y, saved.z].every(Number.isFinite) && saved.z > 0) camera = saved
    } catch { window.localStorage.removeItem(cameraKey) }
    void import('./board-stage').then(({ createBoardEditor }) => {
      if (disposed) return
      editor = createBoardEditor(host, {
        canvas: initialCanvas, entities: initialEntities(), camera,
        callbacks: { documentChanged: () => onDocumentChanged(), selectionChanged: () => onSelectionChanged(), cameraChanged: () => onCameraChanged(), toolChanged: () => onToolChanged(), openEntity: (id) => setPreviewId(id), pickImage: () => imageInputRef.current?.click() },
      })
      editorRef.current = editor
      setZoom(editor.getZoom())
    })
    return () => {
      disposed = true
      flushSave()
      // A câmera volta exatamente onde estava, mesmo sem pan ou zoom nesta visita.
      if (editor) window.localStorage.setItem(cameraKey, JSON.stringify(editor.getCamera()))
      editor?.destroy()
      if (editorRef.current === editor) editorRef.current = null
    }
  }, [initialCanvas, cameraKey])
  useEffect(() => { editorRef.current?.setEntities(entityMap) }, [entityMap])

  const addEntity = (entityId: string, point?: { x: number; y: number }) => { editorRef.current?.createCard(entityId, point); setPaletteOpen(false) }
  const updateEntityShape = (props: Partial<BoardCard>) => {
    const editor = editorRef.current
    if (!editor || !selectedCard) return
    editor.updateShapes([{ id: selectedCard.id, ...props }])
  }

  return (
    <div className={`${styles.boardShell} ${boardFontVariables}`}>
        <PageScrollLock />
        <header className={styles.boardHeader}>
          <Link href="/boards" className={styles.headerButton} aria-label="Voltar aos quadros"><ArrowLeft /></Link>
          <div className={styles.boardIdentity}><LayoutDashboard /><div><span>Quadro</span><strong>{board.title}</strong></div></div>
          <button className={styles.headerSearch} onClick={() => setPaletteOpen(true)}><Search /><span>Adicionar entidade...</span><kbd>Ctrl K</kbd></button>
          <div className={styles.saveState} data-state={saveState}>{saveState === 'saved' ? <Check /> : saveState === 'error' ? <TriangleAlert /> : <span className={styles.spinner} />}{saveState === 'saved' ? 'Salvo' : saveState === 'error' ? 'Erro ao salvar' : 'Salvando'}</div>
        </header>

        <div className={styles.canvasStage} onDragOverCapture={(event) => { if (event.dataTransfer.types.includes(ENTITY_DRAG_TYPE) || event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy' } }} onDropCapture={(event) => { const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith('image/')); if (files.length) { event.preventDefault(); event.stopPropagation(); insertImages(files, { clientX: event.clientX, clientY: event.clientY }); return } const id = event.dataTransfer.getData(ENTITY_DRAG_TYPE); if (!id || !editorRef.current) return; event.preventDefault(); event.stopPropagation(); addEntity(id, editorRef.current.screenToPage({ clientX: event.clientX, clientY: event.clientY })) }}>
          <div ref={canvasHostRef} className={styles.canvasHost} aria-label="Canvas do quadro" />
          {!initialCanvas && <div className={styles.canvasError} role="alert"><TriangleAlert /><strong>Não foi possível ler o canvas deste quadro.</strong><span>O registro foi preservado sem alterações.</span></div>}
          <div className={styles.quickActions}>
            <button onClick={() => editorRef.current?.undo()} disabled={!history.undo} title="Desfazer (Ctrl Z)" aria-label="Desfazer"><Undo2 /></button>
            <button onClick={() => editorRef.current?.redo()} disabled={!history.redo} title="Refazer (Ctrl Shift Z)" aria-label="Refazer"><Redo2 /></button>
            <button onClick={() => editorRef.current?.deleteSelected()} disabled={!hasSelection} title="Excluir (Delete)" aria-label="Excluir"><Trash2 /></button>
            <button onClick={() => editorRef.current?.duplicate()} disabled={!hasSelection} title="Duplicar (Ctrl D)" aria-label="Duplicar"><Copy /></button>
          </div>
          <BoardToolbar tool={tool} geoType={geoType} styleState={styleState} onColor={(color) => editorRef.current?.setStyle({ color })} onSize={(size) => editorRef.current?.setStyle({ size })} onTool={(next) => editorRef.current?.setTool(next)} onGeo={(geo) => editorRef.current?.setGeoType(geo)} onImage={() => imageInputRef.current?.click()} />
          <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={(event) => { const files = [...(event.target.files ?? [])]; event.target.value = ''; insertImages(files) }} />
          <div className={styles.zoomMenu}>
            <button onClick={() => editorRef.current?.zoomOut()} title="Afastar (Ctrl -)" aria-label="Afastar"><Minus /></button>
            <button className={styles.zoomValue} onClick={() => editorRef.current?.resetZoom()} title="Zoom 100% (Shift 0)">{Math.round(zoom * 100)}%</button>
            <button onClick={() => editorRef.current?.zoomIn()} title="Aproximar (Ctrl =)" aria-label="Aproximar"><Plus /></button>
            <button onClick={() => editorRef.current?.zoomToFit()} title="Enquadrar tudo (Shift 1)" aria-label="Enquadrar tudo"><Maximize /></button>
          </div>
        </div>

        <aside className={`${styles.worldPanel} ${worldPanelOpen ? '' : styles.worldPanelClosed}`}>
          <button className={styles.panelToggle} onClick={() => setWorldPanelOpen((open) => !open)} aria-label={worldPanelOpen ? 'Recolher entidades' : 'Abrir entidades'}>{worldPanelOpen ? <ChevronLeft /> : <ChevronRight />}</button>
          <div className={styles.panelInner}>
            <div className={styles.panelHeading}><span>WORLD</span><small>Arraste para a mesa</small></div>
            <label className={styles.panelSearch}><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar entidades" /></label>
            <div className={styles.entityList}>{filtered.map((entity) => <button key={entity.id} draggable onDragStart={(event) => { event.dataTransfer.setData(ENTITY_DRAG_TYPE, entity.id); event.dataTransfer.effectAllowed = 'copy' }} onClick={() => addEntity(entity.id)} className={styles.entityRow}><span className={styles.rowIcon}><EntityTypeIcon name={entity.typeIcon} /></span><span><strong>{entity.title}</strong><small>{entity.typeLabel}{entity.subtitle ? ` · ${entity.subtitle}` : ''}</small></span><Plus /></button>)}{filtered.length === 0 && <p className={styles.emptySearch}>Nenhuma entidade encontrada.</p>}</div>
          </div>
        </aside>

        {selectedCard && <aside className={styles.inspector}>
          <div className={styles.inspectorHeader}><span><Settings2 /> Aparência</span><button onClick={() => editorRef.current?.selectNone()}><X /></button></div>
          <label>Visualização<select value={selectedCard.viewMode} onChange={(event) => { const viewMode = event.target.value; const mode = viewMode as BoardCard['viewMode']; updateEntityShape(mode === 'wide' ? { viewMode: mode, ...CARD_WIDE } : selectedCard.viewMode === 'wide' ? { viewMode: mode, ...CARD_DEFAULT } : { viewMode: mode }) }}><option value="minimal">Mínima</option><option value="card">Cartão</option><option value="portrait">Retrato</option><option value="dossier">Dossiê</option>{entityMap.get(selectedCard.entityId)?.type === 'location' && <option value="wide">Local amplo</option>}</select></label>
          <label>Nome personalizado<input value={selectedCard.customLabel} onChange={(event) => updateEntityShape({ customLabel: event.target.value })} placeholder={entityMap.get(selectedCard.entityId)?.title} /></label>
          {[['showImage', 'Imagem'], ['showType', 'Tipo'], ['showStatus', 'Status'], ['showTags', 'Etiquetas']].map(([key, label]) => <label key={key} className={styles.switchRow}><input type="checkbox" checked={selectedCard[key as 'showImage' | 'showType' | 'showStatus' | 'showTags']} onChange={(event) => updateEntityShape({ [key]: event.target.checked })} /><span>{label}</span></label>)}
          <button className={styles.openPreview} onClick={() => setPreviewId(selectedCard.entityId)}>Abrir ficha rápida <ExternalLink /></button>
        </aside>}

        {previewId && <aside className={styles.previewPanel}>
          <div className={styles.previewHeader}><span>Ficha rápida</span><button onClick={() => setPreviewId(null)}><X /></button></div>
          {preview ? <><div className={styles.previewPhoto}>{preview.thumbnailAssetId ? <Image src={assetVariantUrl(preview.thumbnailAssetId, 'original')} alt="" width={640} height={480} unoptimized /> : <EntityTypeIcon name={preview.typeIcon} />}</div><div className={styles.previewIntro}><p className={styles.previewType}>{preview.typeLabel}</p><h2>{preview.title}</h2>{preview.subtitle && <p>{preview.subtitle}</p>}{preview.status && <p className={styles.previewStatus}><i />{preview.status}</p>}</div>{preview.aliases.length > 0 && <div className={styles.previewAliases}><span>Também conhecido como</span><p>{preview.aliases.join(' · ')}</p></div>}{preview.fields.length > 0 && <dl className={styles.previewFields}>{preview.fields.map((field) => <div key={field.label} className={field.wide ? styles.previewFieldWide : undefined}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>}<div className={styles.previewTags}>{preview.tags.map((tag) => <span key={tag}><Tag />{tag}</span>)}</div><button className={styles.fullPageButton} onClick={() => router.push(`/entity/${preview.id}`)}>Abrir página completa <ExternalLink /></button></> : <div className={styles.previewMissing}><TriangleAlert /><h2>Entidade indisponível</h2><p>Esta entidade foi removida da wiki, mas sua referência foi preservada no quadro.</p></div>}
        </aside>}

        {paletteOpen && <div className={styles.paletteBackdrop} onMouseDown={() => setPaletteOpen(false)}><div className={styles.palette} onMouseDown={(event) => event.stopPropagation()}><div className={styles.paletteInput}><Search /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Adicionar ao quadro..." /><button onClick={() => setPaletteOpen(false)}><X /></button></div><div className={styles.paletteResults}>{filtered.slice(0, 12).map((entity) => <button key={entity.id} onClick={() => addEntity(entity.id)}><EntityTypeIcon name={entity.typeIcon} /><span><strong>{entity.title}</strong><small>{entity.typeLabel}{entity.subtitle ? ` · ${entity.subtitle}` : ''}</small></span><Plus /></button>)}</div></div></div>}
      </div>
  )
}
