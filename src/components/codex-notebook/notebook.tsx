'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Caveat, Special_Elite } from 'next/font/google'
import { buildSpreads, type NotebookType } from './notebook-contents'
import { Cover, renderSpread, type NotebookWorld, type SpreadPages } from './notebook-pages'
import { clamp, leafPose, progressFromPointer, settleTarget, springStep, STRIPS } from './page-turn'
import styles from './notebook.module.css'

const hand = Caveat({ subsets: ['latin'], variable: '--font-hand' })
const typewriter = Special_Elite({ weight: '400', subsets: ['latin'], variable: '--font-type' })

/** Pages are composed on a fixed sheet and the whole book is scaled to fit the desk. */
export const PAGE_W = 600
export const PAGE_H = 820
const STRIP_W = PAGE_W / STRIPS
/** Pointer tilt of the book, in degrees: deliberately small. */
const TILT_X = 4
const TILT_Y = 6

interface Turn {
  from: number
  to: number
  /** next: the leaf travels right → left (progress 0 → 1); prev: left → right (1 → 0). */
  dir: 'next' | 'prev'
  /** auto: animated by the spring from the start; drag: follows the pointer until released. */
  mode: 'auto' | 'drag'
}

export interface NotebookProps {
  world: NotebookWorld
  types: NotebookType[]
}

