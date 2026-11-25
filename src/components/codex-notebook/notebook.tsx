'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Caveat, Special_Elite } from 'next/font/google'
import { buildSpreads, type NotebookType } from './notebook-contents'
import { Cover, renderSpread, type NotebookWorld, type SpreadPages } from './notebook-pages'
import { leafPose, progressFromPointer, settleTarget, springStep, STRIPS } from './page-turn'
import styles from './notebook.module.css'

const hand = Caveat({ subsets: ['latin'], variable: '--font-hand' })
const typewriter = Special_Elite({ weight: '400', subsets: ['latin'], variable: '--font-type' })

/** Pages are composed on a fixed sheet and the whole book is scaled to fit the desk. */
export const PAGE_W = 600
export const PAGE_H = 820
const STRIP_W = PAGE_W / STRIPS
/** A drag must travel this far, mostly sideways, before it turns a page; shorter is a click. */
const DRAG_START = 10

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
    scale: 1, reduced: false, started: null as Turn | null,
    drag: null as null | { id: number; startX: number; startY: number; side: 'left' | 'right'; started: boolean; lastX: number; lastT: number },
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

  // One animation loop for the turning spring.
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
    motion.current.drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, side: event.clientX > spineX() ? 'right' : 'left', started: false, lastX: event.clientX, lastT: performance.now() }
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const m = motion.current
    const drag = m.drag
    if (!drag || drag.id !== event.pointerId) return
    if (!drag.started) {
      const dx = Math.abs(event.clientX - drag.startX)
      const dy = Math.abs(event.clientY - drag.startY)
      if (dx < DRAG_START) return
      // A mostly vertical movement is not a page turn (e.g. selecting or scrolling).
      if (dy > dx) {
        m.drag = null
        return
      }
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
    m.target = settleTarget(m.progress, m.velocity, turn?.dir ?? 'next')
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
      <div aria-hidden className={styles.desk}/>
      <p className="sr-only" aria-live="polite">{index === -1 ? 'Capa do Codex' : `Páginas: ${spreads[index].tab}`}</p>
      <div className={styles.bookFrame}>
        <div ref={book} className={styles.book} data-turning={turn ? true : undefined} data-closed={index === -1 && !turn ? true : undefined}>
          <div className={styles.page} data-side="left" data-empty={under.left ? undefined : true}>{under.left}</div>
          <div className={styles.page} data-side="right">{under.right}</div>
          {/* The only 3D in the book: a layer kept mounted, holding the leaf while it turns. */}
          <div className={styles.turnLayer}>
            {turn && leafFaces && <Leaf ref={leaf} front={leafFaces.front} back={leafFaces.back}/>}
          </div>
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
