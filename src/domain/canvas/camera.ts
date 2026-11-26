/**
 * Câmera dos canvas de Cenas e Quadros, portada do tldraw. Nas Cenas, com limites
 * (`behavior: 'contain'`, `origin` central, zoom base `fit-max`); nos Quadros, infinita. Os passos
 * de zoom são os padrões, para que pan, zoom e enquadramento tenham a mesma sensação.
 *
 * Convenção: ponto na tela = (ponto na página + câmera) × zoom.
 */
export type CameraState = { x: number; y: number; z: number }
export type Size = { w: number; h: number }
export type Rect = { x: number; y: number; w: number; h: number }
export type CameraConstraints = { bounds: Rect; padding: number }

export const ZOOM_STEPS = [0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8] as const
export const SCENE_CAMERA_PADDING = 40
const MAX_WHEEL_ZOOM_STEP = 10

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Zoom que mostra os limites inteiros dentro da área útil (`fit-max` do tldraw). */
export function baseZoom(viewport: Size, { bounds, padding }: CameraConstraints) {
  const px = Math.min(padding, viewport.w / 2), py = Math.min(padding, viewport.h / 2)
  const zx = (viewport.w - px * 2) / bounds.w, zy = (viewport.h - py * 2) / bounds.h
  const zoom = Math.min(zx, zy)
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1
}

/** Mantém o ponto focal quando o zoom pedido passa do limite. */
function clampZoom(next: CameraState, current: CameraState, minZ: number, maxZ: number): CameraState {
  let { x, y, z } = next
  if (z < minZ || z > maxZ) {
    const requested = z
    z = clamp(z, minZ, maxZ)
    const keep = (from: number, to: number) => requested === current.z ? from : from + (to - from) * (1 / z - 1 / current.z) / (1 / requested - 1 / current.z)
    x = keep(current.x, x)
    y = keep(current.y, y)
  }
  return { x, y, z }
}

/**
 * Aplica limites de zoom e de posição; `reset` volta ao enquadramento inicial. Sem `constraints`
 * (canvas infinito dos Quadros), só o zoom é limitado, entre 5% e 800%, como no tldraw.
 */
export function constrainCamera(next: CameraState, current: CameraState, viewport: Size, constraints: CameraConstraints | null, reset = false): CameraState {
  if (!constraints) return clampZoom(next, current, ZOOM_STEPS[0], ZOOM_STEPS[ZOOM_STEPS.length - 1])
  let { x, y, z } = next
  const { bounds } = constraints
  const px = Math.min(constraints.padding, viewport.w / 2), py = Math.min(constraints.padding, viewport.h / 2)
  const zx = (viewport.w - px * 2) / bounds.w, zy = (viewport.h - py * 2) / bounds.h
  const base = baseZoom(viewport, constraints)
  const minZ = ZOOM_STEPS[0] * base, maxZ = ZOOM_STEPS[ZOOM_STEPS.length - 1] * base
  if (reset) z = base;
  ({ x, y, z } = clampZoom({ x, y, z }, current, minZ, maxZ))
  const minX = px / z - bounds.x, minY = py / z - bounds.y
  const freeW = (viewport.w - px * 2) / z - bounds.w, freeH = (viewport.h - py * 2) / z - bounds.h
  const originX = minX + freeW * 0.5, originY = minY + freeH * 0.5
  if (reset) return { x: originX, y: originY, z }
  x = z < zx ? originX : clamp(x, minX + freeW, minX)
  y = z < zy ? originY : clamp(y, minY + freeH, minY)
  return { x, y, z }
}

export const screenToPage = (point: { x: number; y: number }, camera: CameraState) => ({ x: point.x / camera.z - camera.x, y: point.y / camera.z - camera.y })
export const pageToScreen = (point: { x: number; y: number }, camera: CameraState) => ({ x: (point.x + camera.x) * camera.z, y: (point.y + camera.y) * camera.z })

export const viewportPageBounds = (camera: CameraState, viewport: Size): Rect => ({ x: -camera.x, y: -camera.y, w: viewport.w / camera.z, h: viewport.h / camera.z })

/** Zoom mantendo fixo o ponto da tela `anchor`. */
export const zoomAt = (camera: CameraState, anchor: { x: number; y: number }, z: number): CameraState => ({
  x: camera.x + anchor.x / z - anchor.x / camera.z,
  y: camera.y + anchor.y / z - anchor.y / camera.z,
  z,
})

/** Roda/trackpad: rola por padrão; com Ctrl ou ⌘ (pinça no trackpad) aproxima. */
export function wheelCamera(camera: CameraState, event: { deltaX: number; deltaY: number; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }, anchor: { x: number; y: number }, isApple: boolean): CameraState {
  let deltaX = Number.isFinite(event.deltaX) ? event.deltaX : 0
  let deltaY = Number.isFinite(event.deltaY) ? event.deltaY : 0
  const zoomKey = event.ctrlKey || event.metaKey
  if (zoomKey || event.altKey) {
    const dz = -(Math.abs(deltaY) > MAX_WHEEL_ZOOM_STEP ? MAX_WHEEL_ZOOM_STEP * Math.sign(deltaY) : deltaY) / 100
    if (zoomKey) return zoomAt(camera, anchor, camera.z + dz * camera.z)
  } else if (event.shiftKey && !isApple) {
    deltaX = deltaY
    deltaY = 0
  }
  return { x: camera.x - deltaX / camera.z, y: camera.y - deltaY / camera.z, z: camera.z }
}

/** Câmera que enquadra `bounds` com uma margem em pixels de tela (`zoomToBounds` do tldraw). */
export function cameraForBounds(bounds: Rect, viewport: Size, inset: number): CameraState {
  const iw = Math.max(1, viewport.w - inset * 2), ih = Math.max(1, viewport.h - inset * 2)
  const z = Math.min(iw / bounds.w, ih / bounds.h)
  return { x: -bounds.x + (viewport.w / z - bounds.w) / 2, y: -bounds.y + (viewport.h / z - bounds.h) / 2, z }
}

export const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/** Interpola duas câmeras de forma que o centro da vista ande em linha reta. */
export function interpolateCamera(from: CameraState, to: CameraState, viewport: Size, t: number): CameraState {
  const center = (camera: CameraState) => ({ x: viewport.w / 2 / camera.z - camera.x, y: viewport.h / 2 / camera.z - camera.y })
  const a = center(from), b = center(to), k = easeInOutCubic(clamp(t, 0, 1))
  const z = from.z + (to.z - from.z) * k
  const cx = a.x + (b.x - a.x) * k, cy = a.y + (b.y - a.y) * k
  return { x: viewport.w / 2 / z - cx, y: viewport.h / 2 / z - cy, z }
}

/** Próximo passo de zoom (botões e atalhos de aproximar/afastar do tldraw). */
export function stepZoom(z: number, direction: 1 | -1, base = 1) {
  const steps = ZOOM_STEPS.map((step) => step * base)
  if (direction > 0) return steps.find((step) => step > z + 1e-9) ?? steps[steps.length - 1]
  return [...steps].reverse().find((step) => step < z - 1e-9) ?? steps[0]
}
