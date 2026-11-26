'use client'

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Alfa_Slab_One } from 'next/font/google'
import { findWindow, fitSize, revealFrame, WIPE_FEATHER, zoomFor, type Box, type RevealWindow } from './reveal-plan'

/** A heavy vintage slab: its thick strokes make wide windows onto the page. */
const display = Alfa_Slab_One({ weight: '400', subsets: ['latin', 'latin-ext'] })

export interface RevealTarget {
  href: string
  title: string
}

type StartReveal = (target: RevealTarget) => void
const RevealContext = createContext<StartReveal | null>(null)

/** Starts the name-mask transition to a record's page; null outside the provider. */
export function useRecordReveal(): StartReveal | null {
  return useContext(RevealContext)
}

interface Active extends RevealTarget {
  id: number
  /** The pathname the transition waits for. */
  path: string
}

/**
 * Lives in the wiki layout, which stays mounted across navigations, so one transition can start on
 * the notebook and finish on the record's page.
 */
export function RecordRevealProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [active, setActive] = useState<Active | null>(null)
  const counter = useRef(0)

  const start = useCallback<StartReveal>((target) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      router.push(target.href)
      return
    }
    counter.current += 1
    // The page starts loading now, but the route only changes once the screen is covered (see
    // onCovered): pushing at once let a quick page flash, uncovered, before the transition showed.
    router.prefetch(target.href)
    setActive({ ...target, id: counter.current, path: new URL(target.href, window.location.href).pathname })
  }, [router])

  return <RevealContext.Provider value={start}>
    {children}
    {active && <RevealOverlay key={active.id} active={active} arrived={pathname === active.path} onCovered={() => router.push(active.href)} onDone={() => setActive(null)}/>}
  </RevealContext.Provider>
}

interface Layout {
  width: number
  height: number
  size: number
  baseline: number
  /** The word's ink box: the ruling inside the letters is laid out on it. */
  word: Box
  window: RevealWindow
  zoom: number
}

/** Sets the name the way the SVG will draw it, and finds where to dive into it. */
function planLayout(title: string, family: string): Layout | null {
  const width = window.innerWidth
  const height = window.innerHeight
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.font = `100px ${family}`
  const size = fitSize(context.measureText(title).width, width, height)
  const baseline = height / 2 + size * 0.36
  context.font = `${size}px ${family}`
  const metrics = context.measureText(title)
  const word = {
    // Measured with the default (left) alignment: the word starts half its advance left of centre.
    x: width / 2 - metrics.width / 2 - metrics.actualBoundingBoxLeft,
    y: baseline - metrics.actualBoundingBoxAscent,
    width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
    height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
  }
  // Rasterise at a smaller scale: enough to find the thickest stroke, and quick.
  const scale = Math.min(1, 640 / width)
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  context.scale(scale, scale)
  context.font = `${size}px ${family}`
  context.textAlign = 'center'
  context.textBaseline = 'alphabetic'
  context.fillText(title, width / 2, baseline)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  const inside = new Uint8Array(canvas.width * canvas.height)
  for (let i = 0; i < inside.length; i += 1) inside[i] = pixels[i * 4 + 3] > 128 ? 1 : 0
  const found = findWindow(inside, canvas.width, canvas.height)
  if (!found) return null
  const point = { x: found.x / scale, y: found.y / scale, radius: found.radius / scale }
  return { width, height, size, baseline, word, window: point, zoom: zoomFor(point, width, height) }
}

