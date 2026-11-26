'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { RotateCcw, X } from 'lucide-react'
import type { ContentTextBlock } from '@/components/editor/content-text'
import { hand, typewriter } from '@/components/codex-notebook/notebook-fonts'
import { NOTE_COLORS, canvas, paginateSheet, paintNote, paintSheet, texture, type WallFonts } from '@/components/evidence-wall/wall-textures'
import { bringToFront, readSurfaceLayout, serializeSurfaceLayout, type SurfaceLayout } from '@/domain/canvas/surfaceLayout'
import { BENCH_SIZE, caliperReading, clampToBench, defaultBenchLayout, type BenchItemKind } from '@/domain/objects/objectBench'
import { assetVariantUrl } from '@/lib/assetUrl'
import { paintLabel, paintLcd, paintSpecimen } from './bench-textures'
import type { BenchDetail, BenchPiece } from './object-bench-scene'
import styles from './object-bench.module.css'

const Scene = dynamic(() => import('./object-bench-scene'), { ssr: false })

export type ObjectBenchData = {
  entityId: string
  title: string
  /** Legenda da prancha (o tipo do objeto, quando há). */
  figure: string
  coverAssetId?: string
  dimensions: string
  details: Array<{ id: string; label: string; x: number; y: number }>
  notes: Array<{ id: string; title: string; lines: Array<{ label?: string; text: string }> }>
  labels: Array<{ id: string; title: string; lines: string[] }>
  pages: Array<{ id: string; title: string; blocks: ContentTextBlock[] }>
}

/** O que abre no painel de leitura de cada peça (HTML de verdade, legível e clicável). */
export type ObjectPanelKey = 'specimen' | 'caliper' | 'loupe' | `note:${string}` | `label:${string}` | `page:${string}` | `detail:${string}`

type PieceInfo = BenchPiece & { panel: ObjectPanelKey }
type Selection = { pieceId: string; panel: ObjectPanelKey }

const storageKey = (entityId: string) => `canon-codex:object-bench:${entityId}`
/** O texto guia vale para todas as bancadas: fechado uma vez, não volta neste navegador. */
const HINT_KEY = 'canon-codex:object-bench:hint-closed'

function hintClosed() {
  try { return window.localStorage.getItem(HINT_KEY) === '1' } catch { return false }
}

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
    const element = document.createElement('canvas')
    return Boolean(element.getContext('webgl2') ?? element.getContext('webgl'))
  } catch {
    return false
  }
}

/** Adesivo amarelo numerado dos pontos de detalhe. */
function paintSticker(index: number, fonts: WallFonts) {
  const { element, c } = canvas(128, 128)
  c.fillStyle = '#e8c547'
  c.beginPath(); c.arc(64, 64, 60, 0, Math.PI * 2); c.fill()
  c.strokeStyle = '#1f1d1a'; c.lineWidth = 5
  c.beginPath(); c.arc(64, 64, 56, 0, Math.PI * 2); c.stroke()
  c.fillStyle = '#1f1d1a'
  c.font = `bold 64px ${fonts.type}`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(String(index), 64, 68)
  return texture(element)
}

type Painted = {
  pieces: PieceInfo[]
  details: BenchDetail[]
  caliperDisplay: { idle: ReturnType<typeof texture>; reading: ReturnType<typeof texture> }
}

/**
 * Bancada de estudo em 3D: a foto técnica do objeto num tapete de corte, com ferramentas para
 * estudá-lo (o paquímetro mede as dimensões, a lupa revela os detalhes marcados), notas, etiquetas e o
 * relatório. Peças e ferramentas são arrastáveis (a arrumação fica salva neste navegador) e clicar
 * numa peça abre a leitura. Sem WebGL, mostra `fallback`.
 */
