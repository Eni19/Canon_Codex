'use client'

import { memo, useImperativeHandle, useLayoutEffect, useMemo, useRef, type DragEvent, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import { Crosshair, Maximize, Minus, Plus, ArrowLeft, ArrowRight } from 'lucide-react'
import { canvasNodesInViewport, centerTimelinePoint, fitTimelineCanvas, worldPoint, zoomTimelineAt, type TimelineCanvasLayout, type TimelineCanvasNode } from '@/domain/timelines/timelineCanvas'
import type { Calendar } from '@/domain/worlds/calendar'
import { formatCalendarDate } from '@/domain/worlds/calendar'
import { useTimelineCamera } from './use-timeline-camera'
import styles from './timeline.module.css'

export type TimelineCanvasHandle = { locate: (id: string) => void; restoreFocus: (id?: string | null, reveal?: boolean) => void }
type Props = {
  ref: Ref<TimelineCanvasHandle>; layout: TimelineCanvasLayout; calendar: Calendar; visibleIds: Set<string>; selectedId: string | null
  initialId?: string | null; renderCard: (node: TimelineCanvasNode) => ReactNode; onOpen: (id: string) => void
  onSelect: (id: string) => void; onRecordDrop: (event: DragEvent<HTMLElement>, node?: TimelineCanvasNode) => void
}

const TimelineConstellation = memo(function TimelineConstellation({ layout, calendar, visibleIds, selectedId, onOpen, dotRadius }: Pick<Props, 'layout' | 'calendar' | 'visibleIds' | 'selectedId' | 'onOpen'> & { dotRadius: number }) {
  return <svg className={styles.connections} width={layout.width} height={layout.height} aria-hidden="true">
          {layout.nodes.slice(1).map((node, index) => {
            const previous = layout.nodes[index]
            return <path key={node.appearance.id} d={`M${previous.x} ${previous.y} L${node.x} ${node.y}`} vectorEffect="non-scaling-stroke" data-selected={selectedId === node.appearance.id || selectedId === previous.appearance.id || undefined} data-muted={!visibleIds.has(node.appearance.id) || !visibleIds.has(previous.appearance.id) || undefined} />
          })}
          {layout.nodes.map((node, index) => <g key={node.appearance.id} data-muted={!visibleIds.has(node.appearance.id) || undefined}>
            {(index === 0 || node.undated !== layout.nodes[index - 1].undated || node.appearance.date?.start.year !== layout.nodes[index - 1].appearance.date?.start.year) && <text x={node.x + 12} y={node.y - 16} className={styles.periodLabel}>{node.undated ? 'SEM DATA' : formatCalendarDate(calendar, { year: node.appearance.date!.start.year })}</text>}
            <circle data-map-interactive data-node-id={node.appearance.id} cx={node.x} cy={node.y} r={Math.max(selectedId === node.appearance.id ? 6 : 3.5, dotRadius)} className={styles.constellationPoint} data-selected={selectedId === node.appearance.id || undefined} onClick={() => { if (visibleIds.has(node.appearance.id)) onOpen(node.appearance.id) }} />
          </g>)}
        </svg>
})

const TimelineMapCard = memo(function TimelineMapCard({ node, hidden, renderCard }: { node: TimelineCanvasNode; hidden: boolean; renderCard: Props['renderCard'] }) {
  return <li data-appearance-id={node.appearance.id} data-filtered={hidden} aria-hidden={hidden} inert={hidden} className={styles.mapCardPosition} style={{ left: node.x - 144, top: node.y + 28 }}>{renderCard(node)}</li>
})

export function TimelineCosmicCanvas({ ref, layout, calendar, visibleIds, selectedId, initialId, renderCard, onOpen, onSelect, onRecordDrop }: Props) {
  const { surface, plane, zoomLabel, camera, size, snapshot, move } = useTimelineCamera(layout, initialId)
  const pendingFocus = useRef<string | null>(null)
  const rendered = useMemo(() => canvasNodesInViewport(layout, snapshot.camera, snapshot.size), [layout, snapshot])
  const visible = useMemo(() => layout.nodes.filter(node => visibleIds.has(node.appearance.id)), [layout, visibleIds])

  function locate(id: string) {
    const node = layout.nodes.find(item => item.appearance.id === id)
    if (!node) return
    onSelect(id)
    pendingFocus.current = id
    const existing = surface.current?.querySelector<HTMLButtonElement>(`[data-open-appearance="${id}"]`)
    if (existing) { pendingFocus.current = null; existing.focus({ preventScroll: true }) }
    move(centerTimelinePoint({ ...camera.current, scale: Math.max(0.8, camera.current.scale) }, node, size.current))
  }

  useImperativeHandle(ref, () => ({
    locate,
    restoreFocus(id, reveal = false) {
      const trigger = id ? surface.current?.querySelector<HTMLButtonElement>(`[data-open-appearance="${id}"]`) : null
      if (trigger) {
        const bounds = trigger.getBoundingClientRect()
        const host = surface.current!.getBoundingClientRect()
        if (bounds.top >= host.top + (host.width <= 720 ? 230 : 184) && bounds.bottom <= host.bottom - 72 && bounds.left >= host.left && bounds.right <= host.right) { trigger.focus({ preventScroll: true }); return }
      }
      if (id && reveal && visibleIds.has(id)) locate(id)
      else surface.current?.focus({ preventScroll: true })
    },
  }))

  useLayoutEffect(() => {
    if (!pendingFocus.current) return
    const trigger = surface.current?.querySelector<HTMLButtonElement>(`[data-open-appearance="${pendingFocus.current}"]`)
    if (trigger) { pendingFocus.current = null; trigger.focus({ preventScroll: true }) }
  }, [rendered, surface])

  function zoom(factor: number) {
    move(zoomTimelineAt(camera.current, { x: size.current.width / 2, y: size.current.height / 2 }, camera.current.scale * factor), true)
  }

  function step(direction: number) {
    const index = visible.findIndex(node => node.appearance.id === selectedId)
    const next = visible[Math.max(0, Math.min(visible.length - 1, index < 0 ? 0 : index + direction))]
    if (next) locate(next.appearance.id)
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    const vectors: Record<string, [number, number]> = { ArrowLeft: [120, 0], ArrowRight: [-120, 0], ArrowUp: [0, 120], ArrowDown: [0, -120] }
    if (vectors[event.key]) { event.preventDefault(); move({ ...camera.current, x: camera.current.x + vectors[event.key][0], y: camera.current.y + vectors[event.key][1] }); return }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.3) }
    else if (event.key === '-') { event.preventDefault(); zoom(1 / 1.3) }
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); const node = event.key === 'Home' ? visible[0] : visible.at(-1); if (node) locate(node.appearance.id) }
    else if (event.key === 'Enter' && selectedId) { event.preventDefault(); onOpen(selectedId) }
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const bounds = surface.current!.getBoundingClientRect()
    const point = worldPoint(camera.current, { x: event.clientX - bounds.left, y: event.clientY - bounds.top })
    const nearest = layout.nodes.reduce<TimelineCanvasNode | undefined>((best, node) => !best || Math.hypot(point.x - node.x, point.y - node.y) < Math.hypot(point.x - best.x, point.y - best.y) ? node : best, undefined)
    onRecordDrop(event, nearest)
  }

  return <>
    <div ref={surface} className={styles.canvas} role="region" aria-label="Mapa interativo da linha do tempo" aria-describedby="timeline-map-help" tabIndex={0} onKeyDown={keyDown} onDragOver={event => { if (event.dataTransfer.types.includes('application/x-canon-timeline-record')) event.preventDefault() }} onDrop={drop}>
      <div ref={plane} className={styles.plane} style={{ width: layout.width, height: layout.height }}>
        <TimelineConstellation layout={layout} calendar={calendar} visibleIds={visibleIds} selectedId={selectedId} onOpen={onOpen} dotRadius={Math.max(3.5, 2 ** Math.ceil(Math.log2(2 / snapshot.camera.scale)))} />
        <ol className={styles.mapCards} aria-label="Cartões no mapa">
          {rendered.map(node => <TimelineMapCard key={node.appearance.id} node={node} hidden={!visibleIds.has(node.appearance.id)} renderCard={renderCard} />)}
        </ol>
      </div>
    </div>
    <p id="timeline-map-help" className="sr-only">Arraste o fundo para explorar. Use scroll para zoom no cursor, Shift e scroll para deslocar, ou dois dedos para pinch. Com o mapa focado, use setas, mais e menos, Home e End. A lista Navegar acontecimentos oferece todos os cartões da seleção.</p>
    <nav className={styles.cameraControls} aria-label="Controles do mapa">
      <button type="button" aria-label="Afastar mapa" onClick={() => zoom(1 / 1.3)}><Minus size={16} aria-hidden="true" /></button>
      <output ref={zoomLabel} aria-label="Ampliação do mapa">85%</output>
      <button type="button" aria-label="Aproximar mapa" onClick={() => zoom(1.3)}><Plus size={16} aria-hidden="true" /></button>
      <span className={styles.controlSeparator} />
      <button type="button" aria-label="Centralizar seleção" onClick={() => { const node = layout.nodes.find(item => item.appearance.id === selectedId) ?? visible[0] ?? layout.nodes[0]; if (node) move(centerTimelinePoint(camera.current, node, size.current), true) }}><Crosshair size={16} aria-hidden="true" /></button>
      <button type="button" aria-label="Ajustar toda a linha à tela" onClick={() => move(fitTimelineCanvas(layout, size.current), true)}><Maximize size={16} aria-hidden="true" /></button>
    </nav>
    <nav className={styles.eventNavigation} aria-label="Navegar acontecimentos">
      <button type="button" disabled={!visible.length} aria-label="Acontecimento anterior" onClick={() => step(-1)}><ArrowLeft size={15} aria-hidden="true" /></button>
      <span>EXPLORAR</span>
      <button type="button" disabled={!visible.length} aria-label="Próximo acontecimento" onClick={() => step(1)}><ArrowRight size={15} aria-hidden="true" /></button>
    </nav>
  </>
}
