import type { Rect } from './camera'

/**
 * Geometria comum aos canvas de Cenas e Quadros. Formas usam a convenção herdada do tldraw:
 * `x`/`y` é o canto superior esquerdo sem rotação e a rotação (radianos) gira em torno dele.
 */
export type Point = { x: number; y: number }
/** Moldura: canto superior esquerdo, tamanho e rotação em torno do canto. */
export type Frame = { x: number; y: number; w: number; h: number; rotation: number }
export type Corner = 'top_left' | 'top_right' | 'bottom_right' | 'bottom_left'
export type Edge = 'top' | 'right' | 'bottom' | 'left'
export type ResizeHandle = Corner | Edge

export const ROTATION_SNAP = Math.PI / 12

export const rotatePoint = (p: Point, angle: number): Point => {
  const cos = Math.cos(angle), sin = Math.sin(angle)
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }
}
export const toLocal = (frame: Frame, p: Point): Point => rotatePoint({ x: p.x - frame.x, y: p.y - frame.y }, -frame.rotation)
export const toPage = (frame: Frame, p: Point): Point => {
  const r = rotatePoint(p, frame.rotation)
  return { x: frame.x + r.x, y: frame.y + r.y }
}

export const frameCorners = (frame: Frame): Point[] =>
  [{ x: 0, y: 0 }, { x: frame.w, y: 0 }, { x: frame.w, y: frame.h }, { x: 0, y: frame.h }].map((p) => toPage(frame, p))

export const frameCenter = (frame: Frame) => toPage(frame, { x: frame.w / 2, y: frame.h / 2 })

export function boundsOf(points: Point[]): Rect {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const p of points) { left = Math.min(left, p.x); top = Math.min(top, p.y); right = Math.max(right, p.x); bottom = Math.max(bottom, p.y) }
  return { x: left, y: top, w: right - left, h: bottom - top }
}

/** Uma moldura sozinha é usada como está; várias usam a caixa que as envolve, sem rotação. */
export function selectionFrameOf(frames: Frame[]): Frame | null {
  if (frames.length === 0) return null
  if (frames.length === 1) return frames[0]
  return { ...boundsOf(frames.flatMap(frameCorners)), rotation: 0 }
}

/** Acerto com margem, como o `hitInside` com `hitTestMargin` do tldraw. */
export function hitsFrame(frame: Frame, point: Point, margin = 0) {
  const local = toLocal(frame, point)
  return local.x >= -margin && local.y >= -margin && local.x <= frame.w + margin && local.y <= frame.h + margin
}

/** A moldura toca o retângulo? (teste de eixos separadores entre dois retângulos). */
export function frameIntersectsRect(frame: Frame, rect: Rect) {
  const a = frameCorners(frame)
  const b = [{ x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y }, { x: rect.x + rect.w, y: rect.y + rect.h }, { x: rect.x, y: rect.y + rect.h }]
  const axes = [{ x: 1, y: 0 }, { x: 0, y: 1 }, rotatePoint({ x: 1, y: 0 }, frame.rotation), rotatePoint({ x: 0, y: 1 }, frame.rotation)]
  for (const axis of axes) {
    const project = (points: Point[]) => points.map((p) => p.x * axis.x + p.y * axis.y)
    const pa = project(a), pb = project(b)
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false
  }
  return true
}

export const handlePoint = (handle: ResizeHandle, w: number, h: number): Point => ({
  top_left: { x: 0, y: 0 }, top_right: { x: w, y: 0 }, bottom_right: { x: w, y: h }, bottom_left: { x: 0, y: h },
  top: { x: w / 2, y: 0 }, right: { x: w, y: h / 2 }, bottom: { x: w / 2, y: h }, left: { x: 0, y: h / 2 },
})[handle]
export const oppositeHandle: Record<ResizeHandle, ResizeHandle> = {
  top_left: 'bottom_right', top_right: 'bottom_left', bottom_right: 'top_left', bottom_left: 'top_right',
  top: 'bottom', right: 'left', bottom: 'top', left: 'right',
}

export type ResizeTransform = { frame: Frame; anchor: Point; sx: number; sy: number }

/**
 * Escala pedida ao arrastar uma alça. O ponto oposto fica parado (ou o centro, com `fromCenter`).
 * Com `lockAspect`, a escala é a mesma nos dois eixos, como o Shift do tldraw. Bordas só mudam
 * o próprio eixo, a não ser com proporção travada.
 */
export function resizeTransform(frame: Frame, handle: ResizeHandle, pointer: Point, fromCenter = false, lockAspect = false): ResizeTransform {
  const anchor = fromCenter ? { x: frame.w / 2, y: frame.h / 2 } : handlePoint(oppositeHandle[handle], frame.w, frame.h)
  const grip = handlePoint(handle, frame.w, frame.h)
  const local = toLocal(frame, pointer)
  const ratio = (value: number, from: number, to: number) => to === from ? 1 : (value - from) / (to - from)
  const vertical = handle === 'top' || handle === 'bottom', horizontal = handle === 'left' || handle === 'right'
  let sx = horizontal || !vertical ? ratio(local.x, anchor.x, grip.x) : 1
  let sy = vertical || !horizontal ? ratio(local.y, anchor.y, grip.y) : 1
  if (lockAspect) {
    const s = vertical ? sy : horizontal ? sx : Math.abs(sx) > Math.abs(sy) ? sx : sy
    sx = s; sy = s
  }
  return { frame, anchor, sx, sy }
}

/** Leva um ponto da página pela transformação de redimensionamento. */
export function resizePoint(t: ResizeTransform, p: Point): Point {
  const local = toLocal(t.frame, p)
  return toPage(t.frame, { x: t.anchor.x + (local.x - t.anchor.x) * t.sx, y: t.anchor.y + (local.y - t.anchor.y) * t.sy })
}

/** Gira em torno de `center`; com `snap` (Shift), a rotação final cai em passos de 15°. */
export function rotationDelta(center: Point, start: Point, pointer: Point, baseRotation: number, snap = false) {
  let delta = Math.atan2(pointer.y - center.y, pointer.x - center.x) - Math.atan2(start.y - center.y, start.x - center.x)
  if (snap) delta = Math.round((baseRotation + delta) / ROTATION_SNAP) * ROTATION_SNAP - baseRotation
  return delta
}

export function rotateAround<T extends { x: number; y: number; rotation: number }>(shape: T, center: Point, delta: number): T {
  const offset = rotatePoint({ x: shape.x - center.x, y: shape.y - center.y }, delta)
  return { ...shape, x: center.x + offset.x, y: center.y + offset.y, rotation: normalizeAngle(shape.rotation + delta) }
}

export const normalizeAngle = (angle: number) => {
  const full = Math.PI * 2
  const value = ((angle % full) + full) % full
  return Math.abs(value - full) < 1e-9 ? 0 : value
}

export const snapToGrid = (value: number, cellSize: number, offset: number) => Math.round((value - offset) / cellSize) * cellSize + offset

export const distanceSq = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2