export function ObjectBench({ data, panels, header, fallback }: { data: ObjectBenchData; panels: Partial<Record<ObjectPanelKey, ReactNode>>; header: ReactNode; fallback: ReactNode }) {
  // Este componente só roda no navegador (object-bench-loader.tsx), então dá para ler o ambiente já no início.
  const [supported] = useState(webglAvailable)
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [cursor, setCursor] = useState('')
  const [painted, setPainted] = useState<Painted | null>(null)
  const [layout, setLayout] = useState<SurfaceLayout | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [shown, setShown] = useState(false)
  const [hintHidden, setHintHidden] = useState(hintClosed)
  const closeHint = () => {
    setHintHidden(true)
    try { window.localStorage.setItem(HINT_KEY, '1') } catch { /* armazenamento indisponível: fecha só nesta visita */ }
  }

  // As texturas são pintadas depois que as fontes e a foto chegam, para nada sair em fonte errada.
  useEffect(() => {
    if (!supported) return
    let alive = true
    const disposables: Array<{ dispose: () => void }> = []
    void (async () => {
      const fonts: WallFonts = { hand: hand.style.fontFamily, type: typewriter.style.fontFamily }
      await Promise.all([document.fonts.load(`40px ${fonts.hand}`), document.fonts.load(`40px ${fonts.type}`), document.fonts.load(`bold 40px ${fonts.type}`)]).catch(() => undefined)
      const photo = data.coverAssetId ? await loadImage(assetVariantUrl(data.coverAssetId, 'original')) : null
      if (!alive) return
      const piece = (id: string, kind: BenchItemKind, label: string, panel: ObjectPanelKey, extra: Partial<PieceInfo> = {}): PieceInfo => {
        if (extra.texture) disposables.push(extra.texture)
        return { id, kind, label, panel, size: BENCH_SIZE[kind], ...extra }
      }
      const pieces: PieceInfo[] = [
        piece('specimen', 'specimen', data.title, 'specimen', { texture: paintSpecimen(photo, data.title, data.figure, fonts), roughness: 0.6, curl: 'paper' }),
        piece('caliper', 'caliper', 'Paquímetro: dimensões', 'caliper', { focusHeight: 1.1 }),
        piece('loupe', 'loupe', 'Lupa: detalhes', 'loupe', { focusHeight: 1.1 }),
      ]
      data.notes.forEach((note, i) => pieces.push(piece(`note:${note.id}`, 'note', note.title, `note:${note.id}`, { texture: paintNote(note.title, note.lines, NOTE_COLORS[i % NOTE_COLORS.length], fonts), curl: 'note' })))
      data.labels.forEach((label) => pieces.push(piece(`label:${label.id}`, 'label', label.title, `label:${label.id}`, { texture: paintLabel(label.title, label.lines, fonts), curl: 'none', roughness: 0.8 })))
      for (const page of data.pages) {
        const sheets = paginateSheet(page.blocks, fonts)
        sheets.forEach((lines, n) => pieces.push(piece(
          `sheet:${page.id}:${n + 1}`, 'sheet', sheets.length > 1 ? `${page.title} (folha ${n + 1} de ${sheets.length})` : page.title, `page:${page.id}`,
          { texture: paintSheet(page.title, lines, n + 1, sheets.length, fonts, `${page.id}:${n}`, 'RELATÓRIO DE CONSERVAÇÃO') },
        )))
      }
      const details = data.details.map((detail, i) => {
        const sticker = paintSticker(i + 1, fonts)
        disposables.push(sticker)
        return { id: detail.id, index: i + 1, x: detail.x, y: detail.y, texture: sticker }
      })
      const reading = caliperReading(data.dimensions)
      const caliperDisplay = { idle: paintLcd('0,00', reading?.unit ?? 'mm'), reading: paintLcd(reading?.value ?? '- - -', reading?.unit ?? '') }
      disposables.push(caliperDisplay.idle, caliperDisplay.reading)

      let saved: unknown = null
      try { saved = JSON.parse(window.localStorage.getItem(storageKey(data.entityId)) ?? 'null') } catch { saved = null }
      setLayout(readSurfaceLayout(saved, pieces, defaultBenchLayout(pieces), (item, x, y) => clampToBench(item.kind, x, y)))
      setPainted({ pieces, details, caliperDisplay })
    })()
    return () => { alive = false; for (const item of disposables) item.dispose() }
  }, [data, supported])

  const save = useCallback((next: SurfaceLayout) => {
    setLayout(next)
    try { window.localStorage.setItem(storageKey(data.entityId), JSON.stringify(serializeSurfaceLayout(next))) } catch { /* armazenamento indisponível: a arrumação vale só nesta visita */ }
  }, [data.entityId])

  const onDrop = useCallback((id: string, x: number, y: number) => {
    if (!layout) return
    save(bringToFront({ ...layout, [id]: { ...layout[id], x, y } }, id))
  }, [layout, save])
  const select = useCallback((id: string) => {
    const piece = painted?.pieces.find((item) => item.id === id)
    if (piece) setSelection({ pieceId: id, panel: piece.panel })
  }, [painted])
  const reset = () => {
    try { window.localStorage.removeItem(storageKey(data.entityId)) } catch { /* nada a limpar */ }
    if (painted) setLayout(defaultBenchLayout(painted.pieces))
    setSelection(null)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelection(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!supported) return <>{fallback}</>
  const pieces = painted?.pieces ?? []
  const focusedLabel = selection?.panel.startsWith('detail:')
    ? data.details.find((detail) => `detail:${detail.id}` === selection.panel)?.label
    : pieces.find((piece) => piece.id === selection?.pieceId)?.label

  return (
    <div className={`${styles.room} ${hand.variable} ${typewriter.variable}`}>
      <div className={styles.stage} style={{ cursor }} aria-hidden="true">
        {painted && layout && <Scene
          pieces={painted.pieces} layout={layout} focusId={selection?.pieceId ?? null} reduced={reduced}
          details={painted.details} caliperDisplay={painted.caliperDisplay}
          onDrop={onDrop} onSelect={select} onDetail={(id) => setSelection({ pieceId: 'specimen', panel: `detail:${id}` })}
          onBackground={() => setSelection(null)} onShown={() => setShown(true)} onCursor={setCursor}
        />}
      </div>
      {!shown && <div className={styles.loading}><span>Acendendo a bancada…</span></div>}
      <header className={styles.header}>{header}</header>
      <div className={styles.toolbar}>
        {!hintHidden && <span className={styles.hint}>
          Leve o paquímetro ou a lupa até o objeto · clique para ler · roda para aproximar
          <button type="button" className={styles.hintClose} onClick={closeHint} aria-label="Fechar o texto guia" title="Fechar o texto guia"><X/></button>
        </span>}
        <button type="button" onClick={reset} title="Voltar à arrumação inicial"><RotateCcw/> Reorganizar</button>
      </div>
      {/* Alternativa acessível: cada peça da bancada como um botão que abre a leitura. */}
      <nav className="sr-only" aria-label="Peças da bancada">
        <ul>
          {pieces.map((piece) => <li key={piece.id}><button type="button" onClick={() => select(piece.id)}>{piece.label}</button></li>)}
          {data.details.map((detail, i) => <li key={detail.id}><button type="button" onClick={() => setSelection({ pieceId: 'specimen', panel: `detail:${detail.id}` })}>{`Detalhe ${i + 1}: ${detail.label}`}</button></li>)}
        </ul>
      </nav>
      {selection && (
        <aside className={styles.panel} aria-label={focusedLabel ?? 'Leitura'}>
          <button type="button" className={styles.close} onClick={() => setSelection(null)} aria-label="Fechar leitura"><X/></button>
          <div className={styles.panelBody}>{panels[selection.panel] ?? <p>Nada para ler nesta peça.</p>}</div>
        </aside>
      )}
    </div>
  )
}
