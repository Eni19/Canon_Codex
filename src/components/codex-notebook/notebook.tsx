'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Caveat, Special_Elite } from 'next/font/google'
import { usePathname, useRouter } from 'next/navigation'
import { buildSpreads, spreadIndexFromParam, type NotebookType } from './notebook-contents'
import { Cover, renderSpread, type NotebookWorld, type SpreadPages } from './notebook-pages'
import { CANCEL_SPRING, COMMIT_SPRING, dragProgress, leafPose, shouldComplete, springStep, STRIPS } from './page-turn'
import styles from './notebook.module.css'

const hand = Caveat({ subsets: ['latin'], variable: '--font-hand' })
const typewriter = Special_Elite({ weight: '400', subsets: ['latin'], variable: '--font-type' })

/** Pages are composed on a fixed sheet and the whole book is scaled to fit the desk. */
export const PAGE_W = 600
export const PAGE_H = 820
const STRIP_W = PAGE_W / STRIPS
/** How far the post-it tabs stick out past the pages, on each side. */
const TAB_OUT = 182
/** Movement under this many pixels is a tap, not a drag. */
const TAP_SLOP = 4
/** The URL parameter that remembers the open spread, so the browser's back button returns to it. */
const PAGE_PARAM = 'pagina'

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
  turned: number
  speed: number
  lastT: number
}

export interface NotebookProps {
  world: NotebookWorld
  types: NotebookType[]
  /** Spread id from `?pagina=`, to reopen where the reader was. */
  initialSpread?: string
}

