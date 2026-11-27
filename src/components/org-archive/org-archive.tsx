'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Archive, ArchiveRestore, PackageOpen, X } from 'lucide-react'
import type { ContentTextBlock } from '@/components/editor/content-text'
import { hand, typewriter } from '@/components/codex-notebook/notebook-fonts'
import { paginateSheet, paintSheet, type WallFonts } from '@/components/evidence-wall/wall-textures'
import { bringToFront, readSurfaceLayout, serializeSurfaceLayout, type SurfaceLayout } from '@/domain/canvas/surfaceLayout'
import { ARCHIVE_SIZE, clampToArchive, defaultArchiveLayout, isInBox, spreadPositions, type ArchiveItemKind } from '@/domain/organizations/archiveBox'
import { assetVariantUrl } from '@/lib/assetUrl'
import { GROUP_COLORS, MEMO_TINTS, paintDossier, paintGroupFolder, paintLidInside, paintLidTop, paintMemberCard, paintMemo } from './archive-textures'
import type { ArchivePiece } from './org-archive-scene'
import styles from './org-archive.module.css'

const Scene = dynamic(() => import('./org-archive-scene'), { ssr: false })

export type OrgArchiveData = {
  entityId: string
  title: string
  /** Tipo da organização, para a classificação do dossiê. */
  kind: string
  coverAssetId?: string
  /** Campos preenchidos à mão na etiqueta da tampa. */
  lidFields: Array<{ label: string; value: string }>
  /** Dados datilografados no dossiê. */
  dossierFields: Array<{ label: string; value: string }>
  groups: Array<{ id: string; name: string; description: string; members: string[] }>
  members: Array<{ id: string; name: string; coverAssetId?: string; leader: boolean; groups: string[] }>
  memos: Array<{ id: string; code: string; title: string; text: string }>
  pages: Array<{ id: string; title: string; blocks: ContentTextBlock[] }>
}

/** O que abre no painel de leitura de cada documento (HTML de verdade, legível e clicável). */
export type ArchivePanelKey = 'dossier' | `group:${string}` | `member:${string}` | `memo:${string}` | `page:${string}`

type PieceInfo = ArchivePiece & { panel: ArchivePanelKey }

const storageKey = (entityId: string) => `canon-codex:org-archive:${entityId}`
const HINT_KEY = 'canon-codex:org-archive:hint-closed'
/** Tempo para o papel subir acima da borda antes de sair, e para assentar depois. */
const RAISE_MS = 230
const SETTLE_MS = 650
/** Intervalo entre documentos quando a caixa é esvaziada ou arrumada de uma vez. */
const STAGGER_MS = 110

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

type Painted = { pieces: PieceInfo[]; lid: { top: ReturnType<typeof paintLidTop>; inside: ReturnType<typeof paintLidInside> } }

/**
 * Caixa-arquivo em 3D: a caixa de papelão fechada sobre a mesa guarda o dossiê, as folhas do
 * relatório, as pastas dos subgrupos, as fichas dos membros e os memorandos. Clicar na tampa abre a
 * caixa; clicar num documento dentro dela o tira para a mesa; clicar num documento na mesa abre a
 * leitura. Tudo é arrastável, inclusive de volta para a caixa. Sem WebGL, mostra `fallback`.
 */
