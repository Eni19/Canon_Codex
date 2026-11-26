import K from 'konva'
import type { Context } from 'konva/lib/Context'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EyeOff } from 'lucide-react'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import { assetVariantUrl } from '@/lib/assetUrl'
import type { SceneGrid } from '@/domain/scenes/scene'
import {
  SCENE_CAMERA_PADDING, cameraForBounds, constrainCamera, interpolateCamera, screenToPage, viewportPageBounds, wheelCamera, zoomAt,
  type CameraState, type Rect, type Size,
} from '@/domain/scenes/sceneCamera'
import { TOKEN_DEFAULT, type SceneCanvas, type SceneCanvasShape, type ScenePoiMarker, type SceneToken } from '@/domain/scenes/sceneCanvas'
import {
  boundsOf, canResize, frameCenter, frameIntersectsRect, hitsFrame, resizeShapes, rotateShapes, selectionFrame, shapeFrame, snapToGrid, toLocal, toPage,
  type Frame, type Point, type ResizeHandle,
} from '@/domain/scenes/sceneGeometry'
import type { SceneEntitySummary, ScenePoiSummary } from './scene-types'

export type SceneMode = 'edit' | 'run' | 'presentation'
export type SceneView = {
  mode: SceneMode
  entities: Map<string, SceneEntitySummary>
  pois: Map<string, ScenePoiSummary>
  grid: SceneGrid
  presentationPoisVisible: boolean
}
export type SceneEditorCallbacks = {
  /** Qualquer alteração nas formas (arraste, redimensionamento, inspetor, exclusão). */
  documentChanged: () => void
  selectionChanged: () => void
  cameraChanged: () => void
  openToken: (entityId: string) => void
  openPoi: (poiId: string) => void
}
type ShapePatch = { id: string } & Partial<Omit<SceneToken, 'id' | 'kind'>> & Partial<Omit<ScenePoiMarker, 'id' | 'kind'>>

// Valores do tema escuro do tldraw 5.4.1, para que seleção e contornos tenham a mesma cara.
const SELECTION_STROKE = 'hsl(214, 84%, 56%)'
const SELECTION_CONTRAST = '#ffffff'
const BRUSH_FILL = 'hsla(0, 0%, 56%, 0.102)'
const BRUSH_STROKE = 'hsla(0, 0%, 56%, 0.251)'
const LINE_WIDTH = 1.5
const HANDLE_SIZE = 8
const HIT_TARGET = 6
const HIT_MARGIN = 3
const DRAG_DISTANCE = 4
const COARSE_DRAG_DISTANCE = 6
const DOUBLE_CLICK_MS = 450
const FIT_INSET = 40
const FIT_DURATION = 250
const LINE_HEIGHT = 1.5

const ROTATE_CURSOR = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10 22a9 9 0 1 1 12 0" stroke="#fff" stroke-width="5"/><path d="M22 16v6h6" stroke="#fff" stroke-width="5"/><path d="M10 22a9 9 0 1 1 12 0" stroke="#000" stroke-width="2"/><path d="M22 16v6h6" stroke="#000" stroke-width="2"/></g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 16 16, crosshair`
})()

