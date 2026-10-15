'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { centerTimelinePoint, pinchTimelineCamera, zoomTimelineAt, type TimelineCamera, type TimelineCanvasLayout } from '@/domain/timelines/timelineCanvas'

/** The live camera paints once per frame. React only receives viewport/culling bucket changes. */
export function useTimelineCamera(layout: TimelineCanvasLayout, initialId?: string | null) {
  const surface = useRef<HTMLDivElement>(null)
  const plane = useRef<HTMLDivElement>(null)
  const zoomLabel = useRef<HTMLOutputElement>(null)
  const camera = useRef<TimelineCamera>({ x: 0, y: 0, scale: 0.85 })
  const size = useRef({ width: 1000, height: 800 })
  const schedule = useRef<() => void>(() => {})
  const initialized = useRef(false)
  const initialAppearance = useRef(initialId)
  const controlFrame = useRef(0)
  const [snapshot, setSnapshot] = useState({ camera: { x: 0, y: 0, scale: 0.85 }, size: { width: 1000, height: 800 } })

  const move = useCallback((next: TimelineCamera, animated = false) => {
    cancelAnimationFrame(controlFrame.current)
    if (!animated || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      camera.current = next
      schedule.current()
      return
    }
    const from = { ...camera.current }
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 200)
      const eased = 1 - (1 - progress) ** 3
      camera.current = { x: from.x + (next.x - from.x) * eased, y: from.y + (next.y - from.y) * eased, scale: from.scale + (next.scale - from.scale) * eased }
      schedule.current()
      if (progress < 1) controlFrame.current = requestAnimationFrame(tick)
    }
    controlFrame.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    const host = surface.current
    const content = plane.current
    if (!host || !content) return
    let frame = 0
    let bucket = ''
    let draggedAt = -Infinity
    let travelled = 0
    const pointers = new Map<number, { x: number; y: number }>()
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const paint = () => {
      frame = 0
      const current = camera.current
      content.style.setProperty('transform', `translate3d(${current.x}px,${current.y}px,0) scale(${current.scale})`)
      content.setAttribute('data-ready', 'true')
      host.setAttribute('data-camera', JSON.stringify(current))
      zoomLabel.current?.replaceChildren(`${Math.round(current.scale * 1000) / 10}%`)
      const nextBucket = [Math.floor(-current.x / current.scale / 180), Math.floor(-current.y / current.scale / 180), Math.floor(Math.log(current.scale) * 16), size.current.width, size.current.height].join(':')
      if (nextBucket !== bucket) { bucket = nextBucket; setSnapshot({ camera: { ...current }, size: { ...size.current } }) }
    }
    schedule.current = () => { if (!frame) frame = requestAnimationFrame(paint) }
    const measure = () => {
      size.current = { width: host.clientWidth, height: host.clientHeight }
      if (!initialized.current && size.current.width && size.current.height) {
        initialized.current = true
        const point = layout.nodes.find(node => node.appearance.id === initialAppearance.current) ?? layout.nodes[0] ?? { x: 180, y: 64 }
        camera.current = centerTimelinePoint({ x: 0, y: 0, scale: size.current.width < 600 ? 0.8 : 0.9 }, point, size.current)
        camera.current = { ...camera.current, x: (size.current.width < 600 ? size.current.width / 2 : size.current.width * 0.2) - point.x * camera.current.scale }
        // Leave room for the floating header and filters above the first event.
        camera.current = { ...camera.current, y: Math.max(camera.current.y, 230 - point.y * camera.current.scale) }
      }
      schedule.current()
    }
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    measure()
    const localPoint = (x: number, y: number) => { const bounds = host.getBoundingClientRect(); return { x: x - bounds.left, y: y - bounds.top } }
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      cancelAnimationFrame(controlFrame.current)
      const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1
      if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.5) {
        camera.current = { ...camera.current, x: camera.current.x - (event.shiftKey ? event.deltaY : event.deltaX) * factor, y: camera.current.y - (event.shiftKey ? event.deltaX : event.deltaY) * factor }
      } else {
        const delta = Math.max(-240, Math.min(240, event.deltaY * factor))
        camera.current = zoomTimelineAt(camera.current, localPoint(event.clientX, event.clientY), camera.current.scale * Math.exp(-delta * (event.ctrlKey ? 0.008 : 0.002)))
      }
      schedule.current()
    }
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || pointers.size >= 2 || (event.target instanceof Element && event.target.closest('[data-map-interactive]'))) return
      event.preventDefault()
      cancelAnimationFrame(controlFrame.current)
      pointers.set(event.pointerId, localPoint(event.clientX, event.clientY))
      if (pointers.size === 1) travelled = 0
      try { host.setPointerCapture(event.pointerId) } catch { /* Synthetic gesture tests have no active native pointer. */ }
      host.setAttribute('data-panning', 'true')
      host.focus({ preventScroll: true })
    }
    const pointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId)
      if (!previous) return
      const before = [...pointers.values()]
      const next = localPoint(event.clientX, event.clientY)
      pointers.set(event.pointerId, next)
      travelled += Math.hypot(next.x - previous.x, next.y - previous.y)
      camera.current = pointers.size === 2
        ? pinchTimelineCamera(camera.current, before as [{ x: number; y: number }, { x: number; y: number }], [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }])
        : { ...camera.current, x: camera.current.x + next.x - previous.x, y: camera.current.y + next.y - previous.y }
      schedule.current()
    }
    const up = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return
      if (travelled > 4) draggedAt = performance.now()
      if (!pointers.size) host.removeAttribute('data-panning')
      // Remaining pointers already contain their latest positions: continuing with one finger has no jump.
    }
    const click = (event: MouseEvent) => { if (performance.now() - draggedAt < 250) { event.preventDefault(); event.stopPropagation() } }
    const reduce = () => { cancelAnimationFrame(controlFrame.current) }
    host.addEventListener('wheel', wheel, { passive: false })
    host.addEventListener('pointerdown', down)
    host.addEventListener('pointermove', pointerMove)
    host.addEventListener('pointerup', up)
    host.addEventListener('pointercancel', up)
    host.addEventListener('lostpointercapture', up)
    host.addEventListener('click', click, true)
    preference.addEventListener('change', reduce)
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame); cancelAnimationFrame(controlFrame.current)
      host.removeEventListener('wheel', wheel); host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', pointerMove)
      host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', up); host.removeEventListener('lostpointercapture', up); host.removeEventListener('click', click, true)
      preference.removeEventListener('change', reduce)
    }
  }, [layout])

  return { surface, plane, zoomLabel, camera, size, snapshot, move }
}