export function OrgArchive({ data, panels, header, fallback }: { data: OrgArchiveData; panels: Partial<Record<ArchivePanelKey, ReactNode>>; header: ReactNode; fallback: ReactNode }) {
  // Este componente só roda no navegador (org-archive-loader.tsx), então dá para ler o ambiente já no início.
  const [supported] = useState(webglAvailable)
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [cursor, setCursor] = useState('')
  const [lidHover, setLidHover] = useState(false)
  const [painted, setPainted] = useState<Painted | null>(null)
  const [layout, setLayout] = useState<SurfaceLayout | null>(null)
  const [open, setOpen] = useState(false)
  const [raised, setRaised] = useState<ReadonlySet<string>>(new Set())
  const [selection, setSelection] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const [hintHidden, setHintHidden] = useState(hintClosed)
  const timers = useRef<number[]>([])
  const closeHint = () => {
    setHintHidden(true)
    try { window.localStorage.setItem(HINT_KEY, '1') } catch { /* armazenamento indisponível: fecha só nesta visita */ }
  }

  // As texturas são pintadas depois que as fontes e as fotos chegam, para nada sair em fonte errada.
  useEffect(() => {
    if (!supported) return
    let alive = true
    const disposables: Array<{ dispose: () => void }> = []
    void (async () => {
      const fonts: WallFonts = { hand: hand.style.fontFamily, type: typewriter.style.fontFamily }
      await Promise.all([document.fonts.load(`40px ${fonts.hand}`), document.fonts.load(`40px ${fonts.type}`), document.fonts.load(`bold 40px ${fonts.type}`)]).catch(() => undefined)
      const [cover, ...portraits] = await Promise.all([
        data.coverAssetId ? loadImage(assetVariantUrl(data.coverAssetId, 'original')) : Promise.resolve(null),
        ...data.members.map((member) => member.coverAssetId ? loadImage(assetVariantUrl(member.coverAssetId, 'thumbnail')) : Promise.resolve(null)),
      ])
      if (!alive) return
      const piece = (id: string, kind: ArchiveItemKind, label: string, panel: ArchivePanelKey, paint: ReturnType<typeof paintMemo>): PieceInfo => {
        disposables.push(paint)
        return { id, kind, label, panel, size: ARCHIVE_SIZE[kind], texture: paint, curl: 'paper' }
      }
      const pieces: PieceInfo[] = [piece('dossier', 'dossier', `Dossiê: ${data.title}`, 'dossier', paintDossier(cover, data.title, data.kind, data.dossierFields, fonts))]
      for (const page of data.pages) {
        const sheets = paginateSheet(page.blocks, fonts)
        sheets.forEach((lines, n) => pieces.push(piece(
          `sheet:${page.id}:${n + 1}`, 'sheet', sheets.length > 1 ? `${page.title} (folha ${n + 1} de ${sheets.length})` : page.title, `page:${page.id}`,
          paintSheet(page.title, lines, n + 1, sheets.length, fonts, `${page.id}:${n}`, 'RELATÓRIO INSTITUCIONAL'),
        )))
      }
      data.groups.forEach((group, i) => pieces.push(piece(`group:${group.id}`, 'group', `Subgrupo: ${group.name}`, `group:${group.id}`, paintGroupFolder(group.name, group.description, group.members, GROUP_COLORS[i % GROUP_COLORS.length], fonts))))
      data.members.forEach((member, i) => pieces.push(piece(`member:${member.id}`, 'member', `Membro: ${member.name}`, `member:${member.id}`, paintMemberCard(portraits[i] ?? null, member.name, member.groups, member.leader, fonts))))
      data.memos.forEach((memo, i) => pieces.push(piece(`memo:${memo.id}`, 'memo', memo.title, `memo:${memo.id}`, paintMemo(memo.code, memo.title, memo.text, MEMO_TINTS[i % MEMO_TINTS.length], fonts))))
      const lid = { top: paintLidTop(data.title, data.lidFields, fonts), inside: paintLidInside(pieces.map((item) => item.label), fonts) }
      disposables.push(lid.top, lid.inside)

      let saved: unknown = null
      try { saved = JSON.parse(window.localStorage.getItem(storageKey(data.entityId)) ?? 'null') } catch { saved = null }
      const loaded = readSurfaceLayout(saved, pieces, defaultArchiveLayout(pieces), (item, x, y) => clampToArchive(item.kind, x, y))
      setLayout(loaded)
      // A caixa começa fechada, a menos que algum documento já esteja na mesa.
      setOpen(Object.values(loaded).some((p) => !isInBox(p.x, p.y)))
      setPainted({ pieces, lid })
    })()
    return () => { alive = false; for (const item of disposables) item.dispose() }
  }, [data, supported])

  useEffect(() => () => { for (const timer of timers.current) window.clearTimeout(timer) }, [])
  const later = (ms: number, action: () => void) => { timers.current.push(window.setTimeout(action, reduced ? 0 : ms)) }

  const persist = useCallback((next: SurfaceLayout) => {
    try { window.localStorage.setItem(storageKey(data.entityId), JSON.stringify(serializeSurfaceLayout(next))) } catch { /* armazenamento indisponível: a arrumação vale só nesta visita */ }
  }, [data.entityId])
  const update = useCallback((change: (current: SurfaceLayout) => SurfaceLayout) => {
    setLayout((current) => {
      if (!current) return current
      const next = change(current)
      persist(next)
      return next
    })
  }, [persist])

  /**
   * Move documentos entre a caixa e a mesa: cada um sobe acima da borda, anda até o destino e
   * assenta; vários saem um depois do outro.
   */
  const move = useCallback((targets: Array<{ id: string; x: number; y: number; rotation: number }>) => {
    targets.forEach((target, i) => {
      later(i * STAGGER_MS, () => setRaised((current) => new Set(current).add(target.id)))
      later(i * STAGGER_MS + RAISE_MS, () => update((current) => {
        const placed = { ...current, [target.id]: { ...current[target.id], x: target.x, y: target.y, rotation: target.rotation } }
        return bringToFront(placed, target.id)
      }))
      later(i * STAGGER_MS + RAISE_MS + SETTLE_MS, () => setRaised((current) => { const next = new Set(current); next.delete(target.id); return next }))
    })
  // `later` só agenda timers; não muda entre renderizações de forma que importe.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update, reduced])

  const inBox = useCallback((id: string) => { const p = layout?.[id]; return Boolean(p && isInBox(p.x, p.y)) }, [layout])

  const select = useCallback((id: string) => {
    if (!painted || !layout) return
    if (inBox(id)) {
      const spot = spreadPositions(painted.pieces)[id]
      if (spot) move([{ id, ...spot }])
      return
    }
    setSelection(id)
  }, [inBox, layout, move, painted])

  const onDrop = useCallback((id: string, x: number, y: number) => {
    update((current) => bringToFront({ ...current, [id]: { ...current[id], x, y } }, id))
  }, [update])

  const takeAll = () => {
    if (!painted || !layout) return
    setOpen(true); setSelection(null)
    const spots = spreadPositions(painted.pieces)
    // Sai primeiro o que está por cima da pilha.
    const inside = painted.pieces.filter((item) => inBox(item.id)).sort((a, b) => layout[b.id].order - layout[a.id].order)
    move(inside.map((item) => ({ id: item.id, ...spots[item.id] })))
  }
  const putAll = () => {
    if (!painted || !layout) return
    setOpen(true); setSelection(null)
    const home = defaultArchiveLayout(painted.pieces)
    const outside = painted.pieces.filter((item) => !inBox(item.id)).sort((a, b) => home[a.id].order - home[b.id].order)
    move(outside.map((item) => ({ id: item.id, ...home[item.id] })))
  }
  const toggleLid = () => { setSelection(null); setOpen((current) => !current) }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelection(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!supported) return <>{fallback}</>
  const pieces = painted?.pieces ?? []
  const selected = pieces.find((item) => item.id === selection)
  const anyInside = pieces.some((item) => inBox(item.id))
  const anyOutside = pieces.some((item) => !inBox(item.id))

  return (
    <div className={`${styles.room} ${hand.variable} ${typewriter.variable}`}>
      <div className={styles.stage} style={{ cursor: lidHover && !selection ? 'pointer' : cursor }} aria-hidden="true">
        {painted && layout && <Scene
          pieces={painted.pieces} layout={layout} focusId={selection} reduced={reduced}
          open={open} raisedIds={raised} lid={painted.lid}
          onToggleLid={toggleLid} onLidHover={setLidHover}
          onDrop={onDrop} onSelect={select}
          onBackground={() => setSelection(null)} onShown={() => setShown(true)} onCursor={setCursor}
        />}
      </div>
      {!shown && <div className={styles.loading}><span>Abrindo o arquivo…</span></div>}
      <header className={styles.header}>{header}</header>
      <div className={styles.toolbar}>
        {!hintHidden && <span className={styles.hint}>
          {open ? 'Clique num documento para tirá-lo da caixa · clique de novo para ler · arraste para arrumar' : 'Clique na tampa para abrir a caixa'}
          <button type="button" className={styles.hintClose} onClick={closeHint} aria-label="Fechar o texto guia" title="Fechar o texto guia"><X/></button>
        </span>}
        <button type="button" onClick={toggleLid}>{open ? <><Archive/> Fechar a caixa</> : <><PackageOpen/> Abrir a caixa</>}</button>
        <button type="button" onClick={takeAll} disabled={!anyInside}><PackageOpen/> Tirar tudo</button>
        <button type="button" onClick={putAll} disabled={!anyOutside}><ArchiveRestore/> Guardar tudo</button>
      </div>
      {/* Alternativa acessível: cada documento como um botão que abre a leitura. */}
      <nav className="sr-only" aria-label="Documentos da caixa">
        <ul>{pieces.map((item) => <li key={item.id}><button type="button" onClick={() => setSelection(item.id)}>{item.label}</button></li>)}</ul>
      </nav>
      {selected && (
        <aside className={styles.panel} aria-label={selected.label}>
          <button type="button" className={styles.close} onClick={() => setSelection(null)} aria-label="Fechar leitura"><X/></button>
          <div className={styles.panelBody}>{panels[selected.panel] ?? <p>Nada para ler neste documento.</p>}</div>
        </aside>
      )}
    </div>
  )
}
