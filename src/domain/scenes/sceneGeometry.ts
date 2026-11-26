import {
  ROTATION_SNAP, boundsOf, frameCenter, frameCorners, frameIntersectsRect, hitsFrame, normalizeAngle, resizePoint, resizeTransform, rotateAround, rotationDelta,
  selectionFrameOf, snapToGrid, toLocal, toPage,
  type Corner, type Edge, type Frame, type Point, type ResizeHandle,
} from '@/domain/canvas/geometry'
import { TOKEN_MIN_HEIGHT, TOKEN_MIN_WIDTH, type SceneCanvasShape, type SceneToken } from './sceneCanvas'

export { ROTATION_SNAP, boundsOf, frameCenter, frameCorners, frameIntersectsRect, hitsFrame, normalizeAngle, snapToGrid, toLocal, toPage }
export type { Corner, Edge, Frame, Point, ResizeHandle }

export const shapeFrame = (shape: Pick<SceneCanvasShape, 'x' | 'y' | 'w' | 'h' | 'rotation'>): Frame => ({ x: shape.x, y: shape.y, w: shape.w, h: shape.h, rotation: shape.rotation })

/** Uma forma usa a própria moldura girada; várias usam a caixa que as envolve, sem rotação. */
export const selectionFrame = (shapes: SceneCanvasShape[]) => selectionFrameOf(shapes.map(shapeFrame))

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
  const t = resizeTransform(frame, handle, pointer, fromCenter, true)
  const scale = Math.max(0.01, t.sx)
  const uniform = { ...t, sx: scale, sy: scale }
  return initial.map((shape) => {
    if (!canResize(shape) || shape.kind !== 'token') return shape
    return { ...shape, ...resizePoint(uniform, shape), ...scaledTokenSize(shape, scale) }
  })
}

/** Gira as formas em torno de `center`; com `snap` (Shift), a rotação final cai em passos de 15°. */
export function rotateShapes(initial: SceneCanvasShape[], center: Point, start: Point, pointer: Point, baseRotation: number, snap = false): SceneCanvasShape[] {
  const delta = rotationDelta(center, start, pointer, baseRotation, snap)
  return initial.map((shape) => rotateAround(shape, center, delta))
}
