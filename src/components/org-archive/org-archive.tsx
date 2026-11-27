'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Archive, ArchiveRestore, PackageOpen, X } from 'lucide-react'
import type { ContentTextBlock } from '@/components/editor/content-text'
import { hand, typewriter } from '@/components/codex-notebook/notebook-fonts'
import { paginateSheet, paintPolaroid, paintSheet, type WallFonts } from '@/components/evidence-wall/wall-textures'
import { bringToFront, readSurfaceLayout, serializeSurfaceLayout, type SurfaceLayout } from '@/domain/canvas/surfaceLayout'
import { ARCHIVE_SIZE, BOX_HOME, LEDGER_PER_PAGE, clampToArchive, defaultArchiveLayout, isInBox, ledgerPages, ledgerSpreadOf, readBoxPosition, spreadPositions, type ArchiveItemKind, type BoxAt } from '@/domain/organizations/archiveBox'
import { assetVariantUrl } from '@/lib/assetUrl'
import { paintAccordion, paintCharter, paintDossier, paintEnvelope, paintLedgerPage, paintLidInside, paintLidTop, type LedgerEntry } from './archive-textures'
import { LedgerPanel, type LedgerMember } from './ledger-panel'
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
  /** Nomes dos subgrupos, para as abas da pasta sanfonada. */
  groups: string[]
  /** Liderança, cada um numa polaroide (com o retrato, quando há). */
  leaders: Array<{ id: string; name: string; coverAssetId?: string }>
  /** Quadro de pessoal para o livro de registro (a liderança vai primeiro). */
  members: Array<{ id: string; name: string; leader: boolean; groups: string[] }>
  /** Artigos do estatuto (objetivos e ideais); sem nenhum, o estatuto não entra na caixa. */
  charter: { founded: string; articles: Array<{ heading: string; text: string }> }
  /** Destinatários dos envelopes do maço de correspondência (relações e citações). */
  addressees: string[]
  pages: Array<{ id: string; title: string; blocks: ContentTextBlock[] }>
}

/** O que abre no painel de leitura de cada documento (HTML de verdade, legível e clicável). */
export type ArchivePanelKey = 'dossier' | 'ledger' | 'accordion' | 'charter' | 'letters' | `page:${string}` | `leader:${string}`

type PieceInfo = ArchivePiece & { panel: ArchivePanelKey }

const storageKey = (entityId: string) => `canon-codex:org-archive:${entityId}`
/** Posição da caixa na mesa, guardada à parte da arrumação dos documentos. */
const boxKey = (entityId: string) => `canon-codex:org-archive:${entityId}:caixa`
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

type Texture = ReturnType<typeof paintLidTop>
type Painted = { pieces: PieceInfo[]; lid: { top: Texture; inside: Texture }; envelopes: Texture[]; fonts: WallFonts }

/**
 * Caixa-arquivo em 3D: a caixa de papelão fechada sobre a mesa guarda o dossiê, as folhas do
 * relatório, o livro de registro dos membros, a pasta sanfonada dos subgrupos, o estatuto e o maço de
 * correspondência; cada um é um objeto só, qualquer que seja o tamanho da organização. Clicar na tampa abre a
 * caixa; clicar num documento dentro dela o tira para a mesa; clicar num documento na mesa abre a
 * leitura. Tudo é arrastável, inclusive de volta para a caixa. Sem WebGL, mostra `fallback`.
 */
