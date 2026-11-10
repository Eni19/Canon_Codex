'use client'

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { animate } from 'animejs'
import { Move, RotateCcw, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ContentDocument } from '@/domain/content/contentDocument'
import type { CharacterTheme } from '@/domain/entities/characterTheme'
import { COVER_FRAMING_LIMITS, isDefaultCoverFraming, type CoverFraming } from '@/domain/entities/coverFraming'

/** What the page would show right now, read from the form when the studio opens. */
export interface FramingPreviewSnapshot {
  title: string
  status: string
  tags: string[]
  aliases: string[]
  properties: Record<string, unknown>
  content: ContentDocument
}

/**
 * Props the preview spreads on the element that holds the framed image. That element must
 * contain the image marked `data-framing-target`; the image's parent box is the frame and its CSS
 * `transform-origin` is where zoom grows from, so any page layout works without special cases.
 */
export type FramingArtBinding = HTMLAttributes<HTMLElement> & { ref: (element: HTMLElement | null) => void }

const FramingArtContext = createContext<FramingArtBinding | null>(null)

/** Read by the preview components, so the studio never hands ref-reading handlers to a render call. */
export function useFramingArt(): FramingArtBinding {
  const art = useContext(FramingArtContext)
  if (!art) throw new Error('useFramingArt must be used inside CoverFramingStudio')
  return art
}

const round = (value: number) => Math.round(value * 100) / 100
const clampOffset = (value: number) => round(Math.min(COVER_FRAMING_LIMITS.offset, Math.max(-COVER_FRAMING_LIMITS.offset, value)))
const clampScale = (value: number) => round(Math.min(COVER_FRAMING_LIMITS.maxScale, Math.max(COVER_FRAMING_LIMITS.minScale, value)))
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const EASE_OUT = 'outExpo'

/**
 * Full-screen framing studio. The controls take the sidebar's place (same 16rem width), so the
 * preview on the right is the record's page at its real size: what you frame is what you get.
 */
