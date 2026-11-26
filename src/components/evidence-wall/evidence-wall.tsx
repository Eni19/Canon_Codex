'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { RotateCcw, X } from 'lucide-react'
import type { ContentTextBlock } from '@/components/editor/content-text'
import { hand, typewriter } from '@/components/codex-notebook/notebook-fonts'
import { bringToFront, defaultLayout, readWallLayout, serializeWallLayout, wallStrings, type WallItemRef, type WallLayout } from '@/domain/evidence/evidenceWall'
import { assetVariantUrl } from '@/lib/assetUrl'
import type { WallPiece } from './evidence-wall-scene'
import { NOTE_COLORS, paginateSheet, paintNote, paintPolaroid, paintSheet, type WallFonts } from './wall-textures'
import styles from './evidence-wall.module.css'

const Scene = dynamic(() => import('./evidence-wall-scene'), { ssr: false })

export type EvidenceWallData = {
  entityId: string
  title: string
  format: string
  coverAssetId?: string
  characters: Array<{ id: string; title: string; assetId?: string }>
  pages: Array<{ id: string; title: string; blocks: ContentTextBlock[] }>
  notes: Array<{ id: string; title: string; lines: Array<{ label?: string; text: string }> }>
}

/** O que abre no painel de leitura de cada peça (HTML de verdade, legível e clicável). */
export type EvidencePanelKey = 'cover' | `character:${string}` | `page:${string}` | `note:${string}`

type PieceInfo = WallPiece & { panel: EvidencePanelKey }

const storageKey = (entityId: string) => `canon-codex:evidence-wall:${entityId}`

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new window.Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * Parede de evidências em 3D: as peças da evidência pregadas numa parede, com linha vermelha entre
 * elas. Dá para arrastar as peças (a arrumação fica salva neste navegador), mover e aproximar a
 * parede dentro de limites, e clicar numa peça para lê-la. Sem WebGL, mostra `fallback`.
 */
export function EvidenceWall({ data, panels, header, fallback }: { data: EvidenceWallData; panels: Partial<Record<EvidencePanelKey, ReactNode>>; header: ReactNode; fallback: ReactNode }) {
  // Este componente só roda no navegador (evidence-wall-loader.tsx), então dá para ler o ambiente já no início.
  const [supported] = useState(webglAvailable)
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [cursor, setCursor] = useState('')
  const [pieces, setPieces] = useState<PieceInfo[] | null>(null)
  const [layout, setLayout] = useState<WallLayout | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [shown, setShown] = useState(false)

  // As texturas são pintadas depois que as fontes e as imagens chegam, para nada sair em fonte errada.
  useEffect(() => {
    if (!supported) return
    let alive = true
    const created: PieceInfo[] = []
    void (async () => {
      const fonts: WallFonts = { hand: hand.style.fontFamily, type: typewriter.style.fontFamily }
      await Promise.all([document.fonts.load(`40px ${fonts.hand}`), document.fonts.load(`40px ${fonts.type}`), document.fonts.load(`bold 40px ${fonts.type}`)]).catch(() => undefined)
      const cover = data.coverAssetId ? await loadImage(assetVariantUrl(data.coverAssetId, 'original')) : null
      const portraits = await Promise.all(data.characters.map((character) => character.assetId ? loadImage(assetVariantUrl(character.assetId, 'thumbnail')) : Promise.resolve(null)))
      if (!alive) return
      created.push({ id: 'cover', kind: 'cover', label: data.title, panel: 'cover', texture: paintPolaroid(cover, data.format, fonts, data.entityId) })
      data.characters.forEach((character, i) => created.push({
        id: `character:${character.id}`, kind: 'character', label: character.title, panel: `character:${character.id}`,
        texture: paintPolaroid(portraits[i], character.title, fonts, character.id, 400, 490),
      }))
      for (const page of data.pages) {
        const sheets = paginateSheet(page.blocks, fonts)
        sheets.forEach((lines, n) => created.push({
          id: `sheet:${page.id}:${n + 1}`, kind: 'sheet', label: sheets.length > 1 ? `${page.title} (folha ${n + 1} de ${sheets.length})` : page.title,
          panel: `page:${page.id}`, texture: paintSheet(page.title, lines, n + 1, sheets.length, fonts, `${page.id}:${n}`),
        }))
      }
      data.notes.forEach((note, i) => created.push({
        id: `note:${note.id}`, kind: 'note', label: note.title, panel: `note:${note.id}`,
        texture: paintNote(note.title, note.lines, NOTE_COLORS[i % NOTE_COLORS.length], fonts),
      }))
      let saved: unknown = null
      try { saved = JSON.parse(window.localStorage.getItem(storageKey(data.entityId)) ?? 'null') } catch { saved = null }
      setLayout(readWallLayout(saved, created))
      setPieces(created)
    })()
    return () => { alive = false; for (const piece of created) piece.texture.dispose() }
  }, [data, supported])

  const refs: WallItemRef[] = useMemo(() => (pieces ?? []).map(({ id, kind }) => ({ id, kind })), [pieces])
  const strings = useMemo(() => wallStrings(refs), [refs])

  const save = useCallback((next: WallLayout) => {
    setLayout(next)
    try { window.localStorage.setItem(storageKey(data.entityId), JSON.stringify(serializeWallLayout(next))) } catch { /* armazenamento indisponível: a arrumação vale só nesta visita */ }
  }, [data.entityId])

  const onDrop = useCallback((id: string, x: number, y: number) => {
    if (!layout) return
    save(bringToFront({ ...layout, [id]: { ...layout[id], x, y } }, id))
  }, [layout, save])
  const reset = () => {
    try { window.localStorage.removeItem(storageKey(data.entityId)) } catch { /* nada a limpar */ }
    setLayout(defaultLayout(refs))
    setFocusId(null)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setFocusId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!supported) return <>{fallback}</>
  const focused = pieces?.find((piece) => piece.id === focusId)

  return (
    <div className={`${styles.room} ${hand.variable} ${typewriter.variable}`}>
      <div className={styles.stage} style={{ cursor }} aria-hidden="true">
        {pieces && layout && <Scene pieces={pieces} layout={layout} strings={strings} focusId={focusId} reduced={reduced} onDrop={onDrop} onSelect={setFocusId} onBackground={() => setFocusId(null)} onShown={() => setShown(true)} onCursor={setCursor}/>}
      </div>
      {!shown && <div className={styles.loading}><span>Iluminando a parede…</span></div>}
      <header className={styles.header}>{header}</header>
      <div className={styles.toolbar}>
        <span className={styles.hint}>Arraste as peças · clique para ler · roda para aproximar</span>
        <button type="button" onClick={reset} title="Voltar à arrumação inicial"><RotateCcw/> Reorganizar</button>
      </div>
      {/* Alternativa acessível: cada peça da parede como um botão que abre a leitura. */}
      <nav className="sr-only" aria-label="Peças da evidência">
        <ul>{(pieces ?? []).map((piece) => <li key={piece.id}><button type="button" onClick={() => setFocusId(piece.id)}>{piece.label}</button></li>)}</ul>
      </nav>
      {focused && (
        <aside className={styles.panel} aria-label={focused.label}>
          <button type="button" className={styles.close} onClick={() => setFocusId(null)} aria-label="Fechar leitura"><X/></button>
          <div className={styles.panelBody}>{panels[focused.panel] ?? <p>Nada para ler nesta peça.</p>}</div>
        </aside>
      )}
    </div>
  )
}