function RevealOverlay({ active, arrived, onCovered, onDone }: { active: Active; arrived: boolean; onCovered: () => void; onDone: () => void }) {
  const id = useId().replace(/:/g, '')
  const title = active.title.toLocaleUpperCase('pt-BR')
  const [layout, setLayout] = useState<Layout | null>(null)
  const backdrop = useRef<SVGRectElement>(null)
  const maskText = useRef<SVGTextElement>(null)
  const clipText = useRef<SVGTextElement>(null)
  const fill = useRef<SVGGElement>(null)
  const wipeGradient = useRef<SVGLinearGradientElement>(null)
  const wipeHide = useRef<SVGStopElement>(null)
  const wipeShow = useRef<SVGStopElement>(null)
  const arrivedAt = useRef<number | null>(null)
  const started = useRef(0)
  const done = useRef(onDone)
  const covered = useRef(onCovered)
  useEffect(() => {
    done.current = onDone
    covered.current = onCovered
  }, [onCovered, onDone])
  const coveredSent = useRef(false)
  // The clock starts once, when the overlay appears (before the effects below that read it).
  useEffect(() => { started.current = performance.now() }, [])

  // The name is laid out once its font is ready.
  useEffect(() => {
    let alive = true
    const family = display.style.fontFamily
    void document.fonts.load(`100px ${family}`, title).then(() => {
      if (alive) setLayout(planLayout(title, family))
    })
    return () => { alive = false }
  }, [title])

  // The new page counts as shown two frames after its route commits, once it has been painted.
  useEffect(() => {
    if (!arrived || arrivedAt.current !== null) return
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => { arrivedAt.current = performance.now() - started.current })
    })
    return () => cancelAnimationFrame(frame)
  }, [arrived])

  // One loop drives every element, straight on the SVG: no React render per frame.
  useEffect(() => {
    let frame = 0
    const tick = (now: number) => {
      const t = now - started.current
      const at = revealFrame(t, arrivedAt.current, layout?.zoom ?? 1)
      backdrop.current?.setAttribute('opacity', String(at.backdrop))
      // Navigate once the dark screen fully covers the old page.
      if (!coveredSent.current && at.backdrop >= 1) {
        coveredSent.current = true
        covered.current()
      }
      if (layout) {
        const { x, y } = layout.window
        const transform = `translate(0 ${at.rise}) translate(${x} ${y}) scale(${at.zoom}) translate(${-x} ${-y})`
        maskText.current?.setAttribute('transform', transform)
        clipText.current?.setAttribute('transform', transform)
        // Mask: white keeps the dark screen, black opens a window onto the page.
        maskText.current?.setAttribute('fill', at.open ? 'black' : 'white')
        fill.current?.setAttribute('opacity', String(at.fill))
        // The paper's soft edge rises from below the word to above it.
        const edge = at.wipe * (1 + WIPE_FEATHER)
        wipeHide.current?.setAttribute('offset', String(edge - WIPE_FEATHER))
        wipeShow.current?.setAttribute('offset', String(edge))
        // The edge belongs to the letters: it grows and moves with them during the dive.
        wipeGradient.current?.setAttribute('gradientTransform', transform)
      }
      if (at.done) {
        done.current()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [layout])

  const text = (ref: React.RefObject<SVGTextElement | null>, extra: Record<string, string>) => layout && <text
    ref={ref}
    x={layout.width / 2}
    y={layout.baseline}
    textAnchor="middle"
    fontFamily={display.style.fontFamily}
    fontSize={layout.size}
    {...extra}
  >{title}</text>

  return <div aria-hidden className="fixed inset-0 z-[100] cursor-progress" onPointerDown={(event) => event.preventDefault()}>
    <svg className="block size-full" viewBox={layout ? `0 0 ${layout.width} ${layout.height}` : undefined} preserveAspectRatio="none">
      <defs>
        <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
          <rect width="100%" height="100%" fill="white"/>
          {text(maskText, { fill: 'white' })}
        </mask>
        <clipPath id={`${id}-clip`}>{text(clipText, {})}</clipPath>
        {/* The paper dissolves from the bottom of the word up, behind a soft edge, as the zoom moves it. */}
        {layout && <linearGradient ref={wipeGradient} id={`${id}-wipe-gradient`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={layout.word.y + layout.word.height} y2={layout.word.y}>
          <stop ref={wipeHide} offset={-WIPE_FEATHER} stopColor="black"/>
          <stop ref={wipeShow} offset="0" stopColor="white"/>
        </linearGradient>}
        {layout && <mask id={`${id}-wipe`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
          <rect width="100%" height="100%" fill={`url(#${id}-wipe-gradient)`}/>
        </mask>}
        {layout && <pattern id={`${id}-ruling`} patternUnits="userSpaceOnUse" x="0" y={layout.word.y} width={layout.width} height={Math.max(8, layout.size / 7)}>
          <rect y={Math.max(8, layout.size / 7) - Math.max(1, layout.size * 0.006)} width={layout.width} height={Math.max(1, layout.size * 0.006)} style={{ fill: 'var(--nb-rule)' }}/>
        </pattern>}
      </defs>
      <rect ref={backdrop} width="100%" height="100%" opacity="0" style={{ fill: 'var(--nb-backdrop-deep)' }} mask={`url(#${id}-mask)`}/>
      {/* Inside the letters, before they open: the notebook's own ruled paper. It is drawn, not
          loaded, so it is there from the first frame and nothing swaps while the page loads. */}
      {layout && <g ref={fill} clipPath={`url(#${id}-clip)`} mask={`url(#${id}-wipe)`}>
        <rect width="100%" height="100%" style={{ fill: 'var(--nb-paper)' }}/>
        <rect width="100%" height="100%" fill={`url(#${id}-ruling)`}/>
        <rect x={layout.word.x + layout.word.width * 0.06} width={Math.max(2, layout.size * 0.012)} height="100%" style={{ fill: 'var(--nb-margin)' }}/>
      </g>}
    </svg>
  </div>
}