const isField = (target: EventTarget | null) => target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')
const newShapeId = () => `shape:${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`}`
const deg = (radians: number) => radians * 180 / Math.PI
const distanceSq = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2

type Palette = { primary: string; primary72: string; primary28: string; surface: string; warning: string; warningForeground: string; foreground: string; border: string; font: string; rem: number }

function readPalette(host: HTMLElement): Palette {
  const probe = document.createElement('span')
  probe.style.display = 'none'
  host.appendChild(probe)
  const resolve = (css: string) => { probe.style.color = ''; probe.style.color = css; return getComputedStyle(probe).color }
  const palette = {
    primary: resolve('var(--primary)'),
    primary72: resolve('color-mix(in oklch, var(--primary) 72%, transparent)'),
    primary28: resolve('color-mix(in oklch, var(--primary) 28%, transparent)'),
    surface: resolve('var(--surface)'),
    warning: resolve('var(--warning)'),
    warningForeground: resolve('var(--warning-foreground)'),
    foreground: resolve('var(--foreground)'),
    border: resolve('var(--border)'),
    font: getComputedStyle(host).fontFamily || 'sans-serif',
    rem: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
  }
  probe.remove()
  return palette
}

/**
 * Desenha só a sombra de `draw`, deslocando o desenho para fora da tela e trazendo a sombra de
 * volta. Assim cada `drop-shadow` do CSS vira uma passada, sem pintar a forma várias vezes.
 * Deslocamento e desfoque estão em pixels da página e acompanham zoom e rotação.
 */
function shadowPass(ctx: CanvasRenderingContext2D, color: string, offsetX: number, offsetY: number, blur: number, draw: () => void) {
  const m = ctx.getTransform()
  const scale = Math.hypot(m.a, m.b)
  const away = 100_000 / Math.max(scale, 1e-6)
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = blur * scale
  ctx.shadowOffsetX = m.a * offsetX + m.c * offsetY + m.a * away
  ctx.shadowOffsetY = m.b * offsetX + m.d * offsetY + m.b * away
  ctx.translate(-away, 0)
  draw()
  ctx.restore()
}

export function createSceneEditor(host: HTMLElement, options: {
  background: { assetId: string; width: number; height: number }
  canvas: SceneCanvas
  view: SceneView
  callbacks: SceneEditorCallbacks
}) {
  const { background, callbacks } = options
  let view = options.view
  let shapes: SceneCanvasShape[] = options.canvas.shapes.map((shape) => ({ ...shape }))
  const legacyTldraw = options.canvas.legacyTldraw
  let selectedIds: string[] = []
  let hoveredId: string | null = null
  let palette = readPalette(host)
  let viewport: Size = { w: host.clientWidth, h: host.clientHeight }
  const constraints = { bounds: { x: 0, y: 0, w: background.width, h: background.height }, padding: SCENE_CAMERA_PADDING }
  let camera: CameraState = constrainCamera({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, viewport, constraints, true)
  let cameraAnimation: number | null = null

  const stage = new K.Stage({ container: host as HTMLDivElement, width: Math.max(1, viewport.w), height: Math.max(1, viewport.h), listening: false })
  const backgroundLayer = new K.Layer({ listening: false })
  const shapeLayer = new K.Layer({ listening: false })
  const overlayLayer = new K.Layer({ listening: false })
  stage.add(backgroundLayer, shapeLayer, overlayLayer)

  // ---------- Imagens ----------
  const images = new Map<string, HTMLImageElement>()
  const image = (src: string) => {
    let img = images.get(src)
    if (!img) {
      img = new window.Image()
      img.decoding = 'async'
      img.onload = () => { backgroundLayer.batchDraw(); shapeLayer.batchDraw() }
      img.src = src
      images.set(src, img)
    }
    return img.complete && img.naturalWidth > 0 ? img : null
  }
  const iconSources = new Map<string, string>()
  const iconImage = (key: string, render: () => string) => {
    let src = iconSources.get(key)
    if (!src) { src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(render())}`; iconSources.set(key, src) }
    return image(src)
  }
  // Ícones lucide viram SVG em data URL; `currentColor` não tem a quem herdar numa imagem.
  const colored = (markup: string, color: string) => markup.replaceAll('currentColor', color)
  const eyeOffIcon = (color: string) => iconImage(`eye-off:${color}`, () => colored(renderToStaticMarkup(createElement(EyeOff)), color))
  const typeIcon = (name: string, color: string) => iconImage(`type:${name}:${color}`, () => colored(renderToStaticMarkup(createElement(EntityTypeIcon, { name })), color))

  // ---------- Desenho ----------
  const font = (sizeRem: number, weight = 700) => `${weight} ${sizeRem * palette.rem}px ${palette.font}`
  const supportsFilter = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    const { width: w, height: h } = background
    ctx.fillStyle = '#090a0c'
    ctx.fillRect(0, 0, w, h)
    const img = image(assetVariantUrl(background.assetId, 'original'))
    if (img) {
      const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight)
      const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
    }
    const grid = view.grid
    if (grid.enabled && grid.cellSize > 0) {
      ctx.save()
      ctx.globalAlpha = grid.opacity
      ctx.fillStyle = palette.foreground
      const startX = ((grid.offsetX % grid.cellSize) + grid.cellSize) % grid.cellSize
      const startY = ((grid.offsetY % grid.cellSize) + grid.cellSize) % grid.cellSize
      for (let x = startX - grid.cellSize; x < w; x += grid.cellSize) if (x + 1 > 0) ctx.fillRect(Math.max(0, x), 0, Math.min(1, x + 1), h)
      for (let y = startY - grid.cellSize; y < h; y += grid.cellSize) if (y + 1 > 0) ctx.fillRect(0, Math.max(0, y), w, Math.min(1, y + 1))
      ctx.restore()
    }
  }

  const labelBox = (ctx: CanvasRenderingContext2D, text: string, sizeRem: number, padX: number, padY: number) => {
    ctx.font = font(sizeRem)
    const size = sizeRem * palette.rem
    const width = ctx.measureText(text).width + padX * 2
    const height = size * LINE_HEIGHT + padY * 2
    return { width, height, size }
  }

  const drawTokenBody = (ctx: CanvasRenderingContext2D, token: SceneToken, entity: SceneEntitySummary | undefined, withLabel: boolean) => {
    const { w, h } = token
    const rem = palette.rem
    const round = token.representation === 'round'
    if (round) {
      ctx.save()
      ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      ctx.fillStyle = palette.primary72
      ctx.fill()
      ctx.beginPath(); ctx.ellipse(w / 2, h / 2, Math.max(0, w / 2 - 2), Math.max(0, h / 2 - 2), 0, 0, Math.PI * 2)
      ctx.fillStyle = palette.surface
      ctx.fill()
      ctx.clip()
      const img = entity?.assetId ? image(assetVariantUrl(entity.assetId, 'original')) : null
      if (img) {
        const iw = w - 4, ih = h - 4
        const scale = Math.max(iw / img.naturalWidth, ih / img.naturalHeight)
        const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale
        if (token.flipX) { ctx.translate(w, 0); ctx.scale(-1, 1) }
        ctx.drawImage(img, 2 + (iw - dw) / 2, 2, dw, dh)
      }
      ctx.restore()
    }
    if (!entity?.assetId) {
      ctx.save()
      ctx.fillStyle = palette.surface
      ctx.fillRect(0, 0, w, h)
      if (entity) {
        ctx.strokeStyle = palette.warning
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.strokeRect(0.5, 0.5, w - 1, h - 1)
        const icon = typeIcon(entity.typeIcon, palette.warning)
        const size = Math.min(w, h) * 0.35
        if (icon) ctx.drawImage(icon, (w - size) / 2, (h - size) / 2, size, size)
      } else {
        ctx.font = font(1, 400)
        ctx.fillStyle = palette.foreground
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('?', w / 2, h / 2)
      }
      ctx.restore()
    }
    if (withLabel) {
      const title = entity?.title ?? 'Entidade ausente'
      const padX = 0.45 * rem, padY = 0.2 * rem
      const { width, height, size } = labelBox(ctx, title, 0.58, padX, padY)
      const bottom = h + 1.3 * rem
      const x = w / 2 - width / 2 - 1, y = bottom - height - 2
      ctx.fillStyle = 'rgba(8, 9, 13, 0.867)'
      ctx.fillRect(x, y, width + 2, height + 2)
      ctx.strokeStyle = palette.border
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, width + 1, height + 1)
      ctx.fillStyle = palette.foreground
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(title, w / 2, y + 1 + height / 2 + size * 0.05)
    }
  }

  const drawCutoutImage = (ctx: CanvasRenderingContext2D, token: SceneToken, img: HTMLImageElement) => {
    const scale = Math.min(token.w / img.naturalWidth, token.h / img.naturalHeight)
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale
    ctx.save()
    if (token.flipX) { ctx.translate(token.w, 0); ctx.scale(-1, 1) }
    ctx.drawImage(img, (token.w - dw) / 2, token.h - dh, dw, dh)
    ctx.restore()
  }

  const drawToken = (ctx: CanvasRenderingContext2D, token: SceneToken) => {
    const hidden = token.visibility === 'hidden'
    if (hidden && view.mode === 'presentation') return
    const entity = view.entities.get(token.entityId)
    const withLabel = view.mode !== 'presentation'
    const rem = palette.rem
    const cutoutImage = token.representation === 'cutout' && entity?.assetId ? image(assetVariantUrl(entity.assetId, 'original')) : null
    const body = () => {
      if (cutoutImage) drawCutoutImage(ctx, token, cutoutImage)
      drawTokenBody(ctx, token, entity, withLabel)
    }
    ctx.save()
    if (hidden) ctx.globalAlpha *= 0.42
    // .token { filter: drop-shadow(0 .65rem .65rem #0008) } e .hidden { drop-shadow(0 .7rem .7rem #000a) }
    if (hidden) shadowPass(ctx, 'rgba(0,0,0,0.667)', 0, 0.7 * rem, 0.7 * rem, body)
    else shadowPass(ctx, 'rgba(0,0,0,0.533)', 0, 0.65 * rem, 0.65 * rem, body)
    if (token.representation === 'round') {
      // .round { box-shadow: 0 0 0 1px #111, 0 .5rem .85rem #0009 }
      const ellipse = () => { ctx.beginPath(); ctx.ellipse(token.w / 2, token.h / 2, token.w / 2, token.h / 2, 0, 0, Math.PI * 2); ctx.fillStyle = '#000'; ctx.fill() }
      shadowPass(ctx, 'rgba(0,0,0,0.6)', 0, 0.5 * rem, 0.85 * rem, ellipse)
      ctx.beginPath(); ctx.ellipse(token.w / 2, token.h / 2, token.w / 2 + 1, token.h / 2 + 1, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#111'
      ctx.fill()
    }
    if (cutoutImage) {
      // .cutout > img { filter: drop-shadow(0 0 1px primary 72%) drop-shadow(0 0 2px primary 28%) }
      const draw = () => drawCutoutImage(ctx, token, cutoutImage)
      shadowPass(ctx, palette.primary72, 0, 0, 1, draw)
      shadowPass(ctx, palette.primary28, 0, 0, 2, draw)
    }
    if (hidden && supportsFilter) ctx.filter = 'grayscale(0.5)'
    body()
    ctx.filter = 'none'
    if (hidden && view.mode !== 'presentation') {
      const d = 1.2 * rem, inset = 0.35 * rem
      const cx = token.w - inset - d / 2, cy = inset + d / 2
      ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2)
      ctx.fillStyle = palette.warning
      ctx.fill()
      const icon = eyeOffIcon(palette.warningForeground)
      const size = 0.8 * rem
      if (icon) ctx.drawImage(icon, cx - size / 2, cy - size / 2, size, size)
    }
    ctx.restore()
  }

  const drawPoi = (ctx: CanvasRenderingContext2D, marker: ScenePoiMarker) => {
    const hidden = marker.visibility === 'hidden'
    if (view.mode === 'presentation' && (hidden || !view.presentationPoisVisible)) return
    const poi = view.pois.get(marker.poiId)
    const rem = palette.rem
    const label = poi?.label ?? 'Ponto indisponível'
    const cy = marker.h / 2
    const dot = rem, gap = 0.35 * rem
    const padX = 0.4 * rem, padY = 0.2 * rem
    const content = () => {
      ctx.beginPath(); ctx.arc(dot / 2, cy, dot / 2 + 3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.533)'
      ctx.fill()
      ctx.beginPath(); ctx.arc(dot / 2, cy, dot / 2, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.beginPath(); ctx.arc(dot / 2, cy, dot / 2 - 3, 0, Math.PI * 2)
      ctx.fillStyle = palette.primary
      ctx.fill()
      const { width, height, size } = labelBox(ctx, label, 0.6, padX, padY)
      const x = dot + gap
      ctx.fillStyle = 'rgba(7, 8, 12, 0.867)'
      ctx.fillRect(x, cy - height / 2, width, height)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText(label, x + padX, cy + size * 0.05)
      if (hidden && view.mode !== 'presentation') {
        const icon = eyeOffIcon(palette.warning)
        const s = 0.8 * rem
        if (icon) ctx.drawImage(icon, x + width + gap, cy - s / 2, s, s)
      }
    }
    ctx.save()
    if (hidden) ctx.globalAlpha *= 0.42
    shadowPass(ctx, '#000', 0, 2, 3, content)
    content()
    ctx.restore()
  }

  const backgroundNode = new K.Shape({
    listening: false, perfectDrawEnabled: false,
    sceneFunc: (context: Context) => drawBackground(context._context),
  })
  backgroundLayer.add(backgroundNode)

  const nodes = new Map<string, K.Shape>()
  const shapeById = (id: string) => shapes.find((shape) => shape.id === id)
  const syncNodes = () => {
    const ids = new Set(shapes.map((shape) => shape.id))
    for (const [id, node] of nodes) if (!ids.has(id)) { node.destroy(); nodes.delete(id) }
    shapes.forEach((shape, index) => {
      let node = nodes.get(shape.id)
      if (!node) {
        const id = shape.id
        node = new K.Shape({
          listening: false, perfectDrawEnabled: false,
          sceneFunc: (context: Context) => {
            const current = shapeById(id)
            if (!current) return
            if (current.kind === 'token') drawToken(context._context, current)
            else drawPoi(context._context, current)
          },
        })
        shapeLayer.add(node)
        nodes.set(shape.id, node)
      }
      node.setAttrs({ x: shape.x, y: shape.y, rotation: deg(shape.rotation) })
      node.zIndex(index)
    })
    shapeLayer.batchDraw()
  }

  // ---------- Sobreposição (seleção, contornos, área) ----------
  type Interaction =
    | { kind: 'idle' }
    | { kind: 'pointing'; pointerId: number; startScreen: Point; startPage: Point; targetId: string | null; shift: boolean; wasSelected: boolean; coarse: boolean }
    | { kind: 'translating'; pointerId: number; startPage: Point; initial: SceneCanvasShape[]; before: SceneCanvasShape[]; beforeSelection: string[] }
    | { kind: 'brushing'; pointerId: number; startPage: Point; rect: Rect; base: string[] }
    | { kind: 'panning'; pointerId: number; last: Point }
    | { kind: 'resizing'; pointerId: number; handle: ResizeHandle; frame: Frame; initial: SceneCanvasShape[] }
    | { kind: 'rotating'; pointerId: number; center: Point; startPage: Point; baseRotation: number; initial: SceneCanvasShape[] }
    | { kind: 'pinching'; startDistance: number; startMid: Point; startCamera: CameraState }
  let interaction: Interaction = { kind: 'idle' }

  const overlaysVisible = () => view.mode === 'edit'
  const selectedShapes = () => shapes.filter((shape) => selectedIds.includes(shape.id))
  const showControls = () => overlaysVisible() && (interaction.kind === 'idle' || interaction.kind === 'pointing')

  const controls = () => {
    const selection = selectedShapes()
    const frame = selectionFrame(selection)
    if (!frame || !showControls()) return null
    const z = camera.z
    const handleSize = HANDLE_SIZE / z
    const tinyX = frame.w < handleSize * 2, tinyY = frame.h < handleSize * 2
    const resizable = selection.length === 1 ? canResize(selection[0]) : selection.some(canResize)
    const hit = HIT_TARGET / z
    return { frame, handleSize, resizable, rotatable: !(tinyX || tinyY), cornerHit: hit * 1.5, rotateSize: hit * 1.62, edgeHit: hit }
  }

  const drawOverlay = (ctx: CanvasRenderingContext2D) => {
    if (!overlaysVisible()) return
    const z = camera.z
    const indicator = (shape: SceneCanvasShape) => {
      ctx.save()
      ctx.translate(shape.x, shape.y); ctx.rotate(shape.rotation)
      ctx.strokeStyle = SELECTION_STROKE
      ctx.lineWidth = LINE_WIDTH / z
      ctx.strokeRect(0, 0, shape.w, shape.h)
      ctx.restore()
    }
    const busy = interaction.kind === 'brushing' || interaction.kind === 'panning' || interaction.kind === 'pinching'
    for (const shape of selectedShapes()) indicator(shape)
    if (hoveredId && !selectedIds.includes(hoveredId) && (interaction.kind === 'idle' || busy)) {
      const hovered = shapeById(hoveredId)
      if (hovered) indicator(hovered)
    }
    if (interaction.kind === 'brushing') {
      const { rect } = interaction
      ctx.fillStyle = BRUSH_FILL
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      ctx.strokeStyle = BRUSH_STROKE
      ctx.lineWidth = 1 / z
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
    }
    const c = controls()
    if (!c) return
    ctx.save()
    ctx.translate(c.frame.x, c.frame.y); ctx.rotate(c.frame.rotation)
    ctx.strokeStyle = SELECTION_STROKE
    ctx.lineWidth = LINE_WIDTH / z
    ctx.strokeRect(0, 0, c.frame.w, c.frame.h)
    if (c.resizable) {
      ctx.fillStyle = SELECTION_CONTRAST
      const s = c.handleSize
      for (const [x, y] of [[0, 0], [c.frame.w, 0], [c.frame.w, c.frame.h], [0, c.frame.h]]) {
        ctx.fillRect(x - s / 2, y - s / 2, s, s)
        ctx.strokeRect(x - s / 2, y - s / 2, s, s)
      }
    }
    ctx.restore()
  }
  const overlayNode = new K.Shape({ listening: false, perfectDrawEnabled: false, sceneFunc: (context: Context) => drawOverlay(context._context) })
  overlayLayer.add(overlayNode)

  // ---------- Câmera ----------
  const applyCamera = () => {
    stage.scale({ x: camera.z, y: camera.z })
    stage.position({ x: camera.x * camera.z, y: camera.y * camera.z })
    stage.batchDraw()
    callbacks.cameraChanged()
  }
  const setCamera = (next: CameraState) => {
    camera = constrainCamera(next, camera, viewport, constraints)
    applyCamera()
  }
  const stopCameraAnimation = () => { if (cameraAnimation !== null) { cancelAnimationFrame(cameraAnimation); cameraAnimation = null } }
  const fitBackground = (animate = true) => {
    stopCameraAnimation()
    const target = constrainCamera(cameraForBounds(constraints.bounds, viewport, FIT_INSET), camera, viewport, constraints)
    if (!animate) { camera = target; applyCamera(); return }
    const from = camera, start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / FIT_DURATION)
      camera = t >= 1 ? target : interpolateCamera(from, target, viewport, t)
      applyCamera()
      cameraAnimation = t >= 1 ? null : requestAnimationFrame(step)
    }
    cameraAnimation = requestAnimationFrame(step)
  }

  // ---------- Documento ----------
  const commit = () => { syncNodes(); overlayLayer.batchDraw(); callbacks.documentChanged() }
  const setSelection = (ids: string[]) => {
    const next = ids.filter((id) => { const shape = shapeById(id); return shape?.kind === 'token' })
    if (next.length === selectedIds.length && next.every((id, i) => id === selectedIds[i])) return
    selectedIds = next
    overlayLayer.batchDraw()
    callbacks.selectionChanged()
  }
  const replaceShapes = (next: SceneCanvasShape[]) => {
    const byId = new Map(next.map((shape) => [shape.id, shape]))
    shapes = shapes.map((shape) => byId.get(shape.id) ?? shape)
  }

  // ---------- Acerto ----------
  const pointerPoint = (event: { clientX: number; clientY: number }): Point => {
    const rect = host.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  const pageAt = (screen: Point) => screenToPage(screen, camera)
  const isHittable = (shape: SceneCanvasShape) => {
    if (view.mode !== 'presentation') return true
    if (shape.visibility === 'hidden') return false
    return shape.kind === 'token' || view.presentationPoisVisible
  }
  /** Formas sob o ponto, da frente para trás. */
  const shapesAt = (page: Point) => {
    const margin = HIT_MARGIN / camera.z
    return [...shapes].reverse().filter((shape) => isHittable(shape) && hitsFrame(shapeFrame(shape), page, margin))
  }
  // Marcadores de ponto de interesse ficam travados: não são selecionados nem arrastados.
  const tokenAt = (page: Point) => shapesAt(page).find((shape) => shape.kind === 'token')

  type ControlHit = { kind: 'resize'; handle: ResizeHandle } | { kind: 'rotate'; corner: number }
  const controlAt = (page: Point): ControlHit | null => {
    const c = controls()
    if (!c) return null
    const local = toLocal(c.frame, page)
    const { w, h } = c.frame
    const corners: Array<[ResizeHandle, number, number]> = [['top_left', 0, 0], ['top_right', w, 0], ['bottom_right', w, h], ['bottom_left', 0, h]]
    if (c.resizable) for (const [handle, x, y] of corners) if (Math.abs(local.x - x) <= c.cornerHit && Math.abs(local.y - y) <= c.cornerHit) return { kind: 'resize', handle }
    if (c.rotatable) {
      const r = c.rotateSize
      const centers = [[-r, -r], [w + r, -r], [w + r, h + r], [-r, h + r]]
      for (let i = 0; i < 4; i++) if (distanceSq(local, { x: centers[i][0], y: centers[i][1] }) <= r * r) return { kind: 'rotate', corner: i }
    }
    if (c.resizable) {
      const e = c.edgeHit
      const inX = local.x > c.cornerHit && local.x < w - c.cornerHit, inY = local.y > c.cornerHit && local.y < h - c.cornerHit
      if (inX && Math.abs(local.y) <= e) return { kind: 'resize', handle: 'top' }
      if (inX && Math.abs(local.y - h) <= e) return { kind: 'resize', handle: 'bottom' }
      if (inY && Math.abs(local.x) <= e) return { kind: 'resize', handle: 'left' }
      if (inY && Math.abs(local.x - w) <= e) return { kind: 'resize', handle: 'right' }
    }
    return null
  }
  const resizeCursor = (handle: ResizeHandle, frame: Frame) => {
    const local = { top_left: [0, 0], top_right: [frame.w, 0], bottom_right: [frame.w, frame.h], bottom_left: [0, frame.h], top: [frame.w / 2, 0], right: [frame.w, frame.h / 2], bottom: [frame.w / 2, frame.h], left: [0, frame.h / 2] }[handle]
    const point = toPage(frame, { x: local[0], y: local[1] }), center = frameCenter(frame)
    let angle = Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI
    angle = ((angle % 180) + 180) % 180
    if (handle === 'top' || handle === 'bottom' || handle === 'left' || handle === 'right') {
      return angle < 22.5 || angle >= 157.5 ? 'ew-resize' : angle < 67.5 ? 'nwse-resize' : angle < 112.5 ? 'ns-resize' : 'nesw-resize'
    }
    return angle < 90 ? 'nwse-resize' : 'nesw-resize'
  }

  // ---------- Entrada ----------
  let spaceHeld = false
  let lastDown: { time: number; point: Point } | null = null
  const pointers = new Map<number, Point>()

  const setCursor = (cursor: string) => { if (host.style.cursor !== cursor) host.style.cursor = cursor }
  const updateHover = (screen: Point) => {
    if (interaction.kind !== 'idle') return
    if (spaceHeld) { setCursor('grab'); return }
    const page = pageAt(screen)
    const control = controlAt(page)
    const c = controls()
    if (control && c) setCursor(control.kind === 'rotate' ? ROTATE_CURSOR : resizeCursor(control.handle, c.frame))
    else setCursor('default')
    const next = tokenAt(page)?.id ?? null
    if (next !== hoveredId) { hoveredId = next; overlayLayer.batchDraw() }
  }

  const cancelInteraction = () => {
    if (interaction.kind === 'translating') {
      const { initial, before, beforeSelection } = interaction
      if (before.length === 0) {
        // Arraste com Alt: desfaz as cópias.
        const clones = new Set(initial.map((shape) => shape.id))
        shapes = shapes.filter((shape) => !clones.has(shape.id))
      } else replaceShapes(before)
      interaction = { kind: 'idle' }
      setSelection(beforeSelection)
      commit()
    } else if (interaction.kind === 'resizing' || interaction.kind === 'rotating') {
      replaceShapes(interaction.initial)
      commit()
    }
    interaction = { kind: 'idle' }
    overlayLayer.batchDraw()
  }

  const startTranslate = (pointerId: number, startPage: Point, alt: boolean) => {
    const beforeSelection = [...selectedIds]
    const before = selectedShapes().map((shape) => ({ ...shape }))
    if (alt && before.length > 0) {
      // Alt ao arrastar duplica, como no tldraw: as cópias ficam logo acima das originais.
      const clones = before.map((shape) => ({ ...shape, id: newShapeId() }))
      const top = Math.max(...before.map((shape) => shapes.indexOf(shapeById(shape.id)!)))
      shapes = [...shapes.slice(0, top + 1), ...clones, ...shapes.slice(top + 1)]
      syncNodes()
      selectedIds = clones.map((shape) => shape.id)
      callbacks.selectionChanged()
      interaction = { kind: 'translating', pointerId, startPage, initial: clones, before: [], beforeSelection }
      return
    }
    interaction = { kind: 'translating', pointerId, startPage, initial: before, before, beforeSelection }
  }

  const down = (event: PointerEvent) => {
    if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea')) return
    const screen = pointerPoint(event)
    pointers.set(event.pointerId, screen)
    stopCameraAnimation()
    if (pointers.size === 2) {
      cancelInteraction()
      const [a, b] = [...pointers.values()]
      interaction = { kind: 'pinching', startDistance: Math.max(1, Math.sqrt(distanceSq(a, b))), startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, startCamera: camera }
      return
    }
    if (pointers.size > 2 || interaction.kind !== 'idle') return
    host.setPointerCapture?.(event.pointerId)
    if (event.button === 1 || (event.button === 0 && spaceHeld)) {
      event.preventDefault()
      interaction = { kind: 'panning', pointerId: event.pointerId, last: screen }
      setCursor('grabbing')
      return
    }
    if (event.button !== 0) return
    const page = pageAt(screen)
    const now = performance.now()
    if (lastDown && now - lastDown.time < DOUBLE_CLICK_MS && distanceSq(lastDown.point, screen) < 16 * 16) {
      lastDown = null
      const hit = shapesAt(page)[0]
      if (hit?.kind === 'token') callbacks.openToken(hit.entityId)
      else if (hit?.kind === 'poi') callbacks.openPoi(hit.poiId)
    } else lastDown = { time: now, point: screen }
    const control = controlAt(page)
    if (control) {
      const frame = selectionFrame(selectedShapes())!
      const initial = selectedShapes().map((shape) => ({ ...shape }))
      interaction = control.kind === 'resize'
        ? { kind: 'resizing', pointerId: event.pointerId, handle: control.handle, frame, initial }
        : { kind: 'rotating', pointerId: event.pointerId, center: frameCenter(frame), startPage: page, baseRotation: selectedShapes().length === 1 ? frame.rotation : 0, initial }
      overlayLayer.batchDraw()
      return
    }
    const target = tokenAt(page)
    const wasSelected = !!target && selectedIds.includes(target.id)
    if (target && !wasSelected) setSelection(event.shiftKey ? [...selectedIds, target.id] : [target.id])
    interaction = { kind: 'pointing', pointerId: event.pointerId, startScreen: screen, startPage: page, targetId: target?.id ?? null, shift: event.shiftKey, wasSelected, coarse: event.pointerType !== 'mouse' }
    overlayLayer.batchDraw()
  }

  const move = (event: PointerEvent) => {
    const screen = pointerPoint(event)
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, screen)
    if (interaction.kind === 'pinching') {
      if (pointers.size < 2) return
      const [a, b] = [...pointers.values()]
      const distance = Math.max(1, Math.sqrt(distanceSq(a, b)))
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const { startCamera, startDistance, startMid } = interaction
      const zoomed = zoomAt(startCamera, startMid, startCamera.z * distance / startDistance)
      setCamera({ x: zoomed.x + (mid.x - startMid.x) / zoomed.z, y: zoomed.y + (mid.y - startMid.y) / zoomed.z, z: zoomed.z })
      return
    }
    if (interaction.kind === 'idle') { if (event.target === host || host.contains(event.target as Node)) updateHover(screen); return }
    if ('pointerId' in interaction && interaction.pointerId !== event.pointerId) return
    const page = pageAt(screen)
    switch (interaction.kind) {
      case 'panning': {
        const dx = screen.x - interaction.last.x, dy = screen.y - interaction.last.y
        interaction.last = screen
        setCamera({ x: camera.x + dx / camera.z, y: camera.y + dy / camera.z, z: camera.z })
        return
      }
      case 'pointing': {
        const limit = interaction.coarse ? COARSE_DRAG_DISTANCE : DRAG_DISTANCE
        if (distanceSq(screen, interaction.startScreen) < limit * limit) return
        if (interaction.targetId) startTranslate(interaction.pointerId, interaction.startPage, event.altKey)
        else {
          const base = interaction.shift ? [...selectedIds] : []
          if (!interaction.shift) setSelection([])
          interaction = { kind: 'brushing', pointerId: interaction.pointerId, startPage: interaction.startPage, rect: { x: page.x, y: page.y, w: 0, h: 0 }, base }
        }
        hoveredId = null
        move(event)
        return
      }
      case 'translating': {
        let dx = page.x - interaction.startPage.x, dy = page.y - interaction.startPage.y
        if (event.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0 }
        replaceShapes(interaction.initial.map((shape) => ({ ...shape, x: shape.x + dx, y: shape.y + dy })))
        commit()
        return
      }
      case 'brushing': {
        const rect = boundsOf([interaction.startPage, page])
        interaction.rect = rect
        const inside = shapes.filter((shape) => shape.kind === 'token' && isHittable(shape) && frameIntersectsRect(shapeFrame(shape), rect)).map((shape) => shape.id)
        setSelection([...new Set([...interaction.base, ...inside])])
        overlayLayer.batchDraw()
        return
      }
      case 'resizing': {
        replaceShapes(resizeShapes(interaction.initial, interaction.frame, interaction.handle, page, event.altKey))
        commit()
        return
      }
      case 'rotating': {
        replaceShapes(rotateShapes(interaction.initial, interaction.center, interaction.startPage, page, interaction.baseRotation, event.shiftKey))
        commit()
        return
      }
    }
  }

  const snapRoundTokens = () => {
    const grid = view.grid
    if (!grid.snapTokens) return false
    let changed = false
    shapes = shapes.map((shape) => {
      if (!selectedIds.includes(shape.id) || shape.kind !== 'token' || shape.representation !== 'round') return shape
      const x = snapToGrid(shape.x, grid.cellSize, grid.offsetX), y = snapToGrid(shape.y, grid.cellSize, grid.offsetY)
      if (x === shape.x && y === shape.y) return shape
      changed = true
      return { ...shape, x, y }
    })
    return changed
  }

  const up = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    if (interaction.kind === 'pinching') { if (pointers.size < 2) interaction = { kind: 'idle' }; return }
    if (!('pointerId' in interaction) || interaction.pointerId !== event.pointerId) return
    host.releasePointerCapture?.(event.pointerId)
    const screen = pointerPoint(event)
    const ended = interaction
    interaction = { kind: 'idle' }
    if (ended.kind === 'pointing') {
      const page = pageAt(screen)
      if (ended.targetId) {
        if (ended.shift && ended.wasSelected) setSelection(selectedIds.filter((id) => id !== ended.targetId))
        else if (!ended.shift && ended.wasSelected) setSelection([ended.targetId])
      } else if (!ended.shift) setSelection([])
      const poi = shapesAt(page).find((shape): shape is ScenePoiMarker => shape.kind === 'poi')
      if (poi) callbacks.openPoi(poi.poiId)
    }
    if (snapRoundTokens()) commit()
    overlayLayer.batchDraw()
    updateHover(screen)
  }

  const cancelPointer = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    if (interaction.kind === 'pinching') { if (pointers.size < 2) interaction = { kind: 'idle' }; return }
    if ('pointerId' in interaction && interaction.pointerId === event.pointerId) cancelInteraction()
  }

  const leave = () => { if (hoveredId && interaction.kind === 'idle') { hoveredId = null; overlayLayer.batchDraw() } }

  const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  const wheel = (event: WheelEvent) => {
    if (isField(event.target)) return
    event.preventDefault()
    stopCameraAnimation()
    setCamera(wheelCamera(camera, event, pointerPoint(event), isApple))
  }

  // Pinça no trackpad do Safari chega como gesto, não como roda com Ctrl.
  let gestureStart: { scale: number; camera: CameraState } | null = null
  const gestureStartHandler = (event: Event) => { event.preventDefault(); gestureStart = { scale: (event as unknown as { scale: number }).scale, camera } }
  const gestureChange = (event: Event) => {
    event.preventDefault()
    if (!gestureStart) return
    const gesture = event as unknown as { scale: number; clientX: number; clientY: number }
    setCamera(zoomAt(camera, pointerPoint(gesture), gestureStart.camera.z * gesture.scale / gestureStart.scale))
  }
  const gestureEnd = (event: Event) => { event.preventDefault(); gestureStart = null }

  const keydown = (event: KeyboardEvent) => {
    if (isField(event.target) || event.defaultPrevented) return
    if (event.code === 'Space') {
      if (!spaceHeld) { spaceHeld = true; if (interaction.kind === 'idle') setCursor('grab') }
      event.preventDefault()
      return
    }
    if (event.key === 'Escape') {
      if (interaction.kind !== 'idle') cancelInteraction()
      else setSelection([])
      return
    }
    if (interaction.kind !== 'idle') return
    if ((event.key === 'Delete' || event.key === 'Backspace') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (selectedIds.length === 0) return
      event.preventDefault()
      editor.deleteShapes(selectedIds)
      return
    }
    const nudge = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
    if (nudge && selectedIds.length > 0 && !event.altKey && !spaceHeld) {
      event.preventDefault()
      const step = event.shiftKey ? 10 : 1
      shapes = shapes.map((shape) => selectedIds.includes(shape.id) ? { ...shape, x: shape.x + nudge[0] * step, y: shape.y + nudge[1] * step } : shape)
      commit()
    }
  }
  const keyup = (event: KeyboardEvent) => {
    if (event.code === 'Space') { spaceHeld = false; if (interaction.kind === 'idle') setCursor('default') }
  }
  const blur = () => { spaceHeld = false; if (interaction.kind !== 'idle' && interaction.kind !== 'pinching') cancelInteraction(); pointers.clear() }
  const contextMenu = (event: MouseEvent) => event.preventDefault()

  host.addEventListener('pointerdown', down)
  window.addEventListener('pointermove', move, true)
  window.addEventListener('pointerup', up, true)
  window.addEventListener('pointercancel', cancelPointer, true)
  host.addEventListener('pointerleave', leave)
  host.addEventListener('wheel', wheel, { passive: false })
  host.addEventListener('contextmenu', contextMenu)
  host.addEventListener('gesturestart', gestureStartHandler)
  host.addEventListener('gesturechange', gestureChange)
  host.addEventListener('gestureend', gestureEnd)
  window.addEventListener('keydown', keydown)
  window.addEventListener('keyup', keyup)
  window.addEventListener('blur', blur)
  const observer = new ResizeObserver(() => {
    const next = { w: host.clientWidth, h: host.clientHeight }
    if (next.w === viewport.w && next.h === viewport.h) return
    viewport = next
    stage.size({ width: Math.max(1, next.w), height: Math.max(1, next.h) })
    setCamera(camera)
  })
  observer.observe(host)
  void document.fonts?.ready.then(() => { palette = readPalette(host); stage.batchDraw() })

  syncNodes()
  applyCamera()

  const editor = {
    getShapes: () => shapes,
    getShape: (id: string) => shapeById(id),
    getSelectedIds: () => selectedIds,
    getSelectedShapes: selectedShapes,
    getCanvas: (): SceneCanvas => ({ format: 'canon-scene-canvas', version: 1, shapes: shapes.map((shape) => ({ ...shape })), ...(legacyTldraw !== undefined ? { legacyTldraw } : {}) }),
    getCamera: () => camera,
    getViewportPageBounds: () => viewportPageBounds(camera, viewport),
    select: (ids: string[]) => setSelection(ids),
    selectNone: () => setSelection([]),
    /** Cria um token no centro da vista, com o tamanho padrão do editor antigo. */
    createToken(entityId: string) {
      const bounds = viewportPageBounds(camera, viewport)
      const id = newShapeId()
      shapes = [...shapes, { id, kind: 'token', x: bounds.x + bounds.w / 2 - TOKEN_DEFAULT.w / 2, y: bounds.y + bounds.h / 2 - TOKEN_DEFAULT.h / 2, rotation: 0, ...TOKEN_DEFAULT, entityId, representation: 'cutout', visibility: 'visible', locked: false, flipX: false }]
      commit()
      return id
    },
    updateShapes(patches: ShapePatch[]) {
      if (patches.length === 0) return
      const byId = new Map(patches.map((patch) => [patch.id, patch]))
      shapes = shapes.map((shape) => { const patch = byId.get(shape.id); return patch ? { ...shape, ...patch, id: shape.id, kind: shape.kind } as SceneCanvasShape : shape })
      commit()
    },
    deleteShapes(ids: string[]) {
      const remove = new Set(ids.filter((id) => shapeById(id)?.kind === 'token'))
      if (remove.size === 0) return
      shapes = shapes.filter((shape) => !remove.has(shape.id))
      if (hoveredId && remove.has(hoveredId)) hoveredId = null
      setSelection(selectedIds.filter((id) => !remove.has(id)))
      commit()
    },
    bringToFront(ids: string[]) {
      const moving = shapes.filter((shape) => ids.includes(shape.id))
      shapes = [...shapes.filter((shape) => !ids.includes(shape.id)), ...moving]
      commit()
    },
    sendToBack(ids: string[]) {
      const moving = shapes.filter((shape) => ids.includes(shape.id))
      shapes = [...moving, ...shapes.filter((shape) => !ids.includes(shape.id))]
      commit()
    },
    fitBackground,
    setView(next: SceneView) {
      const modeChanged = next.mode !== view.mode
      view = next
      if (modeChanged) { hoveredId = null; if (interaction.kind !== 'idle') cancelInteraction() }
      stage.batchDraw()
    },
    destroy() {
      stopCameraAnimation()
      observer.disconnect()
      host.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', cancelPointer, true)
      host.removeEventListener('pointerleave', leave)
      host.removeEventListener('wheel', wheel)
      host.removeEventListener('contextmenu', contextMenu)
      host.removeEventListener('gesturestart', gestureStartHandler)
      host.removeEventListener('gesturechange', gestureChange)
      host.removeEventListener('gestureend', gestureEnd)
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('keyup', keyup)
      window.removeEventListener('blur', blur)
      stage.destroy()
    },
  }
  return editor
}

export type SceneEditor = ReturnType<typeof createSceneEditor>