export function Notebook({ world, types, initialSpread }: NotebookProps) {
  const spreads = useMemo(() => buildSpreads(types), [types])
  const router = useRouter()
  const pathname = usePathname()
  const [index, setIndex] = useState(() => spreadIndexFromParam(spreads, initialSpread))
  const [turn, setTurn] = useState<Turn | null>(null)
  const [reduced, setReduced] = useState(false)

  const stage = useRef<HTMLDivElement>(null)
  const book = useRef<HTMLDivElement>(null)
  const leaf = useRef<HTMLDivElement>(null)
  const motion = useRef({
    progress: 0,
    velocity: 0,
    target: null as number | null,
    spring: COMMIT_SPRING,
    scale: 1,
    started: null as Turn | null,
    drag: null as Drag | null,
    finish: null as null | (() => void),
  })

  const turnTo = useCallback((target: number) => {
    if (turn || target === index || target < -1 || target >= spreads.length) return
    if (reduced) {
      setIndex(target)
      return
    }
    setTurn({ from: index, to: target, dir: target > index ? 'next' : 'prev', mode: 'auto' })
  }, [index, reduced, spreads.length, turn])

  const pagesOf = useCallback((at: number): SpreadPages => at === -1
    ? { left: null, right: <Cover world={world} spreads={spreads} onOpen={turnTo}/> }
    : renderSpread(spreads[at], at, world, spreads, turnTo), [spreads, world, turnTo])

  // While a leaf turns, the pages under it are the destination's on one side and the origin's on the other.
  const current = pagesOf(index)
  const under = turn
    ? { left: pagesOf(turn.dir === 'next' ? turn.from : turn.to).left, right: pagesOf(turn.dir === 'next' ? turn.to : turn.from).right }
    : current
  const leafFaces = turn
    ? { front: pagesOf(turn.dir === 'next' ? turn.from : turn.to).right, back: pagesOf(turn.dir === 'next' ? turn.to : turn.from).left }
    : null
  const involvesCover = turn ? turn.from === -1 || turn.to === -1 : false

  /** Writes the leaf pose and the book's slide into CSS variables; no React render per frame. */
  const applyPose = useCallback(() => {
    const m = motion.current
    const pose = leafPose(m.progress)
    const root = book.current
    if (!root) return
    // Closed, the cover sits centred on the desk; it slides to the right half as the book opens.
    const closed = turn ? (involvesCover ? 1 - m.progress : 0) : index === -1 ? 1 : 0
    root.style.setProperty('--slide', `${(-PAGE_W / 2) * closed}px`)
    root.style.setProperty('--closed', closed.toFixed(3))
    root.style.setProperty('--lift', pose.lift.toFixed(3))
    const leafRoot = leaf.current
    if (!leafRoot) return
    leafRoot.style.setProperty('--spine', `${(-pose.spine).toFixed(2)}deg`)
    leafRoot.style.setProperty('--step', `${pose.step.toFixed(3)}deg`)
    leafRoot.querySelectorAll<HTMLElement>('[data-strip]').forEach((strip, i) => {
      const light = pose.shading[i]
      strip.style.setProperty('--near', light.near.toFixed(3))
      strip.style.setProperty('--far', light.far.toFixed(3))
      strip.style.setProperty('--lit', light.lit.toFixed(3))
      // Which face is toward the reader, chosen here rather than with backface-visibility, which
      // flickers in Firefox: a strip shows its front until it passes upright.
      const facingFront = pose.spine - i * pose.step < 90
      strip.style.setProperty('--front', facingFront ? 'visible' : 'hidden')
      strip.style.setProperty('--back', facingFront ? 'hidden' : 'visible')
    })
  }, [index, involvesCover, turn])

  const finishTurn = useCallback((committed: boolean) => {
    if (!turn) return
    motion.current.target = null
    motion.current.drag = null
    if (committed) setIndex(turn.to)
    setTurn(null)
  }, [turn])

  useLayoutEffect(() => {
    const m = motion.current
    // A turn asked for by a tap, a tab or a key starts flat on its side and springs across.
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
    applyPose()
  }, [applyPose, finishTurn, turn])

  // Remember the open spread in the URL (replacing, not adding history), so coming back from a
  // record's page with the browser's back button reopens the notebook where the reader left it.
  // It goes through the router: a bare history.replaceState was overwritten by the router's own
  // copy of the old URL as soon as the reader followed a link.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (index === -1) params.delete(PAGE_PARAM)
    else params.set(PAGE_PARAM, spreads[index].id)
    const query = params.toString()
    const href = query ? `${pathname}?${query}` : pathname
    if (href !== `${window.location.pathname}${window.location.search}`) router.replace(href, { scroll: false })
  }, [index, pathname, router, spreads])

  // Warm the image cache for the spreads on either side, so a turn never reveals empty polaroids.
  useEffect(() => {
    for (const neighbour of [spreads[index - 1], spreads[index + 1]]) {
      if (neighbour?.kind !== 'type') continue
      for (const record of neighbour.type.recent) {
        if (record.coverAssetId) new Image().src = `/api/assets/${record.coverAssetId}/thumbnail`
      }
    }
  }, [index, spreads])

  // Fit the book, with its tabs, to the desk.
  useLayoutEffect(() => {
    const element = stage.current
    if (!element) return
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    const fit = () => {
      const { width, height } = element.getBoundingClientRect()
      const scale = Math.min((width * 0.94) / (PAGE_W * 2 + TAB_OUT * 2), (height * 0.88) / PAGE_H)
      motion.current.scale = scale
      element.style.setProperty('--scale', scale.toFixed(4))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // One animation loop for the turning spring.
  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      const m = motion.current
      if (m.target !== null && !m.drag?.started) {
        const step = springStep(m.progress, m.velocity, m.target, dt, m.spring.stiffness, m.spring.damping)
        m.progress = step.position
        m.velocity = step.velocity
        if (Math.abs(m.progress - m.target) < 0.002 && Math.abs(m.velocity) < 0.02) {
          m.progress = m.target
          applyPose()
          m.finish?.()
        } else applyPose()
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [applyPose])

  // Arrow keys turn the pages, unless the reader is typing somewhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]')) return
      if (event.key === 'ArrowRight') turnTo(index + 1)
      if (event.key === 'ArrowLeft') turnTo(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, turnTo])

  /** Which page a point is on, measured from the pages themselves (the closed book has one). */
  const regionAt = (x: number, y: number): Drag['region'] => {
    for (const side of ['left', 'right'] as const) {
      const page = book.current?.querySelector<HTMLElement>(`[data-page="${side}"]:not([data-empty])`)
      const rect = page?.getBoundingClientRect()
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return side
    }
    return 'outside'
  }

  const onPointerDown = (event: React.PointerEvent) => {
    if (turn || event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('a, button')) return
    motion.current.drag = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      region: regionAt(event.clientX, event.clientY),
      started: false,
      turned: 0,
      speed: 0,
      lastT: performance.now(),
    }
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const m = motion.current
    const drag = m.drag
    if (!drag || drag.id !== event.pointerId || drag.region === 'outside') return
    const dx = event.clientX - drag.startX
    if (!drag.started) {
      if (Math.abs(dx) < TAP_SLOP) return
      // A mostly vertical movement, or a pull the wrong way, is not a page turn.
      const forward = drag.region === 'right' && dx < 0
      const backward = drag.region === 'left' && dx > 0
      const target = forward ? index + 1 : backward ? index - 1 : null
      if (Math.abs(event.clientY - drag.startY) > Math.abs(dx) || target === null || target < -1 || target >= spreads.length) {
        m.drag = null
        return
      }
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
      drag.started = true
      m.target = null
      m.progress = forward ? 0 : 1
      setTurn({ from: index, to: target, dir: forward ? 'next' : 'prev', mode: 'drag' })
    }
    const direction = turn?.dir ?? (drag.region === 'right' ? 'next' : 'prev')
    const now = performance.now()
    const turned = dragProgress(dx, PAGE_W * 2 * m.scale, direction)
    drag.speed = (turned - drag.turned) / Math.max(0.008, (now - drag.lastT) / 1000)
    drag.turned = turned
    drag.lastT = now
    m.progress = direction === 'next' ? turned : 1 - turned
    applyPose()
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
      if (drag.region === 'outside') turnTo(-1)
      else turnTo(drag.region === 'right' ? index + 1 : index - 1)
      return
    }
    if (!turn) return
    const complete = shouldComplete(drag.turned, drag.speed)
    const forward = turn.dir === 'next'
    m.target = complete === forward ? 1 : 0
    m.spring = complete ? COMMIT_SPRING : CANCEL_SPRING
    m.velocity = (forward ? 1 : -1) * drag.speed * 0.5
  }

  const tabStep = Math.min(48, (PAGE_H - 100) / Math.max(1, spreads.length))

  return (
    <div
      ref={stage}
      className={`${styles.stage} ${hand.variable} ${typewriter.variable}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div aria-hidden className={styles.desk}/>
      <p className="sr-only" aria-live="polite">{index === -1 ? 'Capa do Codex' : `Páginas: ${spreads[index].tab}`}</p>
      <div className={styles.bookFrame}>
        <div ref={book} className={styles.book} data-turning={turn ? true : undefined}>
          <div className={styles.page} data-page="left" data-side="left" data-empty={under.left ? undefined : true}>{under.left}</div>
          <div className={styles.page} data-page="right" data-side="right">{under.right}</div>
          {/* The only 3D in the book: a layer kept mounted, holding the leaf while it turns. */}
          <div className={styles.turnLayer}>
            {turn && leafFaces && <Leaf ref={leaf} front={leafFaces.front} back={leafFaces.back}/>}
          </div>
          <nav aria-label="Marcadores do caderno" className={styles.tabs}>
            {spreads.map((spread, i) => <button
              key={spread.id}
              type="button"
              className={styles.tab}
              data-side={i <= index ? 'left' : 'right'}
              data-current={i === index || undefined}
              data-tone={i % 4}
              data-long={spread.tab.length > 13 || undefined}
              style={{ top: 50 + i * tabStep, height: tabStep - 6, rotate: `${(i % 3 - 1) * 0.8}deg` } as CSSProperties}
              onClick={() => turnTo(i)}
              disabled={i === index}
              aria-current={i === index ? 'page' : undefined}
            >
              <span>{spread.tab}</span>
            </button>)}
          </nav>
        </div>
      </div>
      {index !== -1 && !turn && <button type="button" className={styles.indexTag} onClick={() => turnTo(-1)}>Índice</button>}
    </div>
  )
}

/**
 * The turning leaf: strips nested inside each other, each turning a little back from its parent.
 * Each strip shows a slice of the leaf's front page on one face and of its back page on the other,
 * with a warm shadow and a soft gloss that follow its angle to the light.
 */
function Leaf({ ref, front, back }: { ref: React.Ref<HTMLDivElement>; front: ReactNode; back: ReactNode }) {
  let chain: ReactNode = null
  for (let i = STRIPS - 1; i >= 0; i -= 1) {
    chain = <div className={styles.strip} data-strip={i} data-first={i === 0 || undefined} style={{ width: STRIP_W }}>
      <div className={styles.face} data-face="front">
        <div className={styles.faceContent} style={{ left: -i * STRIP_W }}>{front}</div>
        <span className={styles.faceShade}/>
        <span className={styles.faceGloss}/>
      </div>
      <div className={styles.face} data-face="back">
        <div className={styles.faceContent} style={{ left: -(PAGE_W - (i + 1) * STRIP_W) }}>{back}</div>
        <span className={styles.faceShade}/>
        <span className={styles.faceGloss}/>
      </div>
      {chain}
    </div>
  }
  return <div ref={ref} className={styles.leaf} aria-hidden>{chain}</div>
}