export function CoverFramingStudio({
  initialFraming,
  defaultFraming,
  theme,
  renderPreview,
  onApply,
  onClose,
}: {
  initialFraming: CoverFraming
  defaultFraming: CoverFraming
  theme: CharacterTheme
  renderPreview: (framing: CoverFraming) => ReactNode
  onApply: (framing: CoverFraming) => void
  onClose: () => void
}) {
  const [framing, setFraming] = useState(initialFraming)
  const [dragging, setDragging] = useState(false)
  const framingRef = useRef(framing)
  const panelRef = useRef<HTMLElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const artRef = useRef<HTMLElement | null>(null)
  const drag = useRef<{ pointerId: number; startX: number; startY: number; origin: CoverFraming; width: number; height: number } | null>(null)
  const closing = useRef(false)

  const update = useCallback((next: CoverFraming) => {
    framingRef.current = next
    setFraming(next)
  }, [])

  // Entrance: the panel slides in from where the sidebar is, the page settles into place.
  useLayoutEffect(() => {
    artRef.current?.focus({ preventScroll: true })
    if (reducedMotion() || !panelRef.current || !previewRef.current) return
    const panel = animate(panelRef.current, { opacity: { from: 0, to: 1, duration: 260, ease: 'outQuad' }, translateX: { from: -16, to: 0, duration: 520, ease: EASE_OUT } })
    const preview = animate(previewRef.current, { opacity: { from: 0, to: 1, duration: 320, ease: 'outQuad' }, scale: { from: 0.985, to: 1, duration: 620, ease: EASE_OUT } })
    return () => { panel.revert(); preview.revert() }
  }, [])

  const close = useCallback((apply: boolean) => {
    if (closing.current) return
    closing.current = true
    const finish = () => { if (apply) onApply(framingRef.current); onClose() }
    if (reducedMotion() || !panelRef.current || !previewRef.current) return finish()
    animate([panelRef.current, previewRef.current], { opacity: 0, duration: 160, ease: 'inQuad', onComplete: finish })
  }, [onApply, onClose])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') close(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close])

  /** The frame (image's parent box) and the zoom origin inside it, in viewport pixels. */
  function measure() {
    const target = artRef.current?.querySelector<HTMLElement>('[data-framing-target]')
    const frame = target?.parentElement?.getBoundingClientRect()
    if (!target || !frame) return null
    const [originX, originY] = getComputedStyle(target).transformOrigin.split(' ').map((value) => parseFloat(value) || 0)
    return { frame, originX: frame.left + originX, originY: frame.top + originY }
  }

  // Wheel zoom keeps the point under the cursor still. Native listener: React's wheel is passive.
  useEffect(() => {
    const element = artRef.current
    if (!element) return
    function onWheel(event: WheelEvent) {
      event.preventDefault()
      const box = measure()
      if (!box) return
      const current = framingRef.current
      const scale = clampScale(current.scale * Math.exp(-event.deltaY * 0.0015))
      const tx = (current.x / 100) * box.frame.width
      const ty = (current.y / 100) * box.frame.height
      const qx = (event.clientX - box.originX - tx) / current.scale
      const qy = (event.clientY - box.originY - ty) / current.scale
      update({
        x: clampOffset(((tx + (current.scale - scale) * qx) / box.frame.width) * 100),
        y: clampOffset(((ty + (current.scale - scale) * qy) / box.frame.height) * 100),
        scale,
      })
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [update])

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || drag.current) return // one pointer at a time
    const box = measure()
    if (!box) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: framingRef.current, width: box.frame.width, height: box.frame.height }
    setDragging(true)
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const state = drag.current
    if (!state || state.pointerId !== event.pointerId) return
    update({
      ...state.origin,
      x: clampOffset(state.origin.x + ((event.clientX - state.startX) / state.width) * 100),
      y: clampOffset(state.origin.y + ((event.clientY - state.startY) / state.height) * 100),
    })
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    setDragging(false)
  }

  function onArtKeyDown(event: KeyboardEvent<HTMLElement>) {
    const step = event.shiftKey ? 5 : 1
    const current = framingRef.current
    const moves: Record<string, Partial<CoverFraming>> = {
      ArrowLeft: { x: clampOffset(current.x - step) },
      ArrowRight: { x: clampOffset(current.x + step) },
      ArrowUp: { y: clampOffset(current.y - step) },
      ArrowDown: { y: clampOffset(current.y + step) },
      '+': { scale: clampScale(current.scale + 0.05 * step) },
      '=': { scale: clampScale(current.scale + 0.05 * step) },
      '-': { scale: clampScale(current.scale - 0.05 * step) },
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    update({ ...current, ...move })
  }

  function reset() {
    if (reducedMotion()) return update(defaultFraming)
    const proxy = { ...framingRef.current }
    animate(proxy, { ...defaultFraming, duration: 650, ease: EASE_OUT, onUpdate: () => update({ x: round(proxy.x), y: round(proxy.y), scale: round(proxy.scale) }) })
  }

  const setArt = useCallback((element: HTMLElement | null) => { artRef.current = element }, [])
  const art: FramingArtBinding = {
    ref: setArt,
    tabIndex: 0,
    role: 'application',
    'aria-label': 'Imagem: arraste para mover, setas para ajustar, + e − para o zoom',
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onKeyDown: onArtKeyDown,
    className: `touch-none select-none outline-none transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-ring ${dragging ? 'cursor-grabbing ring-1 ring-primary/50' : 'cursor-grab hover:ring-1 hover:ring-primary/30'}`,
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Ajustar enquadramento da imagem" data-character-theme={theme} className="fixed inset-0 z-50 flex bg-background text-foreground">
      <aside ref={panelRef} className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
          <h2 className="font-serif text-lg font-medium">Enquadramento</h2>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Arraste a imagem para movê-la e use a roda do mouse para aproximar. Com a imagem selecionada, as setas também movem.
          </p>

          <FramingSlider icon={<Move className="size-3.5"/>} label="Horizontal" value={framing.x} min={-COVER_FRAMING_LIMITS.offset} max={COVER_FRAMING_LIMITS.offset} step={0.5} display={`${Math.round(framing.x)}%`} onChange={(x) => update({ ...framingRef.current, x })}/>
          <FramingSlider icon={<Move className="size-3.5 rotate-90"/>} label="Vertical" value={framing.y} min={-COVER_FRAMING_LIMITS.offset} max={COVER_FRAMING_LIMITS.offset} step={0.5} display={`${Math.round(framing.y)}%`} onChange={(y) => update({ ...framingRef.current, y })}/>
          <FramingSlider icon={<ZoomIn className="size-3.5"/>} label="Zoom" value={framing.scale} min={COVER_FRAMING_LIMITS.minScale} max={COVER_FRAMING_LIMITS.maxScale} step={0.01} display={`${Math.round(framing.scale * 100)}%`} onChange={(scale) => update({ ...framingRef.current, scale })}/>

          <Button type="button" variant="outline" onClick={reset} disabled={isDefaultCoverFraming(framing, defaultFraming)} className="self-start">
            <RotateCcw/>Restaurar padrão
          </Button>
        </div>

        <div className="flex justify-end gap-2 border-t border-sidebar-border px-4 py-3">
          <Button type="button" variant="ghost" onClick={() => close(false)}>Cancelar</Button>
          <Button type="button" onClick={() => close(true)} className="active:scale-[0.97]">Aplicar</Button>
        </div>
      </aside>

      <div
        ref={previewRef}
        className="relative min-w-0 flex-1 overflow-hidden"
        // The preview is a picture of the page: its links must not navigate away mid-edit.
        onClickCapture={(event) => { if ((event.target as HTMLElement).closest('a')) event.preventDefault() }}
      >
        <FramingArtContext.Provider value={art}>{renderPreview(framing)}</FramingArtContext.Provider>
      </div>
    </div>,
    document.body,
  )
}

function FramingSlider({ icon, label, value, min, max, step, display, onChange }: { icon: ReactNode; label: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void }) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-medium">{icon}{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{display}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-(--primary)"/>
    </label>
  )
}
