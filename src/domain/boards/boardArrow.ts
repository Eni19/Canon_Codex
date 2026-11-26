import { hitsFrame, rotatePoint, toPage, type Frame, type Point } from '@/domain/canvas/geometry'
import type { ArrowBinding, BoardArrow, BoardSize } from './boardCanvas'

/** Espessuras do tldraw: `strokeWidth` do tema (2) × `STROKE_SIZES`. */
export const STROKE_WIDTHS: Record<BoardSize, number> = { s: 2, m: 3.5, l: 5, xl: 10 }
/** Distância entre a ponta da seta e a borda da forma vinculada (`BOUND_ARROW_OFFSET`). */
export const BOUND_ARROW_OFFSET = 10
export const MIN_ARROW_LENGTH = 10
const ARC_SEGMENTS = 48

export type FrameOf = (shapeId: string) => Frame | null

const sub = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: Point, b: Point) => ({ x: a.x + b.x, y: a.y + b.y })
const mul = (a: Point, k: number) => ({ x: a.x * k, y: a.y * k })
const len = (a: Point) => Math.hypot(a.x, a.y)
const lerp = (a: Point, b: Point, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
export const arrowFrame = (arrow: Pick<BoardArrow, 'x' | 'y' | 'rotation'>): Frame => ({ x: arrow.x, y: arrow.y, w: 0, h: 0, rotation: arrow.rotation })
export const arrowStrokeWidth = (arrow: Pick<BoardArrow, 'size' | 'scale'>) => STROKE_WIDTHS[arrow.size] * arrow.scale

/** Ponto de vínculo na página: a âncora (precisa) ou o centro da forma. */
export function bindingPoint(binding: ArrowBinding, frame: Frame, forcePrecise = false): Point {
  const anchor = binding.isPrecise || forcePrecise ? { x: Math.min(1, Math.max(0, binding.anchor.x)), y: Math.min(1, Math.max(0, binding.anchor.y)) } : { x: 0.5, y: 0.5 }
  return toPage(frame, { x: anchor.x * frame.w, y: anchor.y * frame.h })
}

/** Pontas da seta na página, antes de recortar nas formas: alças livres ou pontos de vínculo. */
export function arrowTerminals(arrow: BoardArrow, frameOf: FrameOf): { start: Point; end: Point } {
  const own = arrowFrame(arrow)
  const startFrame = arrow.startBinding ? frameOf(arrow.startBinding.shapeId) : null
  const endFrame = arrow.endBinding ? frameOf(arrow.endBinding.shapeId) : null
  const doubleBound = !!(startFrame && endFrame && arrow.startBinding?.shapeId === arrow.endBinding?.shapeId)
  return {
    start: arrow.startBinding && startFrame ? bindingPoint(arrow.startBinding, startFrame, doubleBound) : toPage(own, arrow.start),
    end: arrow.endBinding && endFrame ? bindingPoint(arrow.endBinding, endFrame, doubleBound) : toPage(own, arrow.end),
  }
}

/** Ponto do meio do arco: o meio da corda deslocado por `bend` na perpendicular. */
export function bendHandle(start: Point, end: Point, bend: number): Point {
  const d = sub(end, start), l = len(d)
  const u = l ? mul(d, 1 / l) : { x: 0, y: 0 }
  return add(lerp(start, end, 0.5), mul({ x: -u.y, y: u.x }, bend))
}

/** Bend que faz o arco passar pelo ponto `p` (arraste da alça do meio). */
export function bendThrough(start: Point, end: Point, p: Point): number {
  const d = sub(end, start), l = len(d)
  if (!l) return 0
  const u = mul(d, 1 / l), m = lerp(start, end, 0.5), v = sub(p, m)
  return v.x * -u.y + v.y * u.x
}

function arcPoints(a: Point, m: Point, b: Point): Point[] {
  const d = 2 * (a.x * (m.y - b.y) + m.x * (b.y - a.y) + b.x * (a.y - m.y))
  if (Math.abs(d) < 1e-6) return [a, b]
  const sq = (p: Point) => p.x * p.x + p.y * p.y
  const center = {
    x: (sq(a) * (m.y - b.y) + sq(m) * (b.y - a.y) + sq(b) * (a.y - m.y)) / d,
    y: (sq(a) * (b.x - m.x) + sq(m) * (a.x - b.x) + sq(b) * (m.x - a.x)) / d,
  }
  const r = len(sub(a, center))
  const angle = (p: Point) => Math.atan2(p.y - center.y, p.x - center.x)
  const a0 = angle(a), am = angle(m), a1 = angle(b)
  const norm = (t: number) => ((t % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  // Sentido que passa pelo ponto do meio.
  let sweep = norm(a1 - a0)
  if (norm(am - a0) > sweep) sweep -= Math.PI * 2
  return Array.from({ length: ARC_SEGMENTS + 1 }, (_, i) => {
    const t = a0 + sweep * i / ARC_SEGMENTS
    return { x: center.x + Math.cos(t) * r, y: center.y + Math.sin(t) * r }
  })
}

export function pathLength(points: Point[]) {
  let total = 0
  for (let i = 1; i < points.length; i++) total += len(sub(points[i], points[i - 1]))
  return total
}

/** Ponto a uma distância ao longo do caminho (do começo). */
export function pointAlong(points: Point[], distance: number): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  let left = Math.max(0, distance)
  for (let i = 1; i < points.length; i++) {
    const segment = len(sub(points[i], points[i - 1]))
    if (left <= segment) return segment ? lerp(points[i - 1], points[i], left / segment) : points[i]
    left -= segment
  }
  return points[points.length - 1]
}

/** Corta o começo do caminho em `distance`. */
function trimStart(points: Point[], distance: number): Point[] {
  let left = distance
  for (let i = 1; i < points.length; i++) {
    const segment = len(sub(points[i], points[i - 1]))
    if (left < segment) return [lerp(points[i - 1], points[i], left / segment), ...points.slice(i)]
    left -= segment
  }
  return [points[points.length - 1]]
}
const trimEnd = (points: Point[], distance: number) => trimStart([...points].reverse(), distance).reverse()

/** Corta o caminho onde ele sai da moldura vinculada (a ponta para na borda). */
function clipStartToFrame(points: Point[], frame: Frame): Point[] {
  if (!hitsFrame(frame, points[0])) return points
  for (let i = 1; i < points.length; i++) {
    if (hitsFrame(frame, points[i])) continue
    let inside = points[i - 1], outside = points[i]
    for (let k = 0; k < 24; k++) {
      const mid = lerp(inside, outside, 0.5)
      if (hitsFrame(frame, mid)) inside = mid; else outside = mid
    }
    return [outside, ...points.slice(i)]
  }
  return points
}
const clipEndToFrame = (points: Point[], frame: Frame) => clipStartToFrame([...points].reverse(), frame).reverse()

export type ArrowGeometry = { points: Point[]; start: Point; end: Point; handle: Point; valid: boolean }

/**
 * Caminho visível da seta na página, como no tldraw: as pontas vinculadas param na borda da
 * forma e, se têm cabeça, recuam mais `BOUND_ARROW_OFFSET` + metade da espessura.
 */
export function arrowGeometry(arrow: BoardArrow, frameOf: FrameOf): ArrowGeometry {
  const { start, end } = arrowTerminals(arrow, frameOf)
  const handle = bendHandle(start, end, arrow.bend)
  let points = Math.abs(arrow.bend) < 1e-6 ? [start, end] : arcPoints(start, handle, end)
  const startFrame = arrow.startBinding && !arrow.startBinding.isExact ? frameOf(arrow.startBinding.shapeId) : null
  const endFrame = arrow.endBinding && !arrow.endBinding.isExact ? frameOf(arrow.endBinding.shapeId) : null
  const sameShape = !!(startFrame && endFrame && arrow.startBinding?.shapeId === arrow.endBinding?.shapeId)
  if (!sameShape) {
    if (startFrame) points = clipStartToFrame(points, startFrame)
    if (endFrame) points = clipEndToFrame(points, endFrame)
    const sw = arrowStrokeWidth(arrow)
    const offsetStart = startFrame && arrow.arrowheadStart !== 'none' ? (BOUND_ARROW_OFFSET + sw / 2) * arrow.scale : 0
    const offsetEnd = endFrame && arrow.arrowheadEnd !== 'none' ? (BOUND_ARROW_OFFSET + sw / 2) * arrow.scale : 0
    if (pathLength(points) - offsetStart - offsetEnd > MIN_ARROW_LENGTH * arrow.scale) {
      if (offsetStart) points = trimStart(points, offsetStart)
      if (offsetEnd) points = trimEnd(points, offsetEnd)
    }
  }
  return { points, start, end, handle, valid: pathLength(points) > 0 }
}

/** Ponta e ponto de base da cabeça (`getArrowPoints` do tldraw). */
export function arrowheadBase(points: Point[], side: 'start' | 'end', strokeWidth: number) {
  const path = side === 'end' ? [...points].reverse() : points
  const length = Math.min(strokeWidth * 3, Math.max(strokeWidth, pathLength(points) / 5))
  return { point: path[0], int: pointAlong(path, length) }
}

/** Contorno da cabeça em pontos (aberta para `arrow`, fechada para as outras). */
export function arrowheadShape(kind: BoardArrow['arrowheadEnd'], point: Point, int: Point): { points: Point[]; closed: boolean; circle?: { center: Point; r: number } } | null {
  const rot = (p: Point, angle: number) => add(point, rotatePoint(sub(p, point), angle))
  const wing = Math.PI / 6
  switch (kind) {
    case 'none': return null
    case 'arrow': return { points: [rot(int, wing), point, rot(int, -wing)], closed: false }
    case 'triangle': return { points: [rot(int, wing), rot(int, -wing), point], closed: true }
    case 'inverted': {
      const d = mul(sub(int, point), 0.5), perp = rotatePoint(d, Math.PI / 2)
      return { points: [add(point, perp), int, sub(point, perp)], closed: true }
    }
    case 'dot': {
      const center = lerp(point, int, 0.45)
      return { points: [], closed: true, circle: { center, r: len(sub(center, point)) } }
    }
    case 'diamond': {
      const pb = lerp(point, int, 0.75), pl = rot(pb, Math.PI / 4), pr = rot(pb, -Math.PI / 4)
      const pq = lerp(pl, pr, 0.5), far = add(pq, sub(pq, point))
      return { points: [far, pr, point, pl], closed: true }
    }
    case 'square': {
      const pb = lerp(point, int, 0.85), d = mul(sub(pb, point), 0.5), perp = rotatePoint(d, Math.PI / 2)
      return { points: [sub(point, perp), add(point, perp), add(pb, perp), sub(pb, perp)], closed: true }
    }
    case 'bar': case 'pipe': {
      const d = sub(int, point), perp = mul(rotatePoint(d, Math.PI / 2), 0.5)
      return { points: [add(point, perp), sub(point, perp)], closed: false }
    }
  }
}

/** Distância do ponto ao caminho, para acertar o clique numa seta. */
export function distanceToPath(points: Point[], p: Point) {
  let best = Infinity
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], ab = sub(b, a), l2 = ab.x * ab.x + ab.y * ab.y
    const t = l2 ? Math.min(1, Math.max(0, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2)) : 0
    best = Math.min(best, len(sub(p, lerp(a, b, t))))
  }
  return points.length === 1 ? len(sub(p, points[0])) : best
}
