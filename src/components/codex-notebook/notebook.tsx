'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Texture } from 'three'
import { useRecordReveal } from '@/components/record-reveal/record-reveal'
import { buildSpreads, formatRecordCount, spreadIndexFromParam, type NotebookType } from './notebook-contents'
import { IndexCard, renderSpread, type NotebookWorld, type SpreadPages } from './notebook-pages'
import { CANCEL_SPRING, COMMIT_SPRING, DRAG_FOLLOW, dragProgress, shouldComplete, springStep } from './page-turn'
import { PageTextures } from './page-textures'
import { readNotebookPalette, type NotebookPalette } from './book-textures'
import { INDEX_PX, type OverlayTargets, type SceneMotion } from './book-scene'
import styles from './notebook.module.css'

/** three.js only runs in the browser. */
const BookScene = dynamic(() => import('./book-scene'), { ssr: false })

import { hand, typewriter } from './notebook-fonts'
import { NotebookLoading } from './notebook-loading'

/** Pages are composed on a fixed 600 × 820 sheet; the 3D page and its HTML overlay share that size. */
export const PAGE_W = 600
export const PAGE_H = 820
/** Movement under this many pixels is a tap, not a drag. */
const TAP_SLOP = 4
/** Seconds the opening (and closing) of the notebook takes. */
const OPEN_SECONDS = 1.7
/**
 * Session key holding the spread a reader left from by following a link inside the notebook, so
 * coming back (the browser's back button) reopens it there. The URL is not used for this: changing
 * its query re-mounted the whole page, which flashed the notebook after every turn.
 */
const RETURN_KEY = 'canon-codex-notebook-return'

type Phase = 'closed' | 'opening' | 'open' | 'closing'

interface Turn {
  from: number
  to: number
  /** next: the leaf travels right → left (progress 0 → 1); prev: left → right (1 → 0). */
  dir: 'next' | 'prev'
  /** auto: animated by the spring from the start; drag: follows the pointer until released. */
  mode: 'auto' | 'drag'
}

interface Drag {
  id: number
  startX: number
  startY: number
  /** What the press landed on: one of the pages, or the desk around the book. */
  region: 'left' | 'right' | 'outside'
  started: boolean
  /** The spread the drag turns to, while its pictures are still being taken (the leaf waits). */
  waitingFor?: number
  turned: number
  speed: number
  lastT: number
}

export interface NotebookProps {
  /** Mantém os tipos na ordem recebida (a ordem escolhida nas configurações do mundo). */
  keepTypeOrder?: boolean
  world: NotebookWorld
  types: NotebookType[]
  /** Spread id from `?pagina=`, to reopen where the reader was. */
  initialSpread?: string
}

const pageKey = (id: string, side: 'left' | 'right') => `${id}:${side}`

/** The spread saved by `rememberSpread`, if it belongs to this world; -1 (the cover) otherwise. */
function savedSpread(spreads: { id: string }[], worldName: string): number {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(RETURN_KEY) ?? 'null') as { world?: string; spread?: string } | null
    if (!saved || saved.world !== worldName) return -1
    return spreads.findIndex((spread) => spread.id === saved.spread)
  } catch {
    return -1
  }
}

/** Adds a picture and drops the ones the cache has released (each holds a large canvas). */
function withPicture(all: Record<string, Texture>, key: string, texture: Texture, pictures: PageTextures): Record<string, Texture> {
  const live = Object.fromEntries(Object.entries(all).filter(([held, value]) => pictures.get(held) === value))
  return { ...live, [key]: texture }
}

/** The four pages a turn shows: the two beneath the leaf and the leaf's two faces. */
function turnKeys(spreads: { id: string }[], turn: { from: number; to: number }): string[] {
  const from = spreads[turn.from].id
  const to = spreads[turn.to].id
  return [pageKey(from, 'left'), pageKey(from, 'right'), pageKey(to, 'left'), pageKey(to, 'right')]
}

