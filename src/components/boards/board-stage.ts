import K from 'konva'
import type { Context } from 'konva/lib/Context'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TriangleAlert } from 'lucide-react'
import { assetVariantUrl } from '@/lib/assetUrl'
import { arrowFrame, arrowGeometry, arrowStrokeWidth, bendHandle, bendThrough, distanceToPath, type ArrowGeometry } from '@/domain/boards/boardArrow'
import { CARD_DEFAULT, CARD_MIN, type ArrowBinding, type BoardArrow, type BoardCanvas, type BoardCard, type BoardShape, type BoardText } from '@/domain/boards/boardCanvas'
import { ARROW_LABEL_FONT_SIZES, BOARD_PALETTE, TEXT_FONT_SIZES, TEXT_LINE_HEIGHT } from '@/domain/boards/boardStyles'
import { constrainCamera, interpolateCamera, screenToPage, stepZoom, viewportPageBounds, wheelCamera, zoomAt, type CameraState, type Rect, type Size } from '@/domain/canvas/camera'
import {
  boundsOf, distanceSq, frameCenter, frameCorners, frameIntersectsRect, hitsFrame, resizePoint, resizeTransform, rotateAround, rotationDelta, selectionFrameOf, toLocal, toPage,
  type Frame, type Point, type ResizeHandle,
} from '@/domain/canvas/geometry'
import { createHistory } from '@/domain/canvas/history'
import { drawArrow, drawBoardBackground, drawCard, drawLegacy, drawText, layoutArrowLabel, layoutText, readBoardPalette, type BoardPalette, type LabelLayout, type TextLayout } from './board-render'
import type { BoardEntitySummary } from './board-types'

export type BoardTool = 'select' | 'hand' | 'text' | 'arrow'
export type BoardEditorCallbacks = {
  documentChanged: () => void
  selectionChanged: () => void
  cameraChanged: () => void
  toolChanged: () => void
  openEntity: (entityId: string) => void
}
type ShapePatch = { id: string } & Partial<Record<string, unknown>>

// Tema escuro do tldraw 5.4.1: mesma cor de seleção, alças e área.
const SELECTION_STROKE = 'hsl(214, 84%, 56%)'
const SELECTION_CONTRAST = '#ffffff'
const BRUSH_FILL = 'hsla(0, 0%, 56%, 0.102)'
const BRUSH_STROKE = 'hsla(0, 0%, 56%, 0.251)'
const LINE_WIDTH = 1.5
const HINT_LINE_WIDTH = 2.5
const HANDLE_SIZE = 8
const HANDLE_RADIUS = 4
const HIT_TARGET = 6
const HIT_MARGIN = 3
const DRAG_DISTANCE = 4
const COARSE_DRAG_DISTANCE = 6
const DOUBLE_CLICK_MS = 450
const ZOOM_DURATION = 250
const DUPLICATE_OFFSET = 16
const CLIPBOARD_PREFIX = 'canon-board-shapes:'

const ROTATE_CURSOR = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10 22a9 9 0 1 1 12 0" stroke="#fff" stroke-width="5"/><path d="M22 16v6h6" stroke="#fff" stroke-width="5"/><path d="M10 22a9 9 0 1 1 12 0" stroke="#000" stroke-width="2"/><path d="M22 16v6h6" stroke="#000" stroke-width="2"/></g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 16 16, crosshair`
})()

