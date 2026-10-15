import { orderTimelineAppearances, type TimelineAppearance } from './timeline'
import type { Calendar } from '@/domain/worlds/calendar'

export type CanvasPoint = { x: number; y: number }
export type TimelineCamera = CanvasPoint & { scale: number }
export type CanvasSize = { width: number; height: number }
export type TimelineCanvasNode = CanvasPoint & { appearance: TimelineAppearance; index: number; undated: boolean }
export type TimelineCanvasLayout = { nodes: TimelineCanvasNode[]; width: number; height: number }
export const CANVAS_MIN_ZOOM = 0.008
export const CANVAS_MAX_ZOOM = 2.4
export const CANVAS_CARD_WIDTH = 288
export const CANVAS_CARD_HEIGHT = 218

/** Fixed world units, independent of filters, semantic scale, viewport and rendered card sizes. */
export function buildTimelineCanvasLayout(calendar: Calendar, appearances: TimelineAppearance[], orientation: 'vertical' | 'horizontal'): TimelineCanvasLayout {
  const ordered = orderTimelineAppearances(calendar, appearances)
  const all = [...ordered.dated, ...ordered.undated]
  const nodes = all.map((appearance, index) => {
    const band = Math.floor(index / 10)
    const step = index % 10
    const across = (band % 2 ? 9 - step : step) * 384
    const down = band * 432
    const drift = [0, -52, 22, -26, 58, -40, 10, 42, -16, 28][step]
    return {
      appearance, index, undated: appearance.date === null,
      x: 180 + (orientation === 'horizontal' ? across : down + drift),
      y: 64 + (orientation === 'horizontal' ? down + drift : across),
    }
  })
  return { nodes, width: Math.max(600, ...nodes.map(node => node.x + 180)), height: Math.max(400, ...nodes.map(node => node.y + 274)) }
}

export function worldPoint(camera: TimelineCamera, point: CanvasPoint): CanvasPoint {
  return { x: (point.x - camera.x) / camera.scale, y: (point.y - camera.y) / camera.scale }
}

export function zoomTimelineAt(camera: TimelineCamera, point: CanvasPoint, scale: number): TimelineCamera {
  const zoom = Math.max(CANVAS_MIN_ZOOM, Math.min(CANVAS_MAX_ZOOM, Number.isFinite(scale) ? scale : camera.scale))
  const anchor = worldPoint(camera, point)
  return { x: point.x - anchor.x * zoom, y: point.y - anchor.y * zoom, scale: zoom }
}

export function pinchTimelineCamera(camera: TimelineCamera, before: [CanvasPoint, CanvasPoint], after: [CanvasPoint, CanvasPoint]): TimelineCamera {
  const midpoint = (points: [CanvasPoint, CanvasPoint]) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 })
  const distance = (points: [CanvasPoint, CanvasPoint]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
  const start = midpoint(before)
  const end = midpoint(after)
  const zoomed = zoomTimelineAt(camera, start, camera.scale * distance(after) / Math.max(1, distance(before)))
  return { ...zoomed, x: zoomed.x + end.x - start.x, y: zoomed.y + end.y - start.y }
}

export function centerTimelinePoint(camera: TimelineCamera, point: CanvasPoint, size: CanvasSize): TimelineCamera {
  return { ...camera, x: size.width / 2 - point.x * camera.scale, y: size.height / 2 - (point.y + 110) * camera.scale }
}

export function fitTimelineCanvas(layout: TimelineCanvasLayout, size: CanvasSize): TimelineCamera {
  const scale = Math.max(CANVAS_MIN_ZOOM, Math.min(1, (size.width - 72) / layout.width, (size.height - 240) / layout.height))
  return { scale, x: (size.width - layout.width * scale) / 2, y: 176 + (size.height - 240 - layout.height * scale) / 2 }
}

/** Includes hidden-by-filter cards, so filtering only changes opacity and never mounts a new layout. */
export function canvasNodesInViewport(layout: TimelineCanvasLayout, camera: TimelineCamera, size: CanvasSize, limit = 96): TimelineCanvasNode[] {
  if (camera.scale < 0.28) return []
  const start = worldPoint(camera, { x: -320, y: -240 })
  const end = worldPoint(camera, { x: size.width + 320, y: size.height + 240 })
  return layout.nodes.filter(node => node.x + 160 >= start.x && node.x - 160 <= end.x && node.y + 266 >= start.y && node.y - 32 <= end.y)
    .sort((a, b) => Math.hypot(a.x - (start.x + end.x) / 2, a.y - (start.y + end.y) / 2) - Math.hypot(b.x - (start.x + end.x) / 2, b.y - (start.y + end.y) / 2))
    .slice(0, limit).sort((a, b) => a.index - b.index)
}