export function Notebook({ world, types }: NotebookProps) {
  const spreads = useMemo(() => buildSpreads(types), [types])
  const [index, setIndex] = useState(-1)
  const [turn, setTurn] = useState<Turn | null>(null)
  const [reduced, setReduced] = useState(false)

  const stage = useRef<HTMLDivElement>(null)
  const book = useRef<HTMLDivElement>(null)
  const leaf = useRef<HTMLDivElement>(null)
  const motion = useRef({
    progress: 0, velocity: 0, target: null as number | null,
    tilt: { x: 0, y: 0, tx: 0, ty: 0 }, scale: 1, reduced: false, started: null as Turn | null,
    drag: null as null | { id: number; startX: number; side: 'left' | 'right'; started: boolean; lastX: number; lastT: number },
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
      strip.style.setProperty('--near', pose.shading[i].near.toFixed(3))
      strip.style.setProperty('--far', pose.shading[i].far.toFixed(3))
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
    // A turn asked for by a tab or a key starts flat on its side and springs across on its own.
    if (turn && turn !== m.started) {
      m.started = turn
      if (turn.mode === 'auto') {
        m.progress = turn.dir === 'next' ? 0 : 1
        m.velocity = 0
        m.target = turn.dir === 'next' ? 1 : 0
      }
    }
    motion.current.finish = () => {
      if (!turn) return
      const end = motion.current.progress
      finishTurn(turn.dir === 'next' ? end > 0.5 : end < 0.5)
    }
    applyPose()
  }, [applyPose, finishTurn, turn])

  // Fit the book to the desk.
  useLayoutEffect(() => {
    const element = stage.current
    if (!element) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    motion.current.reduced = prefersReduced
    setReduced(prefersReduced)
    const fit = () => {
      const { width, height } = element.getBoundingClientRect()
      const scale = Math.min((width * 0.84) / (PAGE_W * 2), (height * 0.86) / PAGE_H)
      motion.current.scale = scale
      element.style.setProperty('--scale', scale.toFixed(4))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // One animation loop: the turning spring and the pointer tilt.
  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      const m = motion.current
      if (m.target !== null && !m.drag?.started) {
        const step = springStep(m.progress, m.velocity, m.target, dt)
        m.progress = step.position
        m.velocity = step.velocity
        if (Math.abs(m.progress - m.target) < 0.002 && Math.abs(m.velocity) < 0.02) {
          m.progress = m.target
          applyPose()
          m.finish?.()
        } else applyPose()
      }
      const ease = m.reduced ? 1 : 0.1
      m.tilt.x += (m.tilt.tx - m.tilt.x) * ease
      m.tilt.y += (m.tilt.ty - m.tilt.y) * ease
      stage.current?.style.setProperty('--tilt-x', `${m.tilt.x.toFixed(3)}deg`)
      stage.current?.style.setProperty('--tilt-y', `${m.tilt.y.toFixed(3)}deg`)
      stage.current?.style.setProperty('--px', (m.tilt.y / TILT_Y).toFixed(3))
      stage.current?.style.setProperty('--py', (m.tilt.x / TILT_X).toFixed(3))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [applyPose])

  // Arrow keys turn the pages, unless the reader is typing somewhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]')) return
      if (event.key === 'ArrowRight') turnTo(index + 1)
      if (event.key === 'ArrowLeft') turnTo(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, turnTo])

  const spineX = () => {
    const rect = stage.current?.getBoundingClientRect()
    if (!rect) return 0
    const closed = index === -1 && !turn ? 1 : 0
    return rect.left + rect.width / 2 + (-PAGE_W / 2) * closed * motion.current.scale
  }

  const onPointerDown = (event: React.PointerEvent) => {
    if (turn || event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('a, button')) return
    motion.current.drag = { id: event.pointerId, startX: event.clientX, side: event.clientX > spineX() ? 'right' : 'left', started: false, lastX: event.clientX, lastT: performance.now() }
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const m = motion.current
    const rect = stage.current?.getBoundingClientRect()
    if (rect) {
      const nx = clamp((event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2), -1, 1)
      const ny = clamp((event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2), -1, 1)
      m.tilt.ty = m.drag?.started ? m.tilt.ty : nx * TILT_Y
      m.tilt.tx = m.drag?.started ? m.tilt.tx : -ny * TILT_X
    }
    const drag = m.drag
    if (!drag || drag.id !== event.pointerId) return
    if (!drag.started) {
      if (Math.abs(event.clientX - drag.startX) < 6) return
      const forward = drag.side === 'right' && event.clientX < drag.startX
      const backward = drag.side === 'left' && event.clientX > drag.startX
      const target = forward ? index + 1 : backward ? index - 1 : null
      if (target === null || target < -1 || target >= spreads.length) {
        m.drag = null
        return
      }
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
      drag.started = true
      m.progress = forward ? 0 : 1
      m.velocity = 0
      m.target = null
      setTurn({ from: index, to: target, dir: forward ? 'next' : 'prev', mode: 'drag' })
    }
    const now = performance.now()
    const p = progressFromPointer(event.clientX, spineX(), PAGE_W * m.scale)
    m.velocity = (p - m.progress) / Math.max(0.008, (now - drag.lastT) / 1000)
    m.progress = p
    drag.lastX = event.clientX
    drag.lastT = now
    applyPose()
  }

  const onPointerUp = (event: React.PointerEvent) => {
    const m = motion.current
    const drag = m.drag
    if (!drag || drag.id !== event.pointerId) return
    if (!drag.started) {
      m.drag = null
      return
    }
    m.target = settleTarget(m.progress, m.velocity)
    m.velocity *= 0.5
    m.drag = null
  }

  const tabs = spreads.map((spread, i) => ({ spread, i, side: i <= index ? 'left' : 'right' as 'left' | 'right' }))
  const tabStep = Math.min(48, (PAGE_H - 120) / Math.max(1, spreads.length))

  return (
    <div
      ref={stage}
      className={`${styles.stage} ${hand.variable} ${typewriter.variable}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Desk/>
      <p className="sr-only" aria-live="polite">{index === -1 ? 'Capa do Codex' : `Páginas: ${spreads[index].tab}`}</p>
      <div className={styles.bookFrame}>
        <div ref={book} className={styles.book} data-turning={turn ? true : undefined} data-closed={index === -1 && !turn ? true : undefined}>
          <div className={styles.page} data-side="left" data-empty={under.left ? undefined : true}>{under.left}</div>
          <div className={styles.page} data-side="right">{under.right}</div>
          {turn && leafFaces && <Leaf ref={leaf} front={leafFaces.front} back={leafFaces.back}/>}
          <nav aria-label="Abas do caderno" className={styles.tabs}>
            {tabs.map(({ spread, i, side }) => <button
              key={spread.id}
              type="button"
              className={styles.tab}
              data-side={side}
              data-current={i === index || undefined}
              style={{ top: 60 + i * tabStep, height: tabStep - 4 } as CSSProperties}
              title={spread.tab}
              onClick={() => turnTo(i)}
              disabled={i === index}
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
 * Each strip shows a slice of the leaf's front page on one face and of its back page on the other.
 */
function Leaf({ ref, front, back }: { ref: React.Ref<HTMLDivElement>; front: ReactNode; back: ReactNode }) {
  let chain: ReactNode = null
  for (let i = STRIPS - 1; i >= 0; i -= 1) {
    chain = <div className={styles.strip} data-strip={i} data-first={i === 0 || undefined} data-last={i === STRIPS - 1 || undefined} style={{ width: STRIP_W }}>
      <div className={styles.face} data-face="front">
        <div className={styles.faceContent} style={{ left: -i * STRIP_W }}>{front}</div>
        <span className={styles.faceShade}/>
      </div>
      <div className={styles.face} data-face="back">
        <div className={styles.faceContent} style={{ left: -(PAGE_W - (i + 1) * STRIP_W) }}>{back}</div>
        <span className={styles.faceShade}/>
      </div>
      {chain}
    </div>
  }
  return <div ref={ref} className={styles.leaf} aria-hidden>{chain}</div>
}

/** The desk around the book: walnut, a pen, clips and a roll of tape, each on its own parallax layer. */
function Desk() {
  return <div aria-hidden className={styles.desk}>
    <span className={styles.deskGlow}/>
    <svg className={styles.pen} viewBox="0 0 40 420">
      <rect x="12" y="8" width="16" height="250" rx="8" fill="currentColor"/>
      <rect x="11" y="250" width="18" height="16" rx="3" className={styles.brassFill}/>
      <rect x="14" y="266" width="12" height="96" rx="5" fill="currentColor"/>
      <path d="M14 362 L26 362 L20 410 Z" className={styles.brassFill}/>
      <rect x="27" y="30" width="5" height="120" rx="2.5" className={styles.brassFill}/>
    </svg>
    <span className={styles.tapeRoll}/>
    <svg className={styles.clipA} viewBox="0 0 30 90"><path d="M10 22 V70 a8 8 0 0 0 16 0 V14 a11 11 0 0 0 -22 0 V64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
    <svg className={styles.clipB} viewBox="0 0 30 90"><path d="M10 22 V70 a8 8 0 0 0 16 0 V14 a11 11 0 0 0 -22 0 V64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
  </div>
}