export function Notebook({ world, types, initialSpread, keepTypeOrder = false }: NotebookProps) {
  const spreads = useMemo(() => buildSpreads(types, keepTypeOrder), [keepTypeOrder, types])
  const reveal = useRecordReveal()
  // The notebook renders only in the browser (see notebook-loader), so the first state can read the
  // spread saved when the reader followed a link out of it.
  const [initialIndex] = useState(() => {
    const fromUrl = spreadIndexFromParam(spreads, initialSpread)
    return fromUrl !== -1 ? fromUrl : savedSpread(spreads, world.name)
  })
  const [index, setIndex] = useState(initialIndex)
  const [phase, setPhase] = useState<Phase>(initialIndex === -1 ? 'closed' : 'open')
  const [turn, setTurn] = useState<Turn | null>(null)
  /** A turn asked for while its pages' pictures are still being taken; it starts once they are ready. */
  const [queuedTurn, setQueuedTurn] = useState<Turn | null>(null)
  const [reduced, setReduced] = useState(false)
  const [palette, setPalette] = useState<NotebookPalette | null>(null)
  const [fonts, setFonts] = useState<{ serif: string; type: string } | null>(null)
  const [textures, setTextures] = useState<Record<string, Texture>>({})
  const [pictures] = useState(() => new PageTextures())
  /** The 3D scene has drawn its first frames. */
  const [sceneShown, setSceneShown] = useState(false)
  /** The loading screen never stays longer than this, whatever is still missing. */
  const [loadingTimedOut, setLoadingTimedOut] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setLoadingTimedOut(true), 8000)
    return () => window.clearTimeout(timer)
  }, [])

  const stage = useRef<HTMLDivElement>(null)
  const overlays = useRef<OverlayTargets>({ left: null, right: null, index: null })
  const motion = useRef<SceneMotion & {
    velocity: number
    /** Where a dragged leaf is heading; the leaf eases toward it, which gives the paper weight. */
    dragGoal: number
    target: number | null
    spring: typeof COMMIT_SPRING
    openTarget: number | null
    drag: Drag | null
    finish: null | (() => void)
    started: Turn | null
  }>({ progress: 0, open: initialIndex === -1 ? 0 : 1, velocity: 0, dragGoal: 0, target: null, spring: COMMIT_SPRING, openTarget: null, drag: null, finish: null, started: null })

  const openBook = useCallback((target = 0) => {
    if (phase !== 'closed') return
    setIndex(Math.max(0, target))
    setPhase(reduced ? 'open' : 'opening')
  }, [phase, reduced])

  const closeBook = useCallback(() => {
    if (phase !== 'open' || turn) return
    if (reduced) setIndex(-1)
    setPhase(reduced ? 'closed' : 'closing')
  }, [phase, reduced, turn])

  const turnTo = useCallback((target: number) => {
    if (target === -1) return closeBook()
    if (phase !== 'open' || turn || queuedTurn || target === index || target < 0 || target >= spreads.length) return
    if (reduced) {
      setIndex(target)
      return
    }
    setQueuedTurn({ from: index, to: target, dir: target > index ? 'next' : 'prev', mode: 'auto' })
  }, [closeBook, index, phase, queuedTurn, reduced, spreads.length, turn])

  const pagesOf = useCallback((at: number): SpreadPages => at < 0
    ? { left: null, right: null }
    : renderSpread(spreads[at], at, world, spreads, turnTo), [spreads, world, turnTo])

  // While a leaf turns, the pages under it are the destination's on one side and the origin's on the other.
  const current = pagesOf(index)
  const underKeys = turn
    ? { left: pageKey(spreads[turn.dir === 'next' ? turn.from : turn.to].id, 'left'), right: pageKey(spreads[turn.dir === 'next' ? turn.to : turn.from].id, 'right') }
    : index >= 0 ? { left: pageKey(spreads[index].id, 'left'), right: pageKey(spreads[index].id, 'right') } : null
  const leafKeys = turn
    ? { front: pageKey(spreads[turn.dir === 'next' ? turn.from : turn.to].id, 'right'), back: pageKey(spreads[turn.dir === 'next' ? turn.to : turn.from].id, 'left') }
    : null

  // Pages that need a picture ready: the open spread and its neighbours, plus the index card.
  const wanted = useMemo(() => {
    const around = index < 0 ? [0, 1] : [index - 2, index - 1, index, index + 1, index + 2]
    if (queuedTurn) around.push(queuedTurn.to)
    return [...new Set(around)].filter((at) => at >= 0 && at < spreads.length)
  }, [index, queuedTurn, spreads.length])

  // Pictures are taken one at a time, while the browser is idle and no page is moving: taking them
  // all at once right after a turn made the next drag stutter.
  const elements = useRef(new Map<string, HTMLElement>())
  /**
   * Pictures are taken at the page's own size (one pixel per CSS pixel of the 600 × 820 sheet). In
   * Firefox a picture's cost grows with its pixels, and sharper pictures could not keep up with a
   * reader turning page after page; the pages are shown at about that size anyway.
   */
  const pictureScale = useCallback(() => 1, [])
  /** Paper colour drawn behind every picture, so none can come out transparent (black on screen). */
  const paperColor = useCallback(() => (stage.current ? getComputedStyle(stage.current).getPropertyValue('--nb-paper').trim() : '') || 'white', [])
  /** Takes any missing pictures right away and resolves when they are ready (or after 3 s at most). */
  const ensure = useCallback((keys: string[]) => {
    const jobs = keys.flatMap((key) => {
      if (pictures.get(key)) return []
      const element = elements.current.get(key)
      if (!element?.isConnected) return []
      return [pictures.capture(key, element, pictureScale(), paperColor()).then((texture) => {
        if (texture) setTextures((all) => withPicture(all, key, texture, pictures))
      })]
    })
    if (jobs.length === 0) return Promise.resolve()
    return Promise.race([Promise.all(jobs), new Promise((done) => window.setTimeout(done, 3000))])
  }, [paperColor, pictureScale, pictures])

  const queue = useRef<CaptureQueue | null>(null)
  const capture = useCallback((key: string, element: HTMLElement) => {
    elements.current.set(key, element)
    queue.current ??= new CaptureQueue(
      pictures,
      (ready, texture) => setTextures((all) => withPicture(all, ready, texture, pictures)),
      () => {
        const m = motion.current
        return Boolean(m.drag?.started) || m.target !== null || m.openTarget !== null
      },
      pictureScale,
      paperColor,
    )
    queue.current.add(key, element)
  }, [paperColor, pictureScale, pictures])

  // Pictures of spreads that are no longer near the open one are freed: kept forever, they filled
  // the GPU's memory after a few turns and the browser dropped the whole 3D scene (a black book).
  useEffect(() => {
    const keep = new Set(['index', ...wanted.flatMap((at) => [pageKey(spreads[at].id, 'left'), pageKey(spreads[at].id, 'right')])])
    for (const key of pictures.retain(keep)) elements.current.delete(key)
    // Nearest first: the open spread, then the next and previous ones, then the two beyond.
    const nearest = index < 0 ? [0, 1] : [index, index + 1, index - 1, index + 2, index - 2]
    const order = nearest.filter((at) => wanted.includes(at)).flatMap((at) => [pageKey(spreads[at].id, 'left'), pageKey(spreads[at].id, 'right')])
    queue.current?.prioritize([...order.slice(0, 2), 'index', ...order.slice(2)])
  }, [index, pictures, spreads, wanted])

  /** A picture, only while it is still held by the cache (a released one has been freed). */
  const picture = (key: string | undefined) => {
    const texture = key ? textures[key] : undefined
    return texture && pictures.get(key!) === texture ? texture : null
  }

  // A turn starts only when the four pages it shows have their pictures, so no page moves blank.
  useEffect(() => {
    if (!queuedTurn) return
    let alive = true
    void ensure(turnKeys(spreads, queuedTurn)).then(() => {
      if (!alive) return
      setQueuedTurn(null)
      setTurn(queuedTurn)
    })
    return () => { alive = false }
  }, [ensure, queuedTurn, spreads])

  // The opening animation follows the phase: the loop below moves `open` toward its target. Opening
  // waits for the first spread's pictures, since the cover reveals them as it swings.
  useLayoutEffect(() => {
    const m = motion.current
    let alive = true
    if (phase === 'opening') {
      const first = spreads[Math.max(0, index)].id
      void ensure([pageKey(first, 'left'), pageKey(first, 'right')]).then(() => { if (alive) m.openTarget = 1 })
    } else if (phase === 'closing') m.openTarget = 0
    else {
      m.openTarget = null
      m.open = phase === 'open' ? 1 : 0
    }
    return () => { alive = false }
  }, [ensure, index, phase, spreads])

  // New content (a record added elsewhere, say) means new pictures.
  const signature = useMemo(() => JSON.stringify({ world, types }), [world, types])
  const lastSignature = useRef(signature)
  useEffect(() => {
    if (lastSignature.current === signature) return
    lastSignature.current = signature
    pictures.clear()
    setTextures({})
  }, [pictures, signature])
  useEffect(() => () => pictures.clear(), [pictures])

  const finishTurn = useCallback((committed: boolean) => {
    if (!turn) return
    motion.current.target = null
    motion.current.drag = null
    if (committed) setIndex(turn.to)
    setTurn(null)
  }, [turn])

  useLayoutEffect(() => {
    const m = motion.current
    // A turn asked for by a tap, a line of the index or a key starts flat on its side and springs across.
    if (turn && turn !== m.started) {
      m.started = turn
      if (turn.mode === 'auto') {
        m.progress = turn.dir === 'next' ? 0 : 1
        m.velocity = 0
        m.target = turn.dir === 'next' ? 1 : 0
        m.spring = COMMIT_SPRING
      }
    }
    m.finish = () => {
      if (!turn) return
      finishTurn(turn.dir === 'next' ? m.progress > 0.5 : m.progress < 0.5)
    }
  }, [finishTurn, turn])

  // The palette and the fonts the cover is painted with are only readable in the browser.
  useLayoutEffect(() => {
    const element = stage.current
    if (!element) return
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    setPalette(readNotebookPalette(element))
    setFonts({
      serif: getComputedStyle(document.documentElement).getPropertyValue('--font-serif').trim() || 'serif',
      type: typewriter.style.fontFamily,
    })
  }, [])

  // One loop: the page spring and the opening of the notebook.
  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      const m = motion.current
      if (m.drag?.started) m.progress += (m.dragGoal - m.progress) * (1 - Math.exp(-DRAG_FOLLOW * dt))
      if (m.target !== null && !m.drag?.started) {
        const step = springStep(m.progress, m.velocity, m.target, dt, m.spring.stiffness, m.spring.damping)
        m.progress = step.position
        m.velocity = step.velocity
        if (Math.abs(m.progress - m.target) < 0.002 && Math.abs(m.velocity) < 0.02) {
          m.progress = m.target
          m.finish?.()
        }
      }
      if (m.openTarget !== null) {
        const direction = m.openTarget > m.open ? 1 : -1
        m.open = Math.min(1, Math.max(0, m.open + (direction * dt) / OPEN_SECONDS))
        if (m.open === m.openTarget) {
          const opened = m.openTarget === 1
          m.openTarget = null
          setPhase(opened ? 'open' : 'closed')
          if (!opened) setIndex(-1)
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  // The saved spread is used once.
  useEffect(() => {
    try {
      window.sessionStorage.removeItem(RETURN_KEY)
    } catch {
      // Storage may be unavailable; nothing to clear then.
    }
  }, [])

  /**
   * Following a link out of the notebook: remembers the open spread, and opens a record's page, or a
   * category's ("ver todos"), with the name-mask transition (a plain click only; new-tab clicks keep
   * the browser's behaviour). The name shown is the link's `data-reveal-title`, or a record link's text.
   */
  const followLink = (event: React.MouseEvent) => {
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
    if (index < 0 || !anchor) return
    try {
      window.sessionStorage.setItem(RETURN_KEY, JSON.stringify({ world: world.name, spread: spreads[index].id }))
    } catch {
      // Private windows may refuse storage; the notebook then simply opens closed.
    }
    const href = anchor.getAttribute('href') ?? ''
    const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
    const title = anchor.dataset.revealTitle ?? (href.startsWith('/entity/') ? anchor.textContent?.trim() : undefined)
    if (!reveal || !plain || !title) return
    event.preventDefault()
    reveal({ href, title })
  }

  // Keys: arrows turn, Escape closes, Enter opens.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]')) return
      if (phase === 'closed' && (event.key === 'Enter' || event.key === 'ArrowRight')) openBook()
      if (event.key === 'ArrowRight') turnTo(index + 1)
      if (event.key === 'ArrowLeft') turnTo(index - 1)
      if (event.key === 'Escape') closeBook()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeBook, index, openBook, phase, turnTo])

  /** Which page a point is on, measured from the page overlays (they sit exactly on the 3D pages). */
  const regionAt = (x: number, y: number): Drag['region'] => {
    for (const side of ['left', 'right'] as const) {
      const rect = overlays.current[side]?.getBoundingClientRect()
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return side
    }
    return 'outside'
  }

  const onPointerDown = (event: React.PointerEvent) => {
    if (phase !== 'open' || turn || event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('a, button, [data-index-card]')) return
    motion.current.drag = {
      id: event.pointerId, startX: event.clientX, startY: event.clientY,
      region: regionAt(event.clientX, event.clientY), started: false, turned: 0, speed: 0, lastT: performance.now(),
    }
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const m = motion.current
    const drag = m.drag
    if (!drag || drag.id !== event.pointerId || drag.region === 'outside') return
    const dx = event.clientX - drag.startX
    if (!drag.started) {
      if (Math.abs(dx) < TAP_SLOP) return
      const forward = drag.region === 'right' && dx < 0
      const backward = drag.region === 'left' && dx > 0
      const target = forward ? index + 1 : backward ? index - 1 : null
      if (Math.abs(event.clientY - drag.startY) > Math.abs(dx) || target === null || target < 0 || target >= spreads.length) {
        m.drag = null
        return
      }
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
      drag.started = true
      m.target = null
      m.progress = forward ? 0 : 1
      m.dragGoal = m.progress
      const next: Turn = { from: index, to: target, dir: forward ? 'next' : 'prev', mode: 'drag' }
      const keys = turnKeys(spreads, next)
      if (keys.every((key) => pictures.get(key))) setTurn(next)
      else {
        // Its pictures are not ready yet (Firefox takes them slowly): the leaf waits for them rather
        // than turning blank, and then catches up with the pointer.
        drag.waitingFor = target
        void ensure(keys).then(() => {
          if (motion.current.drag !== drag) return
          drag.waitingFor = undefined
          setTurn(next)
        })
      }
    }
    const direction = turn?.dir ?? (drag.region === 'right' ? 'next' : 'prev')
    const spreadWidth = (overlays.current.left?.getBoundingClientRect().width ?? 300) * 2
    const now = performance.now()
    const turned = dragProgress(dx, spreadWidth, direction)
    drag.speed = (turned - drag.turned) / Math.max(0.008, (now - drag.lastT) / 1000)
    drag.turned = turned
    drag.lastT = now
    m.dragGoal = direction === 'next' ? turned : 1 - turned
  }

  const onPointerUp = (event: React.PointerEvent) => {
    const m = motion.current
    const drag = m.drag
    if (!drag || drag.id !== event.pointerId) return
    m.drag = null
    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
    if (!drag.started) {
      if (moved >= TAP_SLOP) return
      // A tap on the desk closes the notebook; a tap on a page turns it, like a real book.
      if (drag.region === 'outside') closeBook()
      else turnTo(drag.region === 'right' ? index + 1 : index - 1)
      return
    }
    if (drag.waitingFor !== undefined) {
      // Let go before its pictures were ready: a real pull still turns the page, once they are.
      if (shouldComplete(drag.turned, drag.speed)) turnTo(drag.waitingFor)
      return
    }
    if (!turn) return
    const complete = shouldComplete(drag.turned, drag.speed)
    const forward = turn.dir === 'next'
    m.target = complete === forward ? 1 : 0
    m.spring = complete ? COMMIT_SPRING : CANCEL_SPRING
    m.velocity = (forward ? 1 : -1) * drag.speed * 0.5
  }

  const settled = phase === 'open' && !turn
  // The notebook is shown once the scene has drawn and the pictures it shows first are ready, so
  // the reader never sees it being put together.
  const firstPictures = index < 0
    ? picture('index') !== null
    : picture('index') !== null && picture(pageKey(spreads[index].id, 'left')) !== null && picture(pageKey(spreads[index].id, 'right')) !== null
  const loaded = (sceneShown && firstPictures) || loadingTimedOut
  const indexCard = <IndexCard spreads={spreads} current={index} onOpen={(target) => phase === 'closed' ? openBook(target) : turnTo(target)}/>

  return (
    <div
      ref={stage}
      className={`${styles.stage} ${hand.variable} ${typewriter.variable}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <NotebookLoading done={loaded}/>
      <p className="sr-only" aria-live="polite">{index === -1 ? 'Capa do Codex' : `Páginas: ${spreads[index].tab}`}</p>

      {palette && fonts && <div className={styles.canvas}>
        <BookScene
          palette={palette}
          worldName={world.name}
          recordLine={formatRecordCount(world.recordCount)}
          fonts={fonts}
          turn={turn}
          motion={motion}
          overlays={overlays}
          textures={{
            left: picture(underKeys?.left),
            right: picture(underKeys?.right),
            front: picture(leafKeys?.front),
            back: picture(leafKeys?.back),
            index: picture('index'),
          }}
          onOpenRequest={() => openBook()}
          onShown={() => setSceneShown(true)}
        />
      </div>}

      {/* The real pages, laid exactly over the 3D ones while they lie still, so they can be clicked.
          Once a page's picture is ready they stay invisible (data-ghost): the reader always sees the
          same picture, still or turning, so nothing changes sharpness or blinks when a turn ends. */}
      <div className={styles.overlays} onClickCapture={followLink}>
        <div ref={(element) => { overlays.current.left = element }} data-page="left" className={styles.overlayPage} data-visible={(settled && index >= 0) || undefined} data-ghost={(index >= 0 && picture(pageKey(spreads[index].id, 'left')) !== null) || undefined}>{current.left}</div>
        <div ref={(element) => { overlays.current.right = element }} data-page="right" className={styles.overlayPage} data-visible={(settled && index >= 0) || undefined} data-ghost={(index >= 0 && picture(pageKey(spreads[index].id, 'right')) !== null) || undefined}>{current.right}</div>
        <div ref={(element) => { overlays.current.index = element }} data-index-card className={styles.overlayIndex} data-visible={phase === 'open' || undefined} style={{ width: INDEX_PX.width, height: INDEX_PX.height }}>{indexCard}</div>
      </div>

      {phase === 'closed' && <button type="button" className={styles.openHint} onClick={() => openBook()}>Abrir o Codex</button>}
      {/* Off-screen copies of the pages, photographed into textures for the 3D book. */}
      <div aria-hidden inert className={styles.snapshots}>
        {wanted.map((at) => {
          const pages = pagesOf(at)
          return [
            <Snapshot key={pageKey(spreads[at].id, 'left')} id={pageKey(spreads[at].id, 'left')} onReady={capture}>{pages.left}</Snapshot>,
            <Snapshot key={pageKey(spreads[at].id, 'right')} id={pageKey(spreads[at].id, 'right')} onReady={capture}>{pages.right}</Snapshot>,
          ]
        })}
        <Snapshot id="index" onReady={capture} width={INDEX_PX.width} height={INDEX_PX.height}>{indexCard}</Snapshot>
      </div>
    </div>
  )
}

/** Takes page pictures one by one, in idle time, and waits while the notebook is moving. */
class CaptureQueue {
  private readonly jobs: { key: string; element: HTMLElement; tries?: number }[] = []
  private running = false
  private order: string[] = []

  constructor(
    private readonly pictures: PageTextures,
    private readonly onReady: (key: string, texture: Texture) => void,
    private readonly isMoving: () => boolean,
    private readonly scale: () => number,
    private readonly paper: () => string,
  ) {}

  /** Queues a page; a page queued again (its copy was re-created) keeps its place with the new copy. */
  add(key: string, element: HTMLElement) {
    if (this.pictures.get(key)) return
    const queued = this.jobs.find((job) => job.key === key)
    if (queued) queued.element = element
    else this.jobs.push({ key, element })
    this.next()
  }

  /**
   * Orders the queue by `order` (nearest pages first) and drops the pages not in it. Pages no longer
   * wanted used to stay queued, each costing the queue a turn on a copy that no longer existed; and
   * far pages were taken before near ones. In Firefox, where a picture takes up to half a second,
   * the queue fell behind until pages turned before their pictures were ready (blank).
   */
  prioritize(order: string[]) {
    this.order = order
    for (let i = this.jobs.length - 1; i >= 0; i -= 1) if (!order.includes(this.jobs[i].key)) this.jobs.splice(i, 1)
  }

  private next() {
    if (this.running) return
    if (this.isMoving()) {
      window.setTimeout(() => this.next(), 250)
      return
    }
    const rank = (key: string) => { const at = this.order.indexOf(key); return at === -1 ? this.order.length : at }
    this.jobs.sort((a, b) => rank(a.key) - rank(b.key))
    let job = this.jobs.shift()
    while (job && (!job.element.isConnected || this.pictures.get(job.key))) job = this.jobs.shift()
    if (!job) return
    this.running = true
    const run = () => void this.pictures.capture(job.key, job.element, this.scale(), this.paper())
      .then((texture) => {
        if (texture) this.onReady(job.key, texture)
        // It may have joined a picture of the copy it replaced, which failed: take it again, once.
        else if (job.element.isConnected && !this.pictures.has(job.key) && (job.tries ?? 0) < 1) this.jobs.push({ ...job, tries: (job.tries ?? 0) + 1 })
      })
      .finally(() => {
        this.running = false
        this.next()
      })
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 200 })
    else window.setTimeout(run, 60)
  }
}

function Snapshot({ id, onReady, children, width = PAGE_W, height = PAGE_H }: { id: string; onReady: (id: string, element: HTMLElement) => void; children: ReactNode; width?: number; height?: number }) {
  const element = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (element.current) onReady(id, element.current)
  }, [id, onReady])
  return <div ref={element} className={styles.snapshot} style={{ width, height }}>{children}</div>
}