export function OrgArchive({ data, panels, header, fallback }: { data: OrgArchiveData; panels: Partial<Record<ArchivePanelKey, ReactNode>>; header: ReactNode; fallback: ReactNode }) {
  // Este componente só roda no navegador (org-archive-loader.tsx), então dá para ler o ambiente já no início.
  const [supported] = useState(webglAvailable)
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [cursor, setCursor] = useState('')
  const [boxHover, setBoxHover] = useState(false)
  const [box, setBox] = useState<BoxAt>(BOX_HOME)
  const [carried, setCarried] = useState<ReadonlySet<string>>(new Set())
  const [boxDragging, setBoxDragging] = useState(false)
  // Posição da caixa e arrumação atuais para os eventos do arraste (que chegam entre renderizações).
  const boxRef = useRef<BoxAt>(BOX_HOME)
  const layoutRef = useRef<SurfaceLayout | null>(null)
  const carryingRef = useRef(false)
  const [painted, setPainted] = useState<Painted | null>(null)
  const [layout, setLayout] = useState<SurfaceLayout | null>(null)
  const [open, setOpen] = useState(false)
  const [raised, setRaised] = useState<ReadonlySet<string>>(new Set())
  const [selection, setSelection] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const [hintHidden, setHintHidden] = useState(hintClosed)
  const [spread, setSpread] = useState(0)
  const timers = useRef<number[]>([])
  const ledgerCache = useRef(new Map<number, Texture>())

  // Livro de registro: páginas com a liderança primeiro e a abertura em que cada membro aparece.
  const ledger = useMemo(() => {
    const { pages, spreads } = ledgerPages(data.members)
    const ordered = pages.slice(1).flat()
    const members: LedgerMember[] = ordered.map((member, i) => ({ ...member, number: i + 1, spread: ledgerSpreadOf(i) }))
    const entries: LedgerEntry[][] = pages.map((page, p) => page.map((member, i) => ({ ...member, number: (p - 1) * LEDGER_PER_PAGE + i + 1 })))
    return { entries, spreads, members }
  }, [data.members])
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
        ...data.leaders.map((leader) => leader.coverAssetId ? loadImage(assetVariantUrl(leader.coverAssetId, 'original')) : Promise.resolve(null)),
      ])
      if (!alive) return
      const piece = (id: string, kind: ArchiveItemKind, label: string, panel: ArchivePanelKey, paint?: Texture): PieceInfo => {
        if (paint) disposables.push(paint)
        // O livro aberto é largo: a câmera recua mais para ele caber inteiro ao lado da leitura.
        return { id, kind, label, panel, size: ARCHIVE_SIZE[kind], texture: paint, curl: 'paper', ...(kind === 'ledger' ? { focusHeight: 1.6 } : {}) }
      }
      const pieces: PieceInfo[] = [piece('dossier', 'dossier', `Dossiê: ${data.title}`, 'dossier', paintDossier(cover, data.title, data.kind, data.dossierFields, fonts))]
      for (const page of data.pages) {
        const sheets = paginateSheet(page.blocks, fonts)
        sheets.forEach((lines, n) => pieces.push(piece(
          `sheet:${page.id}:${n + 1}`, 'sheet', sheets.length > 1 ? `${page.title} (folha ${n + 1} de ${sheets.length})` : page.title, `page:${page.id}`,
          paintSheet(page.title, lines, n + 1, sheets.length, fonts, `${page.id}:${n}`, 'RELATÓRIO INSTITUCIONAL'),
        )))
      }
      data.leaders.forEach((leader, i) => pieces.push(piece(`leader:${leader.id}`, 'polaroid', `Liderança: ${leader.name}`, `leader:${leader.id}`, paintPolaroid(portraits[i] ?? null, leader.name, fonts, leader.id))))
      pieces.push(piece('ledger', 'ledger', `Livro de registro (${data.members.length} membro${data.members.length === 1 ? '' : 's'})`, 'ledger'))
      if (data.groups.length) pieces.push(piece('accordion', 'accordion', `Subgrupos (${data.groups.length})`, 'accordion', paintAccordion(data.groups, data.title, fonts)))
      if (data.charter.articles.length) pieces.push(piece('charter', 'charter', 'Estatuto', 'charter', paintCharter(data.title, data.charter.founded, data.charter.articles, fonts)))
      const addressees = data.addressees.length ? data.addressees : ['sem correspondência']
      const envelopes = addressees.slice(0, 5).map((name, i) => paintEnvelope(name, fonts, `${data.entityId}:${i}`))
      disposables.push(...envelopes)
      pieces.push(piece('letters', 'letters', 'Correspondência', 'letters'))
      const lid = { top: paintLidTop(data.title, data.lidFields, fonts), inside: paintLidInside(pieces.map((item) => item.label), fonts) }
      disposables.push(lid.top, lid.inside)

      let saved: unknown = null
      let savedBox: unknown = null
      try {
        saved = JSON.parse(window.localStorage.getItem(storageKey(data.entityId)) ?? 'null')
        savedBox = JSON.parse(window.localStorage.getItem(boxKey(data.entityId)) ?? 'null')
      } catch { saved = null }
      const at = readBoxPosition(savedBox)
      const loaded = readSurfaceLayout(saved, pieces, defaultArchiveLayout(pieces, at), (item, x, y) => clampToArchive(item.kind, x, y, at))
      setBox(at)
      boxRef.current = at
      setLayout(loaded)
      // A caixa começa fechada, a menos que algum documento já esteja na mesa.
      setOpen(Object.values(loaded).some((p) => !isInBox(p.x, p.y, at)))
      setPainted({ pieces, lid, envelopes, fonts })
    })()
    return () => { alive = false; for (const item of disposables) item.dispose() }
  }, [data, supported])

  useEffect(() => () => { for (const timer of timers.current) window.clearTimeout(timer) }, [])

  // Páginas do livro pintadas só quando aparecem (uma organização pode ter centenas de membros).
  const ledgerPage = useCallback((page: number) => {
    const cache = ledgerCache.current
    let painting = cache.get(page)
    if (!painting && painted) {
      painting = paintLedgerPage(ledger.entries[page] ?? [], page, ledger.entries.length, data.title, painted.fonts)
      cache.set(page, painting)
    }
    return painting ?? painted!.lid.inside
  }, [data.title, ledger, painted])
  useEffect(() => {
    const cache = ledgerCache.current
    return () => { for (const painting of cache.values()) painting.dispose(); cache.clear() }
  }, [ledger, painted])
  const later = (ms: number, action: () => void) => { timers.current.push(window.setTimeout(action, reduced ? 0 : ms)) }

  useEffect(() => { layoutRef.current = layout }, [layout])

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

  const inBox = useCallback((id: string) => { const p = layout?.[id]; return Boolean(p && isInBox(p.x, p.y, box)) }, [box, layout])

  const select = useCallback((id: string) => {
    if (!painted || !layout) return
    if (inBox(id)) {
      const spot = spreadPositions(painted.pieces, box)[id]
      if (spot) move([{ id, ...spot }])
      return
    }
    setSelection(id)
  }, [box, inBox, layout, move, painted])

  const onDrop = useCallback((id: string, x: number, y: number) => {
    update((current) => bringToFront({ ...current, [id]: { ...current[id], x, y } }, id))
  }, [update])

  const takeAll = () => {
    if (!painted || !layout) return
    setOpen(true); setSelection(null)
    const spots = spreadPositions(painted.pieces, box)
    // Sai primeiro o que está por cima da pilha.
    const inside = painted.pieces.filter((item) => inBox(item.id)).sort((a, b) => layout[b.id].order - layout[a.id].order)
    move(inside.map((item) => ({ id: item.id, ...spots[item.id] })))
  }
  const putAll = () => {
    if (!painted || !layout) return
    setOpen(true); setSelection(null)
    const home = defaultArchiveLayout(painted.pieces, box)
    const outside = painted.pieces.filter((item) => !inBox(item.id)).sort((a, b) => home[a.id].order - home[b.id].order)
    move(outside.map((item) => ({ id: item.id, ...home[item.id] })))
  }
  /**
   * Arraste da caixa: o que está dentro vai junto, sem atraso (para não atravessar as paredes); ao
   * soltar, os documentos da mesa que ficaram embaixo dela são empurrados para o lado.
   */
  const moveBox = useCallback((at: BoxAt) => {
    const previous = boxRef.current
    const dx = at.x - previous.x, dy = at.y - previous.y
    if (!dx && !dy) return
    boxRef.current = at
    setBoxDragging(true); setSelection(null)
    setBox(at)
    // Atualizações puras (o React pode repetir a função em desenvolvimento): mover só o que estava dentro.
    setLayout((current) => {
      if (!current) return current
      const next = { ...current }
      for (const [id, p] of Object.entries(current)) if (isInBox(p.x, p.y, previous)) next[id] = { ...p, x: p.x + dx, y: p.y + dy }
      return next
    })
    if (!carryingRef.current) {
      carryingRef.current = true
      setCarried(new Set(Object.entries(layoutRef.current ?? {}).filter(([, p]) => isInBox(p.x, p.y, previous)).map(([id]) => id)))
    }
  }, [])
  const dropBox = useCallback((at: BoxAt) => {
    carryingRef.current = false
    setBoxDragging(false); setCarried(new Set())
    try { window.localStorage.setItem(boxKey(data.entityId), JSON.stringify(at)) } catch { /* armazenamento indisponível: a posição vale só nesta visita */ }
    if (!painted) return
    const kinds = new Map(painted.pieces.map((item) => [item.id, item.kind]))
    update((current) => {
      const next = { ...current }
      for (const [id, p] of Object.entries(current)) {
        const kind = kinds.get(id)
        if (!kind || isInBox(p.x, p.y, at)) continue
        next[id] = { ...p, ...clampToArchive(kind, p.x, p.y, at, true) }
      }
      return next
    })
  }, [data.entityId, painted, update])

  const toggleLid = () => { setSelection(null); setOpen((current) => !current) }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelection(null)
      // Com o livro em leitura, as setas viram as páginas (fora de campos de texto).
      if (selection !== 'ledger' || event.target instanceof HTMLInputElement) return
      if (event.key === 'ArrowRight') setSpread((current) => Math.min(ledger.spreads - 1, current + 1))
      if (event.key === 'ArrowLeft') setSpread((current) => Math.max(0, current - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ledger.spreads, selection])

  if (!supported) return <>{fallback}</>
  const pieces = painted?.pieces ?? []
  const selected = pieces.find((item) => item.id === selection)
  const anyInside = pieces.some((item) => inBox(item.id))
  const anyOutside = pieces.some((item) => !inBox(item.id))

  return (
    <div className={`${styles.room} ${hand.variable} ${typewriter.variable}`}>
      <div className={styles.stage} style={{ cursor: boxDragging ? 'grabbing' : boxHover && !selection ? 'grab' : cursor }} aria-hidden="true">
        {painted && layout && <Scene
          pieces={painted.pieces} layout={layout} focusId={selection} reduced={reduced}
          open={open} raisedIds={raised} carriedIds={carried} box={box} lid={painted.lid}
          ledgerSpread={spread} ledgerPage={ledgerPage} envelopes={painted.envelopes}
          onToggleLid={toggleLid} onBoxHover={setBoxHover} onBoxMove={moveBox} onBoxDrop={dropBox}
          onDrop={onDrop} onSelect={select}
          onBackground={() => setSelection(null)} onShown={() => setShown(true)} onCursor={setCursor}
        />}
      </div>
      {!shown && <div className={styles.loading}><span>Abrindo o arquivo…</span></div>}
      <header className={styles.header}>{header}</header>
      <div className={styles.toolbar}>
        {!hintHidden && <span className={styles.hint}>
          {open ? 'Clique num documento para tirá-lo da caixa · clique de novo para ler · arraste documentos ou a própria caixa' : 'Clique na tampa para abrir a caixa · arraste a caixa para mudá-la de lugar'}
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
          <div className={styles.panelBody}>
            {selected.panel === 'ledger'
              ? <LedgerPanel title={data.title} members={ledger.members} spread={spread} spreads={ledger.spreads} onSpread={setSpread}/>
              : panels[selected.panel] ?? <p>Nada para ler neste documento.</p>}
          </div>
        </aside>
      )}
    </div>
  )
}