const isField = (target: EventTarget | null) => target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')
const newShapeId = () => `shape:${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`}`
const deg = (radians: number) => radians * 180 / Math.PI
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

// Área de transferência compartilhada entre quadros abertos nesta aba.
let clipboard: BoardShape[] | null = null

export function createBoardEditor(host: HTMLElement, options: {
  canvas: BoardCanvas
  entities: Map<string, BoardEntitySummary>
  camera: CameraState | null
  callbacks: BoardEditorCallbacks
}) {
  const { callbacks } = options
  let entities = options.entities
  let shapes: BoardShape[] = clone(options.canvas.shapes)
  const legacyTldraw = options.canvas.legacyTldraw
  let selectedIds: string[] = []
  let hoveredId: string | null = null
  let hintId: string | null = null
  let tool: BoardTool = 'select'
  let editingId: string | null = null
  let palette: BoardPalette = readBoardPalette(host)
  let viewport: Size = { w: host.clientWidth, h: host.clientHeight }
  let camera: CameraState = options.camera ?? { x: 0, y: 0, z: 1 }
  let cameraAnimation: number | null = null
  const history = createHistory<{ shapes: BoardShape[]; selected: string[] }>()

  const stage = new K.Stage({ container: host as HTMLDivElement, width: Math.max(1, viewport.w), height: Math.max(1, viewport.h), listening: false })
  const backgroundLayer = new K.Layer({ listening: false })
  const shapeLayer = new K.Layer({ listening: false })
  const overlayLayer = new K.Layer({ listening: false })
  stage.add(backgroundLayer, shapeLayer, overlayLayer)
  const measure = document.createElement('canvas').getContext('2d')!
  const supportsFilter = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype

  // ---------- Imagens ----------
  const images = new Map<string, HTMLImageElement>()
  const loadImage = (src: string) => {
    let img = images.get(src)
    if (!img) {
      img = new window.Image()
      img.decoding = 'async'
      img.onload = () => shapeLayer.batchDraw()
      img.src = src
      images.set(src, img)
    }
    return img.complete && img.naturalWidth > 0 ? img : null
  }
  const assetImage = (assetId: string, variant: 'original' | 'thumbnail') => loadImage(assetVariantUrl(assetId, variant))
  let warningSrc: string | null = null
  const warningIcon = () => {
    warningSrc ??= `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderToStaticMarkup(createElement(TriangleAlert)).replaceAll('currentColor', palette.warning))}`
    return loadImage(warningSrc)
  }

  // ---------- Medidas ----------
  const textLayouts = new Map<string, { key: string; layout: TextLayout }>()
  const textLayout = (shape: BoardText) => {
    const key = `${shape.text}|${shape.font}|${shape.size}|${shape.scale}|${shape.autoSize}|${shape.w}|${palette.fonts[shape.font]}`
    const cached = textLayouts.get(shape.id)
    if (cached?.key === key) return cached.layout
    const layout = layoutText(measure, shape, palette)
    textLayouts.set(shape.id, { key, layout })
    return layout
  }
  const shapeById = (id: string) => shapes.find((shape) => shape.id === id)

  /** Moldura de uma forma na página (para acerto, seleção e vínculo de setas). */
  const frameOf = (shape: BoardShape): Frame => {
    switch (shape.kind) {
      case 'card': case 'legacy': return { x: shape.x, y: shape.y, w: shape.w, h: shape.h, rotation: shape.rotation }
      case 'text': { const layout = textLayout(shape); return { x: shape.x, y: shape.y, w: layout.width, h: layout.height, rotation: shape.rotation } }
      case 'arrow': { const box = boundsOf(geometryOf(shape).points); return { ...box, w: Math.max(box.w, 1), h: Math.max(box.h, 1), rotation: 0 } }
    }
  }
  const bindableFrame = (id: string) => { const shape = shapeById(id); return shape && shape.kind !== 'arrow' ? frameOf(shape) : null }
  const geometryOf = (arrow: BoardArrow): ArrowGeometry => arrowGeometry(arrow, bindableFrame)
  const labelOf = (arrow: BoardArrow, geometry = geometryOf(arrow)): LabelLayout | null => layoutArrowLabel(measure, editingId === arrow.id ? { ...arrow, text: arrow.text || ' ' } : arrow, geometry, palette)

  // ---------- Desenho ----------
  const backgroundNode = new K.Shape({ listening: false, perfectDrawEnabled: false, sceneFunc: (context: Context) => drawBoardBackground(context._context, viewport.w, viewport.h, palette) })
  backgroundLayer.add(backgroundNode)

  const drawShape = (ctx: CanvasRenderingContext2D, shape: BoardShape) => {
    ctx.globalAlpha *= shape.opacity
    switch (shape.kind) {
      case 'card': drawCard(ctx, shape, entities.get(shape.entityId), palette, assetImage, warningIcon, supportsFilter); break
      case 'text': if (editingId !== shape.id) drawText(ctx, shape, textLayout(shape)); break
      case 'arrow': { const geometry = geometryOf(shape); drawArrow(ctx, editingId === shape.id ? { ...shape, text: '' } : shape, geometry, editingId === shape.id ? null : labelOf(shape, geometry)); break }
      case 'legacy': drawLegacy(ctx, shape, palette); break
    }
  }
  const nodes = new Map<string, K.Shape>()
  const syncNodes = () => {
    const ids = new Set(shapes.map((shape) => shape.id))
    for (const [id, node] of nodes) if (!ids.has(id)) { node.destroy(); nodes.delete(id); textLayouts.delete(id) }
    shapes.forEach((shape, index) => {
      let node = nodes.get(shape.id)
      if (!node) {
        const id = shape.id
        node = new K.Shape({ listening: false, perfectDrawEnabled: false, sceneFunc: (context: Context) => { const current = shapeById(id); if (current) drawShape(context._context, current) } })
        shapeLayer.add(node)
        nodes.set(shape.id, node)
      }
      // Setas são desenhadas em coordenadas da página, porque seguem as formas vinculadas.
      if (shape.kind === 'arrow') node.setAttrs({ x: 0, y: 0, rotation: 0 })
      else node.setAttrs({ x: shape.x, y: shape.y, rotation: deg(shape.rotation) })
      node.zIndex(index)
    })
    shapeLayer.batchDraw()
  }

  type Interaction =
    | { kind: 'idle' }
    | { kind: 'pointing'; pointerId: number; startScreen: Point; startPage: Point; targetId: string | null; shift: boolean; wasSelected: boolean; coarse: boolean }
    | { kind: 'translating'; pointerId: number; startPage: Point; initial: BoardShape[]; before: { shapes: BoardShape[]; selected: string[] } }
    | { kind: 'brushing'; pointerId: number; startPage: Point; rect: Rect; base: string[] }
    | { kind: 'panning'; pointerId: number; last: Point }
    | { kind: 'resizing'; pointerId: number; handle: ResizeHandle; frame: Frame; initial: BoardShape[]; before: { shapes: BoardShape[]; selected: string[] } }
    | { kind: 'rotating'; pointerId: number; center: Point; startPage: Point; baseRotation: number; initial: BoardShape[]; before: { shapes: BoardShape[]; selected: string[] } }
    | { kind: 'handle'; pointerId: number; arrowId: string; which: 'start' | 'end' | 'middle'; before: { shapes: BoardShape[]; selected: string[] } }
    | { kind: 'pointing_arrow'; pointerId: number; startScreen: Point; startPage: Point; coarse: boolean }
    | { kind: 'pinching'; startDistance: number; startMid: Point; startCamera: CameraState }
  let interaction: Interaction = { kind: 'idle' }

  const selectedShapes = () => shapes.filter((shape) => selectedIds.includes(shape.id))
  const snapshot = () => ({ shapes: clone(shapes), selected: [...selectedIds] })
  const onlyArrow = () => { const selection = selectedShapes(); return selection.length === 1 && selection[0].kind === 'arrow' ? selection[0] : null }
  const canResize = (shape: BoardShape) => shape.kind !== 'arrow' || !shape.startBinding || !shape.endBinding
  const showControls = () => (interaction.kind === 'idle' || interaction.kind === 'pointing') && !editingId && tool === 'select'

  const controls = () => {
    const selection = selectedShapes()
    if (selection.length === 0 || !showControls() || onlyArrow()) return null
    const frame = selectionFrameOf(selection.map(frameOf))
    if (!frame) return null
    const z = camera.z, handleSize = HANDLE_SIZE / z, hit = HIT_TARGET / z
    const tinyX = frame.w < handleSize * 2, tinyY = frame.h < handleSize * 2
    const text = selection.length === 1 && selection[0].kind === 'text'
    return { frame, handleSize, resizable: selection.some(canResize), rotatable: !(tinyX || tinyY), cornerHit: hit * 1.5, rotateSize: hit * 1.62, edgeHit: hit, verticalEdges: !text }
  }

  const strokeIndicator = (ctx: CanvasRenderingContext2D, shape: BoardShape, width: number) => {
    ctx.save()
    ctx.strokeStyle = SELECTION_STROKE
    ctx.lineWidth = width / camera.z
    if (shape.kind === 'arrow') {
      const { points } = geometryOf(shape)
      ctx.beginPath(); points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); ctx.stroke()
    } else {
      const frame = frameOf(shape)
      ctx.translate(frame.x, frame.y); ctx.rotate(frame.rotation); ctx.strokeRect(0, 0, frame.w, frame.h)
    }
    ctx.restore()
  }
  const drawHandle = (ctx: CanvasRenderingContext2D, p: Point) => {
    const z = camera.z
    ctx.beginPath(); ctx.arc(p.x, p.y, HANDLE_RADIUS / z, 0, Math.PI * 2)
    ctx.fillStyle = SELECTION_CONTRAST; ctx.fill()
    ctx.strokeStyle = SELECTION_STROKE; ctx.lineWidth = LINE_WIDTH / z; ctx.stroke()
  }
  const arrowHandles = (arrow: BoardArrow) => {
    const geometry = geometryOf(arrow)
    return { start: geometry.start, end: geometry.end, middle: bendHandle(geometry.start, geometry.end, arrow.bend) }
  }

  const drawOverlay = (ctx: CanvasRenderingContext2D) => {
    const z = camera.z
    for (const shape of selectedShapes()) if (shape.id !== editingId) strokeIndicator(ctx, shape, LINE_WIDTH)
    const busy = interaction.kind === 'brushing' || interaction.kind === 'panning' || interaction.kind === 'pinching'
    if (hoveredId && !selectedIds.includes(hoveredId) && (interaction.kind === 'idle' || busy) && tool === 'select') {
      const hovered = shapeById(hoveredId)
      if (hovered) strokeIndicator(ctx, hovered, LINE_WIDTH)
    }
    if (hintId) { const hinted = shapeById(hintId); if (hinted) strokeIndicator(ctx, hinted, HINT_LINE_WIDTH) }
    if (interaction.kind === 'brushing') {
      const { rect } = interaction
      ctx.fillStyle = BRUSH_FILL; ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      ctx.strokeStyle = BRUSH_STROKE; ctx.lineWidth = 1 / z; ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
    }
    const arrow = onlyArrow()
    if (arrow && !editingId && (interaction.kind === 'idle' || interaction.kind === 'pointing' || interaction.kind === 'handle')) {
      const handles = arrowHandles(arrow)
      drawHandle(ctx, handles.start); drawHandle(ctx, handles.end); drawHandle(ctx, handles.middle)
      return
    }
    const c = controls()
    if (!c) return
    ctx.save()
    ctx.translate(c.frame.x, c.frame.y); ctx.rotate(c.frame.rotation)
    ctx.strokeStyle = SELECTION_STROKE; ctx.lineWidth = LINE_WIDTH / z
    ctx.strokeRect(0, 0, c.frame.w, c.frame.h)
    if (c.resizable) {
      ctx.fillStyle = SELECTION_CONTRAST
      const s = c.handleSize
      for (const [x, y] of [[0, 0], [c.frame.w, 0], [c.frame.w, c.frame.h], [0, c.frame.h]]) { ctx.fillRect(x - s / 2, y - s / 2, s, s); ctx.strokeRect(x - s / 2, y - s / 2, s, s) }
    }
    ctx.restore()
  }
  const overlayNode = new K.Shape({ listening: false, perfectDrawEnabled: false, sceneFunc: (context: Context) => drawOverlay(context._context) })
  overlayLayer.add(overlayNode)
  const redrawOverlay = () => overlayLayer.batchDraw()

  // ---------- Câmera ----------
  const applyCamera = () => {
    for (const layer of [shapeLayer, overlayLayer]) { layer.scale({ x: camera.z, y: camera.z }); layer.position({ x: camera.x * camera.z, y: camera.y * camera.z }) }
    stage.batchDraw()
    positionEditor()
    callbacks.cameraChanged()
  }
  const setCamera = (next: CameraState) => { camera = constrainCamera(next, camera, viewport, null); applyCamera() }
  const stopCameraAnimation = () => { if (cameraAnimation !== null) { cancelAnimationFrame(cameraAnimation); cameraAnimation = null } }
  const animateTo = (target: CameraState, animate = true) => {
    stopCameraAnimation()
    target = constrainCamera(target, camera, viewport, null)
    if (!animate) { camera = target; applyCamera(); return }
    const from = camera, start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ZOOM_DURATION)
      camera = t >= 1 ? target : interpolateCamera(from, target, viewport, t)
      applyCamera()
      cameraAnimation = t >= 1 ? null : requestAnimationFrame(step)
    }
    cameraAnimation = requestAnimationFrame(step)
  }
  const zoomCentered = (z: number) => animateTo(zoomAt(camera, { x: viewport.w / 2, y: viewport.h / 2 }, z))
  const contentBounds = (list: BoardShape[]) => list.length ? boundsOf(list.flatMap((shape) => frameCorners(frameOf(shape)))) : null
  /** Enquadra como o `zoomToBounds` do tldraw: margem de 128 px (ou 28% da largura) e zoom opcional máximo. */
  const zoomToBounds = (bounds: Rect | null, animate = true, maxZoom = Infinity) => {
    if (!bounds) return
    const inset = Math.min(128, viewport.w * 0.28)
    const w = Math.max(bounds.w, 1), h = Math.max(bounds.h, 1)
    const z = Math.min(maxZoom, (viewport.w - inset) / w, (viewport.h - inset) / h)
    animateTo({ x: -bounds.x + (viewport.w / z - w) / 2, y: -bounds.y + (viewport.h / z - h) / 2, z }, animate)
  }

  // ---------- Documento ----------
  const commit = () => { syncNodes(); redrawOverlay(); callbacks.documentChanged() }
  const mark = (before = snapshot()) => history.mark(before)
  const setSelection = (ids: string[]) => {
    const next = ids.filter((id) => { const shape = shapeById(id); return !!shape && !shape.locked })
    if (next.length === selectedIds.length && next.every((id, i) => id === selectedIds[i])) return
    selectedIds = next
    redrawOverlay()
    callbacks.selectionChanged()
  }
  const replaceShapes = (next: BoardShape[]) => {
    const byId = new Map(next.map((shape) => [shape.id, shape]))
    shapes = shapes.map((shape) => byId.get(shape.id) ?? shape)
  }
  const restore = (state: { shapes: BoardShape[]; selected: string[] }) => {
    shapes = clone(state.shapes)
    selectedIds = []
    setSelection(state.selected)
    commit()
    callbacks.selectionChanged()
  }

  /** Desfaz o vínculo das setas com formas que não estão indo junto, mantendo a ponta onde está. */
  const unbindFrom = (arrow: BoardArrow, keep: Set<string>): BoardArrow => {
    const geometry = geometryOf(arrow)
    const own = arrowFrame(arrow)
    const next = { ...arrow }
    if (arrow.startBinding && !keep.has(arrow.startBinding.shapeId)) { next.start = toLocal(own, geometry.start); next.startBinding = null }
    if (arrow.endBinding && !keep.has(arrow.endBinding.shapeId)) { next.end = toLocal(own, geometry.end); next.endBinding = null }
    return next
  }

  // ---------- Acerto ----------
  const pointerPoint = (event: { clientX: number; clientY: number }): Point => {
    const rect = host.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  const pageAt = (screen: Point) => screenToPage(screen, camera)
  const hitShape = (shape: BoardShape, page: Point) => {
    const margin = HIT_MARGIN / camera.z
    if (shape.kind === 'arrow') {
      const geometry = geometryOf(shape)
      if (distanceToPath(geometry.points, page) <= arrowStrokeWidth(shape) / 2 + margin + 4 / camera.z) return true
      const label = labelOf(shape, geometry)
      return !!label && Math.abs(page.x - label.center.x) <= label.width / 2 && Math.abs(page.y - label.center.y) <= label.height / 2
    }
    return hitsFrame(frameOf(shape), page, margin)
  }
  /** Forma sob o ponto, da frente para trás, ignorando travadas. */
  const shapeAt = (page: Point, filter: (shape: BoardShape) => boolean = () => true) => [...shapes].reverse().find((shape) => !shape.locked && filter(shape) && hitShape(shape, page))
  const bindTargetAt = (page: Point, arrowId: string) => [...shapes].reverse().find((shape) => shape.kind !== 'arrow' && shape.id !== arrowId && hitsFrame(frameOf(shape), page, HIT_MARGIN / camera.z))

  type ControlHit = { kind: 'resize'; handle: ResizeHandle } | { kind: 'rotate' } | { kind: 'arrow'; which: 'start' | 'end' | 'middle' }
  const controlAt = (page: Point): ControlHit | null => {
    const arrow = onlyArrow()
    if (arrow && !editingId && tool === 'select') {
      const handles = arrowHandles(arrow), r = (HANDLE_RADIUS + 4) / camera.z
      for (const which of ['start', 'end', 'middle'] as const) if (distanceSq(handles[which], page) <= r * r) return { kind: 'arrow', which }
      return null
    }
    const c = controls()
    if (!c) return null
    const local = toLocal(c.frame, page)
    const { w, h } = c.frame
    const corners: Array<[ResizeHandle, number, number]> = [['top_left', 0, 0], ['top_right', w, 0], ['bottom_right', w, h], ['bottom_left', 0, h]]
    if (c.resizable) for (const [handle, x, y] of corners) if (Math.abs(local.x - x) <= c.cornerHit && Math.abs(local.y - y) <= c.cornerHit) return { kind: 'resize', handle }
    if (c.rotatable) {
      const r = c.rotateSize
      for (const [x, y] of [[-r, -r], [w + r, -r], [w + r, h + r], [-r, h + r]]) if (distanceSq(local, { x, y }) <= r * r) return { kind: 'rotate' }
    }
    if (c.resizable) {
      const e = c.edgeHit
      const inX = local.x > c.cornerHit && local.x < w - c.cornerHit, inY = local.y > c.cornerHit && local.y < h - c.cornerHit
      if (c.verticalEdges && inX && Math.abs(local.y) <= e) return { kind: 'resize', handle: 'top' }
      if (c.verticalEdges && inX && Math.abs(local.y - h) <= e) return { kind: 'resize', handle: 'bottom' }
      if (inY && Math.abs(local.x) <= e) return { kind: 'resize', handle: 'left' }
      if (inY && Math.abs(local.x - w) <= e) return { kind: 'resize', handle: 'right' }
    }
    return null
  }
  const resizeCursor = (handle: ResizeHandle, frame: Frame) => {
    const local = { top_left: [0, 0], top_right: [frame.w, 0], bottom_right: [frame.w, frame.h], bottom_left: [0, frame.h], top: [frame.w / 2, 0], right: [frame.w, frame.h / 2], bottom: [frame.w / 2, frame.h], left: [0, frame.h / 2] }[handle]
    const point = toPage(frame, { x: local[0], y: local[1] }), center = frameCenter(frame)
    const angle = ((Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI % 180) + 180) % 180
    if (handle === 'top' || handle === 'bottom' || handle === 'left' || handle === 'right') return angle < 22.5 || angle >= 157.5 ? 'ew-resize' : angle < 67.5 ? 'nwse-resize' : angle < 112.5 ? 'ns-resize' : 'nesw-resize'
    return angle < 90 ? 'nwse-resize' : 'nesw-resize'
  }

  // ---------- Transformações ----------
  const resizeShape = (shape: BoardShape, t: ReturnType<typeof resizeTransform>, handle: ResizeHandle): BoardShape => {
    const sx = Math.abs(t.sx), sy = Math.abs(t.sy)
    if (!canResize(shape)) return shape
    switch (shape.kind) {
      case 'card': return { ...shape, ...resizePoint(t, shape), w: Math.max(CARD_MIN.w, shape.w * sx), h: Math.max(CARD_MIN.h, shape.h * sy) }
      case 'legacy': return { ...shape, ...resizePoint(t, shape), w: Math.max(1, shape.w * sx), h: Math.max(1, shape.h * sy) }
      case 'text': {
        // Cantos mudam a escala do texto; bordas laterais mudam só a largura (quebra de linha).
        if ((handle === 'left' || handle === 'right') && selectedIds.length === 1) {
          const layout = textLayout(shape)
          return { ...shape, ...resizePoint(t, shape), w: Math.max(TEXT_FONT_SIZES[shape.size], layout.width / shape.scale * sx), autoSize: false }
        }
        return { ...shape, ...resizePoint(t, shape), scale: Math.max(0.05, shape.scale * Math.max(sx, sy)) }
      }
      case 'arrow': {
        const own = arrowFrame(shape)
        const start = resizePoint(t, toPage(own, shape.start)), end = resizePoint(t, toPage(own, shape.end))
        const origin = resizePoint(t, shape)
        const moved = { ...shape, ...origin }
        const local = (p: Point) => toLocal(arrowFrame(moved), p)
        return { ...moved, start: shape.startBinding ? shape.start : local(start), end: shape.endBinding ? shape.end : local(end), bend: shape.bend * Math.sqrt(sx * sy) }
      }
    }
  }

  // ---------- Entrada ----------
  let spaceHeld = false
  let lastDown: { time: number; point: Point } | null = null
  const pointers = new Map<number, Point>()
  const setCursor = (cursor: string) => { if (host.style.cursor !== cursor) host.style.cursor = cursor }
  const toolCursor = () => tool === 'hand' || spaceHeld ? 'grab' : tool === 'select' ? 'default' : 'crosshair'

  const updateHover = (screen: Point) => {
    if (interaction.kind !== 'idle') return
    const page = pageAt(screen)
    if (tool !== 'select' || spaceHeld) {
      setCursor(toolCursor())
      const next = tool === 'arrow' ? bindTargetAt(page, '')?.id ?? null : null
      if (next !== hintId) { hintId = next; redrawOverlay() }
      if (hoveredId) { hoveredId = null; redrawOverlay() }
      return
    }
    const control = controlAt(page), c = controls()
    if (control?.kind === 'resize' && c) setCursor(resizeCursor(control.handle, c.frame))
    else if (control?.kind === 'rotate') setCursor(ROTATE_CURSOR)
    else if (control?.kind === 'arrow') setCursor('grab')
    else setCursor('default')
    const next = shapeAt(page)?.id ?? null
    if (next !== hoveredId) { hoveredId = next; redrawOverlay() }
  }

  const cancelInteraction = () => {
    if ('before' in interaction) {
      const { before } = interaction
      interaction = { kind: 'idle' }
      shapes = clone(before.shapes)
      selectedIds = []
      setSelection(before.selected)
      commit()
    }
    interaction = { kind: 'idle' }
    hintId = null
    redrawOverlay()
  }

  const startTranslate = (pointerId: number, startPage: Point, alt: boolean) => {
    const before = snapshot()
    mark(before)
    let moving = selectedShapes()
    if (alt && moving.length > 0) {
      // Alt ao arrastar duplica, como no tldraw: as cópias ficam logo acima das originais.
      const copies = duplicateShapes(moving, { x: 0, y: 0 })
      const top = Math.max(...moving.map((shape) => shapes.indexOf(shape)))
      shapes = [...shapes.slice(0, top + 1), ...copies, ...shapes.slice(top + 1)]
      selectedIds = copies.map((shape) => shape.id)
      callbacks.selectionChanged()
      moving = copies
    }
    const keep = new Set(moving.map((shape) => shape.id))
    moving = moving.map((shape) => shape.kind === 'arrow' ? unbindFrom(shape, keep) : shape)
    replaceShapes(moving)
    interaction = { kind: 'translating', pointerId, startPage, initial: clone(moving), before }
  }

  /** Copia formas com IDs novos, refazendo os vínculos entre as copiadas. */
  const duplicateShapes = (list: BoardShape[], offset: Point): BoardShape[] => {
    const ids = new Map(list.map((shape) => [shape.id, newShapeId()]))
    return list.map((shape) => {
      let copy = clone(shape)
      if (copy.kind === 'arrow') {
        copy = unbindFrom(copy, new Set(ids.keys()))
        const remap = (binding: ArrowBinding | null) => binding ? { ...binding, shapeId: ids.get(binding.shapeId)! } : null
        copy = { ...copy, startBinding: remap(copy.startBinding), endBinding: remap(copy.endBinding) }
      }
      return { ...copy, id: ids.get(shape.id)!, x: copy.x + offset.x, y: copy.y + offset.y }
    })
  }

  const down = (event: PointerEvent) => {
    if (isField(event.target)) return
    if (editingId) stopEditing()
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
    host.focus({ preventScroll: true })
    if (event.button === 1 || (event.button === 0 && (spaceHeld || tool === 'hand'))) {
      event.preventDefault()
      interaction = { kind: 'panning', pointerId: event.pointerId, last: screen }
      setCursor('grabbing')
      return
    }
    if (event.button !== 0) return
    const page = pageAt(screen)
    const coarse = event.pointerType !== 'mouse'
    if (tool === 'text') {
      createText(page)
      return
    }
    if (tool === 'arrow') {
      interaction = { kind: 'pointing_arrow', pointerId: event.pointerId, startScreen: screen, startPage: page, coarse }
      return
    }
    const now = performance.now()
    if (lastDown && now - lastDown.time < DOUBLE_CLICK_MS && distanceSq(lastDown.point, screen) < 16 * 16) {
      lastDown = null
      const hit = shapeAt(page)
      if (hit?.kind === 'card') callbacks.openEntity(hit.entityId)
      else if (hit?.kind === 'text' || hit?.kind === 'arrow') { setSelection([hit.id]); startEditing(hit.id) }
      else if (!hit) createText(page)
      return
    }
    lastDown = { time: now, point: screen }
    const control = controlAt(page)
    if (control) {
      const before = snapshot()
      mark(before)
      if (control.kind === 'arrow') interaction = { kind: 'handle', pointerId: event.pointerId, arrowId: onlyArrow()!.id, which: control.which, before }
      else {
        const frame = selectionFrameOf(selectedShapes().map(frameOf))!
        const initial = clone(selectedShapes())
        interaction = control.kind === 'resize'
          ? { kind: 'resizing', pointerId: event.pointerId, handle: control.handle, frame, initial, before }
          : { kind: 'rotating', pointerId: event.pointerId, center: frameCenter(frame), startPage: page, baseRotation: initial.length === 1 ? frame.rotation : 0, initial, before }
      }
      redrawOverlay()
      return
    }
    const target = shapeAt(page)
    const wasSelected = !!target && selectedIds.includes(target.id)
    if (target && !wasSelected) setSelection(event.shiftKey ? [...selectedIds, target.id] : [target.id])
    interaction = { kind: 'pointing', pointerId: event.pointerId, startScreen: screen, startPage: page, targetId: target?.id ?? null, shift: event.shiftKey, wasSelected, coarse }
    redrawOverlay()
  }

  const move = (event: PointerEvent) => {
    const screen = pointerPoint(event)
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, screen)
    if (interaction.kind === 'pinching') {
      if (pointers.size < 2) return
      const [a, b] = [...pointers.values()]
      const distance = Math.max(1, Math.sqrt(distanceSq(a, b))), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
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
      case 'pointing_arrow': {
        const limit = interaction.coarse ? COARSE_DRAG_DISTANCE : DRAG_DISTANCE
        if (distanceSq(screen, interaction.startScreen) < limit * limit) return
        // Cria a seta a partir do ponto inicial, vinculada à forma que estiver embaixo.
        const before = snapshot()
        mark(before)
        const start = interaction.startPage
        const id = newShapeId()
        const target = event.ctrlKey ? undefined : bindTargetAt(start, id)
        const arrow: BoardArrow = {
          id, kind: 'arrow', x: start.x, y: start.y, rotation: 0, opacity: 1, locked: false, start: { x: 0, y: 0 }, end: { x: page.x - start.x, y: page.y - start.y }, bend: 0,
          color: 'black', labelColor: 'black', size: 'm', font: 'draw', dash: 'draw', arrowheadStart: 'none', arrowheadEnd: 'arrow', text: '', labelPosition: 0.5, scale: 1,
          startBinding: target ? bindingFor(target, start) : null, endBinding: null,
        }
        shapes = [...shapes, arrow]
        selectedIds = [id]
        callbacks.selectionChanged()
        interaction = { kind: 'handle', pointerId: interaction.pointerId, arrowId: id, which: 'end', before }
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
        const inside = shapes.filter((shape) => !shape.locked && frameIntersectsRect(frameOf(shape), rect)).map((shape) => shape.id)
        setSelection([...new Set([...interaction.base, ...inside])])
        redrawOverlay()
        return
      }
      case 'resizing': {
        const { handle } = interaction
        const corner = handle !== 'left' && handle !== 'right' && handle !== 'top' && handle !== 'bottom'
        const t = resizeTransform(interaction.frame, handle, page, event.altKey, event.shiftKey || (corner && interaction.initial.some((shape) => shape.kind === 'text')))
        replaceShapes(interaction.initial.map((shape) => resizeShape(shape, t, handle)))
        commit()
        return
      }
      case 'rotating': {
        const delta = rotationDelta(interaction.center, interaction.startPage, page, interaction.baseRotation, event.shiftKey)
        const { center } = interaction
        replaceShapes(interaction.initial.map((shape) => rotateAround(shape, center, delta)))
        commit()
        return
      }
      case 'handle': {
        const arrow = shapeById(interaction.arrowId)
        if (!arrow || arrow.kind !== 'arrow') return
        const own = arrowFrame(arrow)
        if (interaction.which === 'middle') {
          const geometry = geometryOf(arrow)
          replaceShapes([{ ...arrow, bend: bendThrough(geometry.start, geometry.end, page) }])
          hintId = null
        } else {
          const target = event.ctrlKey ? undefined : bindTargetAt(page, arrow.id)
          const key = interaction.which === 'start' ? 'startBinding' : 'endBinding'
          replaceShapes([{ ...arrow, [interaction.which]: toLocal(own, page), [key]: target ? bindingFor(target, page) : null } as BoardArrow])
          hintId = target?.id ?? null
        }
        commit()
        return
      }
    }
  }

  /** Vínculo imprecisa (mira o centro), como o tldraw faz ao soltar a ponta sobre uma forma. */
  const bindingFor = (target: BoardShape, page: Point): ArrowBinding => {
    const frame = frameOf(target), local = toLocal(frame, page)
    return { shapeId: target.id, anchor: { x: frame.w ? local.x / frame.w : 0.5, y: frame.h ? local.y / frame.h : 0.5 }, isPrecise: false, isExact: false }
  }

  const up = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    if (interaction.kind === 'pinching') { if (pointers.size < 2) interaction = { kind: 'idle' }; return }
    if (!('pointerId' in interaction) || interaction.pointerId !== event.pointerId) return
    host.releasePointerCapture?.(event.pointerId)
    const screen = pointerPoint(event)
    const ended = interaction
    interaction = { kind: 'idle' }
    hintId = null
    if (ended.kind === 'pointing') {
      if (ended.targetId) {
        if (ended.shift && ended.wasSelected) setSelection(selectedIds.filter((id) => id !== ended.targetId))
        else if (!ended.shift && ended.wasSelected) setSelection([ended.targetId])
      } else if (!ended.shift) setSelection([])
    }
    if (ended.kind === 'handle' && tool === 'arrow') setTool('select')
    if (ended.kind === 'pointing_arrow') setTool('select')
    if (ended.kind === 'panning') setCursor(toolCursor())
    redrawOverlay()
    updateHover(screen)
  }

  const cancelPointer = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    if (interaction.kind === 'pinching') { if (pointers.size < 2) interaction = { kind: 'idle' }; return }
    if ('pointerId' in interaction && interaction.pointerId === event.pointerId) cancelInteraction()
  }
  const leave = () => { if (hoveredId && interaction.kind === 'idle') { hoveredId = null; redrawOverlay() } }

  const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  const wheel = (event: WheelEvent) => {
    if (isField(event.target) && !editingId) return
    event.preventDefault()
    stopCameraAnimation()
    setCamera(wheelCamera(camera, event, pointerPoint(event), isApple))
  }
  let gestureStart: { scale: number; camera: CameraState } | null = null
  const gestureStartHandler = (event: Event) => { event.preventDefault(); gestureStart = { scale: (event as unknown as { scale: number }).scale, camera } }
  const gestureChange = (event: Event) => {
    event.preventDefault()
    if (!gestureStart) return
    const gesture = event as unknown as { scale: number; clientX: number; clientY: number }
    setCamera(zoomAt(camera, pointerPoint(gesture), gestureStart.camera.z * gesture.scale / gestureStart.scale))
  }
  const gestureEnd = (event: Event) => { event.preventDefault(); gestureStart = null }

  // ---------- Texto no canvas ----------
  let textarea: HTMLTextAreaElement | null = null
  let editingBefore: { shapes: BoardShape[]; selected: string[] } | null = null

  const createText = (page: Point) => {
    const before = snapshot()
    const size = 'm' as const, lineHeight = TEXT_FONT_SIZES[size] * TEXT_LINE_HEIGHT
    const shape: BoardText = { id: newShapeId(), kind: 'text', x: page.x, y: page.y - lineHeight / 2, rotation: 0, opacity: 1, locked: false, w: 8, text: '', color: 'black', size, font: 'draw', textAlign: 'start', autoSize: true, scale: 1 }
    shapes = [...shapes, shape]
    syncNodes()
    selectedIds = [shape.id]
    callbacks.selectionChanged()
    if (tool !== 'select') setTool('select')
    startEditing(shape.id, before)
  }

  function positionEditor() {
    if (!textarea || !editingId) return
    const shape = shapeById(editingId)
    if (!shape) return
    if (shape.kind === 'text') {
      const screen = { x: (shape.x + camera.x) * camera.z, y: (shape.y + camera.y) * camera.z }
      textarea.style.left = `${screen.x}px`
      textarea.style.top = `${screen.y}px`
      textarea.style.transform = `rotate(${shape.rotation}rad) scale(${camera.z * shape.scale})`
      textarea.style.width = shape.autoSize ? 'auto' : `${shape.w}px`
    } else if (shape.kind === 'arrow') {
      const geometry = geometryOf(shape), label = labelOf(shape, geometry)
      const center = label?.center ?? geometry.points[0]
      textarea.style.left = `${(center.x + camera.x) * camera.z}px`
      textarea.style.top = `${(center.y + camera.y) * camera.z}px`
      textarea.style.transform = `translate(-50%, -50%) scale(${camera.z})`
    }
  }
  const fitTextarea = () => {
    if (!textarea || !editingId) return
    const shape = shapeById(editingId)
    textarea.style.height = '0px'
    textarea.style.height = `${textarea.scrollHeight}px`
    if (shape?.kind === 'text' && shape.autoSize) { textarea.style.width = '0px'; textarea.style.width = `${Math.max(8, textarea.scrollWidth + 2)}px` }
    if (shape?.kind === 'arrow') { textarea.style.width = '0px'; textarea.style.width = `${Math.max(40, textarea.scrollWidth + 2)}px` }
  }

  function startEditing(id: string, before = snapshot()) {
    const shape = shapeById(id)
    if (!shape || (shape.kind !== 'text' && shape.kind !== 'arrow')) return
    stopEditing()
    editingId = id
    editingBefore = before
    const area = document.createElement('textarea')
    textarea = area
    const fontSize = shape.kind === 'text' ? TEXT_FONT_SIZES[shape.size] : ARROW_LABEL_FONT_SIZES[shape.size] * shape.scale
    const color = shape.kind === 'text' ? shape.color : shape.labelColor
    Object.assign(area.style, {
      position: 'absolute', zIndex: '5', margin: '0', padding: '0', border: 'none', outline: 'none', resize: 'none', overflow: 'hidden', background: 'transparent',
      transformOrigin: shape.kind === 'text' ? 'top left' : 'center', font: `${fontSize}px ${palette.fonts[shape.font]}`, lineHeight: String(TEXT_LINE_HEIGHT),
      color: BOARD_PALETTE[color].solid, whiteSpace: shape.kind === 'text' && !shape.autoSize ? 'pre-wrap' : 'pre',
      textAlign: shape.kind === 'arrow' ? 'center' : shape.textAlign === 'middle' ? 'center' : shape.textAlign === 'end' ? 'right' : 'left',
      caretColor: SELECTION_STROKE, minWidth: '8px',
    } satisfies Partial<CSSStyleDeclaration>)
    area.value = shape.text
    area.spellcheck = false
    area.setAttribute('aria-label', shape.kind === 'text' ? 'Texto' : 'Rótulo da seta')
    area.addEventListener('input', () => {
      const current = shapeById(id)
      if (!current || (current.kind !== 'text' && current.kind !== 'arrow')) return
      replaceShapes([{ ...current, text: area.value }])
      syncNodes()
      fitTextarea()
      positionEditor()
    })
    area.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) { event.preventDefault(); event.stopPropagation(); stopEditing() }
    })
    area.addEventListener('blur', () => { if (editingId === id) stopEditing() })
    host.appendChild(area)
    positionEditor()
    fitTextarea()
    syncNodes()
    redrawOverlay()
    requestAnimationFrame(() => { area.focus(); area.setSelectionRange(area.value.length, area.value.length); if (shape.text) area.select() })
  }

  function stopEditing() {
    if (!editingId) return
    const id = editingId, before = editingBefore
    editingId = null
    editingBefore = null
    const area = textarea
    textarea = null
    area?.remove()
    const shape = shapeById(id)
    if (shape?.kind === 'text' && !shape.text.trim()) {
      // Texto vazio some ao sair da edição, como no tldraw.
      shapes = shapes.filter((item) => item.id !== id)
      setSelection(selectedIds.filter((item) => item !== id))
      if (before && before.shapes.some((item) => item.id === id)) mark(before)
    } else if (before && JSON.stringify(before.shapes) !== JSON.stringify(shapes)) mark(before)
    commit()
    host.focus({ preventScroll: true })
  }

  // ---------- Teclado e área de transferência ----------
  const nudgeSelected = (dx: number, dy: number) => {
    mark()
    const keep = new Set(selectedIds)
    shapes = shapes.map((shape) => {
      if (!keep.has(shape.id)) return shape
      const free = shape.kind === 'arrow' ? unbindFrom(shape, keep) : shape
      return { ...free, x: free.x + dx, y: free.y + dy }
    })
    commit()
  }
  const reorder = (mode: 'front' | 'back' | 'forward' | 'backward') => {
    if (selectedIds.length === 0) return
    mark()
    const chosen = new Set(selectedIds)
    if (mode === 'front') shapes = [...shapes.filter((s) => !chosen.has(s.id)), ...shapes.filter((s) => chosen.has(s.id))]
    else if (mode === 'back') shapes = [...shapes.filter((s) => chosen.has(s.id)), ...shapes.filter((s) => !chosen.has(s.id))]
    else {
      const list = [...shapes]
      const indices = list.map((s, i) => chosen.has(s.id) ? i : -1).filter((i) => i >= 0)
      if (mode === 'forward') for (const i of indices.reverse()) { if (i < list.length - 1 && !chosen.has(list[i + 1].id)) [list[i], list[i + 1]] = [list[i + 1], list[i]] }
      else for (const i of indices) { if (i > 0 && !chosen.has(list[i - 1].id)) [list[i], list[i - 1]] = [list[i - 1], list[i]] }
      shapes = list
    }
    commit()
  }

  const keydown = (event: KeyboardEvent) => {
    if (editingId || isField(event.target) || event.defaultPrevented) return
    const mod = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    if (event.code === 'Space') {
      if (!spaceHeld) { spaceHeld = true; if (interaction.kind === 'idle') setCursor('grab') }
      event.preventDefault()
      return
    }
    if (event.key === 'Escape') {
      if (interaction.kind !== 'idle') cancelInteraction()
      else if (tool !== 'select') setTool('select')
      else setSelection([])
      return
    }
    if (interaction.kind !== 'idle') return
    if (mod && key === 'z') { event.preventDefault(); if (event.shiftKey) editor.redo(); else editor.undo(); return }
    if (mod && key === 'y') { event.preventDefault(); editor.redo(); return }
    if (mod && key === 'd') { event.preventDefault(); editor.duplicate(); return }
    if (mod && key === 'a') { event.preventDefault(); setSelection(shapes.filter((s) => !s.locked).map((s) => s.id)); return }
    if (mod && (event.key === '=' || event.key === '+')) { event.preventDefault(); editor.zoomIn(); return }
    if (mod && event.key === '-') { event.preventDefault(); editor.zoomOut(); return }
    if (mod) return
    if (event.shiftKey && event.code === 'Digit1') { event.preventDefault(); editor.zoomToFit(); return }
    if (event.shiftKey && event.code === 'Digit2') { event.preventDefault(); editor.zoomToSelection(); return }
    if (event.shiftKey && event.code === 'Digit0') { event.preventDefault(); editor.resetZoom(); return }
    if (event.shiftKey && key === 'l') { event.preventDefault(); editor.toggleLock(); return }
    if (!event.shiftKey && (event.key === '=' || event.key === '+')) { editor.zoomIn(); return }
    if (!event.shiftKey && event.key === '-') { editor.zoomOut(); return }
    if (event.key === 'Delete' || event.key === 'Backspace') { if (selectedIds.length) { event.preventDefault(); editor.deleteSelected() } return }
    if (event.key === 'Enter') {
      const only = selectedShapes()
      if (only.length === 1 && (only[0].kind === 'text' || only[0].kind === 'arrow')) { event.preventDefault(); startEditing(only[0].id) }
      return
    }
    if (event.key === ']') { reorder(event.altKey ? 'forward' : 'front'); return }
    if (event.key === '[') { reorder(event.altKey ? 'backward' : 'back'); return }
    const nudge = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[event.key]
    if (nudge && selectedIds.length > 0 && !event.altKey && !spaceHeld) {
      event.preventDefault()
      const step = event.shiftKey ? 10 : 1
      nudgeSelected(nudge[0] * step, nudge[1] * step)
      return
    }
    if (event.altKey || event.shiftKey) return
    const tools: Record<string, BoardTool> = { v: 'select', h: 'hand', a: 'arrow', t: 'text' }
    if (tools[key]) { event.preventDefault(); setTool(tools[key]) }
  }
  const keyup = (event: KeyboardEvent) => { if (event.code === 'Space') { spaceHeld = false; if (interaction.kind === 'idle') setCursor(toolCursor()) } }
  const blur = () => { spaceHeld = false; if (interaction.kind !== 'idle' && interaction.kind !== 'pinching') cancelInteraction(); pointers.clear() }
  const contextMenu = (event: MouseEvent) => { if (!isField(event.target)) event.preventDefault() }

  const copySelection = (event: ClipboardEvent) => {
    if (editingId || isField(event.target) || selectedIds.length === 0) return false
    clipboard = clone(selectedShapes())
    event.clipboardData?.setData('text/plain', CLIPBOARD_PREFIX + JSON.stringify(clipboard))
    event.preventDefault()
    return true
  }
  const onCopy = (event: ClipboardEvent) => { copySelection(event) }
  const onCut = (event: ClipboardEvent) => { if (copySelection(event)) editor.deleteSelected() }
  const onPaste = (event: ClipboardEvent) => {
    if (editingId || isField(event.target)) return
    const text = event.clipboardData?.getData('text/plain') ?? ''
    let source: BoardShape[] | null = null
    if (text.startsWith(CLIPBOARD_PREFIX)) { try { source = JSON.parse(text.slice(CLIPBOARD_PREFIX.length)) as BoardShape[] } catch { source = null } }
    else if (!text && clipboard) source = clipboard
    event.preventDefault()
    if (source && source.length) {
      // Cola no mesmo lugar se a origem está visível; senão, no centro da vista.
      const bounds = contentBounds(source)!, view = viewportPageBounds(camera, viewport)
      const visible = bounds.x < view.x + view.w && bounds.x + bounds.w > view.x && bounds.y < view.y + view.h && bounds.y + bounds.h > view.y
      const offset = visible ? { x: 0, y: 0 } : { x: view.x + view.w / 2 - (bounds.x + bounds.w / 2), y: view.y + view.h / 2 - (bounds.y + bounds.h / 2) }
      mark()
      const copies = duplicateShapes(source, offset)
      shapes = [...shapes, ...copies]
      selectedIds = []
      setSelection(copies.map((shape) => shape.id))
      commit()
    } else if (text.trim()) {
      // Texto comum vira uma forma de texto no centro da vista, como no tldraw.
      mark()
      const view = viewportPageBounds(camera, viewport)
      const shape: BoardText = { id: newShapeId(), kind: 'text', x: view.x + view.w / 2, y: view.y + view.h / 2, rotation: 0, opacity: 1, locked: false, w: 8, text: text.trim(), color: 'black', size: 'm', font: 'draw', textAlign: 'start', autoSize: true, scale: 1 }
      const layout = textLayout(shape)
      shape.x -= layout.width / 2; shape.y -= layout.height / 2
      shapes = [...shapes, shape]
      setSelection([shape.id])
      commit()
    }
  }

  function setTool(next: BoardTool) {
    if (tool === next) return
    if (editingId) stopEditing()
    tool = next
    hintId = null
    hoveredId = null
    setCursor(toolCursor())
    redrawOverlay()
    callbacks.toolChanged()
  }

  host.tabIndex = -1
  host.style.outline = 'none'
  host.style.position = host.style.position || 'relative'
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
  window.addEventListener('copy', onCopy)
  window.addEventListener('cut', onCut)
  window.addEventListener('paste', onPaste)
  const observer = new ResizeObserver(() => {
    const next = { w: host.clientWidth, h: host.clientHeight }
    if (next.w === viewport.w && next.h === viewport.h) return
    viewport = next
    stage.size({ width: Math.max(1, next.w), height: Math.max(1, next.h) })
    applyCamera()
  })
  observer.observe(host)
  void document.fonts?.ready.then(() => { palette = readBoardPalette(host); textLayouts.clear(); stage.batchDraw() })

  syncNodes()
  if (!options.camera && shapes.length) zoomToBounds(contentBounds(shapes), false)
  else applyCamera()

  const editor = {
    getShapes: () => shapes,
    getShape: (id: string) => shapeById(id),
    getSelectedIds: () => selectedIds,
    getSelectedShapes: selectedShapes,
    getTool: () => tool,
    setTool,
    getCamera: () => camera,
    getCanvas: (): BoardCanvas => ({ format: 'canon-board-canvas', version: 1, shapes: clone(shapes), ...(legacyTldraw !== undefined ? { legacyTldraw } : {}) }),
    screenToPage: (client: { clientX: number; clientY: number }) => pageAt(pointerPoint(client)),
    select: (ids: string[]) => setSelection(ids),
    selectNone: () => setSelection([]),
    setEntities(next: Map<string, BoardEntitySummary>) { entities = next; shapeLayer.batchDraw() },
    /** Cartão de registro no ponto (ou no centro da vista), selecionado, como o quadro anterior. */
    createCard(entityId: string, point?: Point) {
      const view = viewportPageBounds(camera, viewport)
      const center = point ?? { x: view.x + view.w / 2, y: view.y + view.h / 2 }
      mark()
      const card: BoardCard = { id: newShapeId(), kind: 'card', x: center.x - CARD_DEFAULT.w / 2, y: center.y - CARD_DEFAULT.h / 2, rotation: 0, opacity: 1, locked: false, ...CARD_DEFAULT, entityId, viewMode: 'card', showImage: true, showType: true, showTags: true, showStatus: true, customLabel: '' }
      shapes = [...shapes, card]
      setTool('select')
      selectedIds = []
      setSelection([card.id])
      commit()
    },
    updateShapes(patches: ShapePatch[]) {
      if (patches.length === 0) return
      mark()
      const byId = new Map(patches.map((patch) => [patch.id, patch]))
      shapes = shapes.map((shape) => { const patch = byId.get(shape.id); return patch ? { ...shape, ...patch, id: shape.id, kind: shape.kind } as BoardShape : shape })
      commit()
      callbacks.selectionChanged()
    },
    deleteSelected() {
      const remove = new Set(selectedIds)
      if (remove.size === 0) return
      mark()
      // Setas ligadas a formas apagadas ficam, com a ponta solta onde estava.
      shapes = shapes.filter((shape) => !remove.has(shape.id)).map((shape) => shape.kind === 'arrow' && (remove.has(shape.startBinding?.shapeId ?? '') || remove.has(shape.endBinding?.shapeId ?? ''))
        ? unbindFrom(shape, new Set(shapes.map((s) => s.id).filter((id) => !remove.has(id)))) : shape)
      hoveredId = null
      selectedIds = []
      callbacks.selectionChanged()
      commit()
    },
    duplicate() {
      const selection = selectedShapes()
      if (selection.length === 0) return
      mark()
      const copies = duplicateShapes(selection, { x: DUPLICATE_OFFSET, y: DUPLICATE_OFFSET })
      shapes = [...shapes, ...copies]
      selectedIds = []
      setSelection(copies.map((shape) => shape.id))
      commit()
    },
    toggleLock() {
      const selection = selectedShapes()
      if (selection.length === 0) return
      mark()
      const ids = new Set(selection.map((shape) => shape.id))
      shapes = shapes.map((shape) => ids.has(shape.id) ? { ...shape, locked: true } : shape)
      selectedIds = []
      callbacks.selectionChanged()
      commit()
    },
    undo() { const previous = history.undo(snapshot()); if (previous) restore(previous) },
    redo() { const next = history.redo(snapshot()); if (next) restore(next) },
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    getZoom: () => camera.z,
    zoomIn: () => zoomCentered(stepZoom(camera.z, 1)),
    zoomOut: () => zoomCentered(stepZoom(camera.z, -1)),
    resetZoom: () => zoomCentered(1),
    zoomToFit: () => zoomToBounds(contentBounds(shapes)),
    zoomToSelection: () => zoomToBounds(contentBounds(selectedShapes()), true, Math.max(1, camera.z)),
    destroy() {
      stopEditing()
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
      window.removeEventListener('copy', onCopy)
      window.removeEventListener('cut', onCut)
      window.removeEventListener('paste', onPaste)
      stage.destroy()
    },
  }
  return editor
}


export type BoardEditor = ReturnType<typeof createBoardEditor>
