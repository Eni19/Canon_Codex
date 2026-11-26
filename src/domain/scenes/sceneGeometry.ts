import { TOKEN_MIN_HEIGHT, TOKEN_MIN_WIDTH, type SceneCanvasShape, type SceneToken } from './sceneCanvas'
import type { Rect } from './sceneCamera'

export type Point = { x: number; y: number }
/** Moldura da seleção: canto superior esquerdo, tamanho e rotação em torno do canto. */
export type Frame = { x: number; y: number; w: number; h: number; rotation: number }
export type Corner = 'top_left' | 'top_right' | 'bottom_right' | 'bottom_left'
export type Edge = 'top' | 'right' | 'bottom' | 'left'
export type ResizeHandle = Corner | Edge

export const ROTATION_SNAP = Math.PI / 12

const rotate = (p: Point, angle: number): Point => {
  const cos = Math.cos(angle), sin = Math.sin(angle)
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }
}
export const toLocal = (frame: Frame, p: Point): Point => rotate({ x: p.x - frame.x, y: p.y - frame.y }, -frame.rotation)
export const toPage = (frame: Frame, p: Point): Point => {
  const r = rotate(p, frame.rotation)
  return { x: frame.x + r.x, y: frame.y + r.y }
}

export const shapeFrame = (shape: Pick<SceneCanvasShape, 'x' | 'y' | 'w' | 'h' | 'rotation'>): Frame => ({ x: shape.x, y: shape.y, w: shape.w, h: shape.h, rotation: shape.rotation })

export const frameCorners = (frame: Frame): Point[] =>
  [{ x: 0, y: 0 }, { x: frame.w, y: 0 }, { x: frame.w, y: frame.h }, { x: 0, y: frame.h }].map((p) => toPage(frame, p))

export const frameCenter = (frame: Frame) => toPage(frame, { x: frame.w / 2, y: frame.h / 2 })

export function boundsOf(points: Point[]): Rect {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const p of points) { left = Math.min(left, p.x); top = Math.min(top, p.y); right = Math.max(right, p.x); bottom = Math.max(bottom, p.y) }
  return { x: left, y: top, w: right - left, h: bottom - top }
}

/** Uma forma usa a própria moldura girada; várias usam a caixa que as envolve, sem rotação. */
export function selectionFrame(shapes: SceneCanvasShape[]): Frame | null {
  if (shapes.length === 0) return null
  if (shapes.length === 1) return shapeFrame(shapes[0])
  const box = boundsOf(shapes.flatMap((shape) => frameCorners(shapeFrame(shape))))
  return { ...box, rotation: 0 }
}

/** Acerto com margem, como o `hitInside` com `hitTestMargin` do tldraw. */
export function hitsFrame(frame: Frame, point: Point, margin = 0) {
  const local = toLocal(frame, point)
  return local.x >= -margin && local.y >= -margin && local.x <= frame.w + margin && local.y <= frame.h + margin
}

/** Seleção por área: a forma entra se a sua moldura toca o retângulo (teste de eixos separadores). */
export function frameIntersectsRect(frame: Frame, rect: Rect) {
  const a = frameCorners(frame)
  const b = [{ x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y }, { x: rect.x + rect.w, y: rect.y + rect.h }, { x: rect.x, y: rect.y + rect.h }]
  const axes = [{ x: 1, y: 0 }, { x: 0, y: 1 }, rotate({ x: 1, y: 0 }, frame.rotation), rotate({ x: 0, y: 1 }, frame.rotation)]
  for (const axis of axes) {
    const project = (points: Point[]) => points.map((p) => p.x * axis.x + p.y * axis.y)
    const pa = project(a), pb = project(b)
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false
  }
  return true
}

const handlePoint = (handle: ResizeHandle, w: number, h: number): Point => ({
  top_left: { x: 0, y: 0 }, top_right: { x: w, y: 0 }, bottom_right: { x: w, y: h }, bottom_left: { x: 0, y: h },
  top: { x: w / 2, y: 0 }, right: { x: w, y: h / 2 }, bottom: { x: w / 2, y: h }, left: { x: 0, y: h / 2 },
})[handle]
const opposite: Record<ResizeHandle, ResizeHandle> = {
  top_left: 'bottom_right', top_right: 'bottom_left', bottom_right: 'top_left', bottom_left: 'top_right',
  top: 'bottom', right: 'left', bottom: 'top', left: 'right',
}

export const canResize = (shape: SceneCanvasShape) => shape.kind === 'token' && !shape.locked

/** Tamanho de um token depois de escalar, com os mínimos e o formato redondo do editor antigo. */
export function scaledTokenSize(token: Pick<SceneToken, 'w' | 'h' | 'representation'>, scale: number) {
  const w = Math.max(TOKEN_MIN_WIDTH, token.w * scale)
  const h = token.representation === 'round' ? w : Math.max(TOKEN_MIN_HEIGHT, token.h * scale)
  return { w, h }
}

/**
 * Redimensiona mantendo a proporção (todos os tokens têm proporção travada). O canto ou a borda
 * oposta fica parada; com `fromCenter` (Alt), o centro.
 */
export function resizeShapes(initial: SceneCanvasShape[], frame: Frame, handle: ResizeHandle, pointer: Point, fromCenter = false): SceneCanvasShape[] {
  const anchor = fromCenter ? { x: frame.w / 2, y: frame.h / 2 } : handlePoint(opposite[handle], frame.w, frame.h)
  const grip = handlePoint(handle, frame.w, frame.h)
  const local = toLocal(frame, pointer)
  const ratio = (value: number, from: number, to: number) => to === from ? 1 : (value - from) / (to - from)
  const sx = ratio(local.x, anchor.x, grip.x), sy = ratio(local.y, anchor.y, grip.y)
  let scale = handle === 'top' || handle === 'bottom' ? sy : handle === 'left' || handle === 'right' ? sx : Math.abs(sx) > Math.abs(sy) ? sx : sy
  scale = Math.max(0.01, scale)
  return initial.map((shape) => {
    if (!canResize(shape) || shape.kind !== 'token') return shape
    const origin = toLocal(frame, shape)
    const moved = toPage(frame, { x: anchor.x + (origin.x - anchor.x) * scale, y: anchor.y + (origin.y - anchor.y) * scale })
    return { ...shape, ...moved, ...scaledTokenSize(shape, scale) }
  })
}

/** Gira as formas em torno de `center`; com `snap` (Shift), a rotação final cai em passos de 15°. */
export function rotateShapes(initial: SceneCanvasShape[], center: Point, start: Point, pointer: Point, baseRotation: number, snap = false): SceneCanvasShape[] {
  let delta = Math.atan2(pointer.y - center.y, pointer.x - center.x) - Math.atan2(start.y - center.y, start.x - center.x)
  if (snap) delta = Math.round((baseRotation + delta) / ROTATION_SNAP) * ROTATION_SNAP - baseRotation
  return initial.map((shape) => {
    const offset = rotate({ x: shape.x - center.x, y: shape.y - center.y }, delta)
    return { ...shape, x: center.x + offset.x, y: center.y + offset.y, rotation: normalizeAngle(shape.rotation + delta) }
  })
}

export const normalizeAngle = (angle: number) => {
  const full = Math.PI * 2
  const value = ((angle % full) + full) % full
  return Math.abs(value - full) < 1e-9 ? 0 : value
}

/** Encaixe dos tokens redondos na grade, como o editor antigo fazia ao soltar o ponteiro. */
export const snapToGrid = (value: number, cellSize: number, offset: number) => Math.round((value - offset) / cellSize) * cellSize + offset
