import K from 'konva'
import type { ShapeConfig } from 'konva/lib/Shape'
import { traceSilhouette } from '@/domain/canvas/entitySilhouettes'
import { entityVisualFor, NEUTRAL_ENTITY_VISUAL, type SilhouetteId, type TextureId } from '@/domain/entities/entityVisual'
import { textureOpacity, type Rgb } from '@/lib/canvas/colorContrast'
import { entityTexturePatterns } from '@/lib/canvas/entityTextures'
import {
  CARD_HEIGHT, CARD_WIDTH, cardCenter, fitGraph, freeArrowPoints, relationshipLanes, relationshipPoints, resizeGraph, zoomGraph,
  type ArrowEndpoint, type Camera, type Point,
} from '@/domain/relations/graphGeometry'
import type { FreeArrow } from '@/domain/relations/graphSettings'
import { strokeDash, type GraphStyle } from '@/domain/relations/graphStyles'
import { relationDirection, type Relation } from '@/domain/relations/relation'
import type { GraphEntity } from '@/domain/relations/relationshipGraph'

type Hit = { kind: 'card' | 'port' | 'edge' | 'arrow' | 'start' | 'end'; id: string }
export type GraphTool = 'move' | 'connect' | 'arrow'
export type SceneState = {
  entities: GraphEntity[]; relations: Relation[]; styles: GraphStyle[]; annotations: FreeArrow[]
  visibleIds: Set<string>; visibleRelationIds: Set<string>; positions: Record<string, Point>
  dimmedIds: Set<string>; dimmedRelationIds: Set<string>
  typeLabels: Record<string, string>
  tool: GraphTool; source: string; target: string; selectedCard: string; selectedEdge: string; selectedArrow: string
  arrowStart: ArrowEndpoint | null; arrowEnd: ArrowEndpoint | null
}
type Callbacks = {
  select: (hit: Hit | null, point: Point) => void
  connect: (source: string, target: string) => void
  move: (id: string, point: Point) => void
  dragCard: (id: string, client: Point | null) => void
  dropCard: (id: string, client: Point) => boolean
  moveArrow: (id: string, end: 'start' | 'end', endpoint: ArrowEndpoint) => void
  cancel: () => void
}
type Bounds = { left: number; top: number; right: number; bottom: number }
const bounds = (points: number[], margin = 0): Bounds => {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  for (let i = 0; i < points.length; i += 2) {
    left = Math.min(left, points[i]); right = Math.max(right, points[i])
    top = Math.min(top, points[i + 1]); bottom = Math.max(bottom, points[i + 1])
  }
  return { left: left - margin, top: top - margin, right: right + margin, bottom: bottom + margin }
}
const intersects = (a: Bounds, b: Bounds) => a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y
const limit = (n: number) => Math.max(-1_000_000, Math.min(1_000_000, n))
const isField = (target: EventTarget | null) => target instanceof Element && !!target.closest('input, textarea, select, button, a, [contenteditable], [role="dialog"]')

/** A CSS colour as 8-bit sRGB, read back from a 1×1 canvas so any colour syntax works. */
function toRgb(color: string, probe: CanvasRenderingContext2D | null): Rgb {
  if (!probe) return [0, 0, 0]
  probe.clearRect(0, 0, 1, 1); probe.fillStyle = '#000'; probe.fillStyle = color; probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}
const brightness = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b

function readPalette(host: HTMLElement) {
  const style = getComputedStyle(host)
  const token = (name: string) => style.getPropertyValue('--' + name).trim()
  const colors = { card: token('surface-raised'), text: token('foreground'), muted: token('muted-foreground'), border: token('input'), accent: token('primary') }
  // Textures always darken the card: they use the darker of the page's background and text colours,
  // at the opacity that keeps the card's text readable (ADR-011).
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const background = token('background')
  const rgb = { card: toRgb(colors.card, probe), text: toRgb(colors.text, probe), muted: toRgb(colors.muted, probe), background: toRgb(background, probe) }
  const darkBackground = brightness(rgb.background) < brightness(rgb.text)
  return {
    ...colors, ink: darkBackground ? background : colors.text, inkRgb: darkBackground ? rgb.background : rgb.text,
    cardRgb: rgb.card, textRgbs: [rgb.text, rgb.muted], textureOpacity: new Map<TextureId, number>(),
  }
}
type Palette = ReturnType<typeof readPalette>
/** Contrast between the strongest texel of a texture and the plain card. */
const TEXTURE_TARGET_CONTRAST = 1.2
/** A texture's pattern and the opacity to draw it with on this palette, or null for none. */
function texturePaint(palette: Palette, texture: TextureId, target: CanvasRenderingContext2D, dpr: number) {
  const tile = entityTexturePatterns.get(target, texture, palette.ink, dpr)
  if (!tile) return null
  let opacity = palette.textureOpacity.get(texture)
  if (opacity === undefined) {
    opacity = textureOpacity({ card: palette.cardRgb, ink: palette.inkRgb, texts: palette.textRgbs, peak: tile.peak, target: TEXTURE_TARGET_CONTRAST })
    palette.textureOpacity.set(texture, opacity)
  }
  return opacity > 0 ? { pattern: tile.pattern, opacity } : null
}

type CurveConfig = ShapeConfig & { points?: number[] }
type BatchedStroke = { path: Path2D; tips: Path2D; color: string; dash: number[]; opacity: number }
function appendCurve(context: Pick<Path2D, 'moveTo' | 'bezierCurveTo'>, p: number[]) {
  context.moveTo(p[0], p[1])
  context.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7])
}
function appendTip(path: Path2D, x: number, y: number, angle: number) {
  const back = 11, side = 5
  const cos = Math.cos(angle), sin = Math.sin(angle)
  path.moveTo(x, y)
  path.lineTo(x - back * cos + side * sin, y - back * sin - side * cos)
  path.lineTo(x - back * cos - side * sin, y - back * sin + side * cos)
  path.closePath()
}
// Batched view: many connections share one path per style, so the stage draws a few strokes
// instead of one Konva group per connection. It enters above OVERVIEW_ENTER connections in
// the viewport and leaves below OVERVIEW_EXIT, so small zoom steps don't flip modes.
const OVERVIEW_ENTER = 300, OVERVIEW_EXIT = 220, LABEL_SCALE = 1.05
// Below this zoom titles are hidden, so idle cards are drawn as plain shapes in one batch.
const TITLE_SCALE = 0.47, PORT_SCALE = 0.23
function traceCurve(context: K.Context, shape: K.Shape) {
  const p = shape.getAttr('points') as number[]
  if (!p?.length) return
  context.beginPath()
  appendCurve(context, p)
  context.strokeShape(shape)
}

// Cards take the silhouette of their record type (ADR-011). Every silhouette fits the card box and
// touches the midpoint of each side, so anchors and framing still use the box; clicks use it too,
// which keeps the hit graph a plain rectangle.
// The texture is a second fill of the same outline, between the solid fill and the stroke.
type TexturePaint = (target: CanvasRenderingContext2D) => { pattern: CanvasPattern; opacity: number } | null
type CardBoxConfig = ShapeConfig & { silhouette?: SilhouetteId; texture?: TexturePaint | null }
const silhouetteOf = (shape: K.Shape) => (shape.getAttr('silhouette') as SilhouetteId | undefined) ?? NEUTRAL_ENTITY_VISUAL.silhouette
function traceCardBox(context: K.Context, shape: K.Shape) {
  context.beginPath()
  traceSilhouette(context, silhouetteOf(shape), 0, 0, CARD_WIDTH, CARD_HEIGHT)
  const paint = (shape.getAttr('texture') as TexturePaint | null | undefined)?.(context._context)
  if (!paint) { context.fillStrokeShape(shape); return }
  context.fillShape(shape)
  const native = context._context, alpha = native.globalAlpha
  native.globalAlpha = alpha * paint.opacity; native.fillStyle = paint.pattern; native.fill()
  native.globalAlpha = alpha
  context.strokeShape(shape)
}
function hitCardBox(context: K.Context, shape: K.Shape) {
  context.beginPath()
  context.rect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  context.closePath()
  context.fillStrokeShape(shape)
}

function createCard(item: GraphEntity, point: Point) {
  const group = new K.Group(point)
  const box = new K.Shape<CardBoxConfig>({ width: CARD_WIDTH, height: CARD_HEIGHT, sceneFunc: traceCardBox, hitFunc: hitCardBox, strokeWidth: 1.5, perfectDrawEnabled: false })
  const title = new K.Text({ x: 13, y: 11, width: 154, height: 34, fontSize: 15, lineHeight: 1.12, fontStyle: 'bold', fontFamily: 'system-ui', ellipsis: true, wrap: 'word', listening: false })
  const type = new K.Text({ x: 13, y: 49, width: 154, fontSize: 12, fontFamily: 'system-ui', ellipsis: true, wrap: 'none', listening: false })
  const port = new K.Circle({ x: CARD_WIDTH - 1, y: CARD_HEIGHT / 2, radius: 7, hitStrokeWidth: 16, strokeWidth: 2, perfectDrawEnabled: false })
  group.setAttr('graphHit', { kind: 'card', id: item.id } satisfies Hit)
  port.setAttr('graphHit', { kind: 'port', id: item.id } satisfies Hit)
  group.add(box, title, type, port)
  return { group, box, title, type, port }
}
function createEdge(id: string) {
  const group = new K.Group()
  const line = new K.Shape<CurveConfig>({ points: [], sceneFunc: traceCurve, hitStrokeWidth: 16, perfectDrawEnabled: false })
  const start = new K.RegularPolygon({ sides: 3, radius: 7, listening: false })
  const end = new K.RegularPolygon({ sides: 3, radius: 7, listening: false })
  const direction = new K.RegularPolygon({ sides: 3, radius: 8, listening: false })
  const startDirection = new K.RegularPolygon({ sides: 3, radius: 8, listening: false })
  const symbol = new K.RegularPolygon({ sides: 4, radius: 5, listening: false })
  const label = new K.Label({ listening: false })
  const labelBox = new K.Tag({ cornerRadius: 4 })
  const text = new K.Text({ fontFamily: 'system-ui', fontSize: 12, padding: 5, ellipsis: true, wrap: 'none' })
  label.add(labelBox, text)
  group.add(line, start, end, direction, startDirection, symbol, label)
  group.setAttr('graphHit', { kind: 'edge', id } satisfies Hit)
  return { group, line, start, end, direction, startDirection, symbol, label, labelBox, text,
    bounds: bounds([]), lane: 0, source: null as Point | null, target: null as Point | null }
}
function createArrow(data: FreeArrow) {
  const { id } = data
  const group = new K.Group()
  const line = new K.Arrow({ pointerLength: 11, pointerWidth: 10, strokeWidth: 2.5, hitStrokeWidth: 18, perfectDrawEnabled: false })
  const start = new K.Circle({ radius: 7, hitStrokeWidth: 12, strokeWidth: 2 })
  const end = new K.Circle({ radius: 7, hitStrokeWidth: 12, strokeWidth: 2 })
  group.setAttr('graphHit', { kind: 'arrow', id } satisfies Hit)
  start.setAttr('graphHit', { kind: 'start', id } satisfies Hit)
  end.setAttr('graphHit', { kind: 'end', id } satisfies Hit)
  group.add(line)
  return { data, group, line, start, end, bounds: bounds([]) }
}

type Drag = { pointer: number; start: Point; hit: Hit | null; moved: boolean; origin: Point | null; pan: boolean; scale: number }

export function createRelationshipScene(host: HTMLDivElement, callbacks: Callbacks) {
  const stage = new K.Stage({ container: host, width: host.clientWidth, height: host.clientHeight })
  const edgesLayer = new K.Layer()
  const cardsLayer = new K.Layer()
  const preview = new K.Arrow({ visible: false, listening: false, pointerLength: 12, pointerWidth: 10, strokeWidth: 2.5, dash: [7, 4] })
  const targetRing = new K.Shape<CardBoxConfig>({ visible: false, listening: false, width: CARD_WIDTH, height: CARD_HEIGHT, sceneFunc: traceCardBox, strokeWidth: 3 })
  let batchedCards: (Point & { id: string; silhouette: SilhouetteId; texture: TextureId; faded?: boolean })[] = []
  let batchedPorts = false
  // Below PORT_SCALE cards are a few pixels tall: only silhouette and fill are drawn.
  let texturesVisible = true
  const pixelRatio = () => cardsLayer.getCanvas().getPixelRatio()
  const cardTexture = (texture: TextureId): TexturePaint | null =>
    texture === 'none' ? null : (target) => texturesVisible ? texturePaint(palette, texture, target, pixelRatio()) : null
  const cardBatch = new K.Shape({ listening: false, perfectDrawEnabled: false, sceneFunc(context) {
    if (!batchedCards.length) return
    const solid = new Path2D(), faded = new Path2D(), ports = new Path2D()
    // Textured cards are traced once more, into one path per texture: at most 17 extra fills.
    const textured = new Map<TextureId, Path2D>()
    for (const point of batchedCards) {
      const path = point.faded ? faded : solid
      traceSilhouette(path, point.silhouette, point.x, point.y, CARD_WIDTH, CARD_HEIGHT)
      if (texturesVisible && !point.faded && point.texture !== 'none') {
        let texturePath = textured.get(point.texture)
        if (!texturePath) textured.set(point.texture, texturePath = new Path2D())
        traceSilhouette(texturePath, point.silhouette, point.x, point.y, CARD_WIDTH, CARD_HEIGHT)
      }
      if (batchedPorts) { ports.moveTo(point.x + CARD_WIDTH + 6, point.y + CARD_HEIGHT / 2); ports.arc(point.x + CARD_WIDTH - 1, point.y + CARD_HEIGHT / 2, 7, 0, Math.PI * 2) }
    }
    context.save()
    context.setAttr('lineWidth', 1.5)
    context.setAttr('fillStyle', palette.card); context.setAttr('strokeStyle', palette.border)
    context.setAttr('globalAlpha', 1); context.fill(solid)
    for (const [texture, path] of textured) {
      const paint = texturePaint(palette, texture, context._context, pixelRatio())
      if (!paint) continue
      context.setAttr('globalAlpha', paint.opacity); context.setAttr('fillStyle', paint.pattern); context.fill(path)
    }
    context.setAttr('globalAlpha', 1); context.stroke(solid)
    context.setAttr('fillStyle', palette.card)
    context.setAttr('globalAlpha', 0.22); context.fill(faded); context.stroke(faded)
    if (batchedPorts) { context.setAttr('globalAlpha', 1); context.setAttr('fillStyle', palette.accent); context.fill(ports) }
    context.restore()
  } })
  cardsLayer.add(cardBatch, targetRing, preview)
  stage.add(edgesLayer, cardsLayer)
  // Konva redraws the hit graph of a layer on every frame. Pan, zoom and drags change the scene
  // every frame while hit testing only happens on pointer input, so the hit graph is redrawn
  // on demand, once per scene change, right before a hit test reads it.
  let hitDirty = true
  for (const layer of [edgesLayer, cardsLayer]) {
    layer.draw = function draw() { this.drawScene(); hitDirty = true; return this }
  }
  const refreshHit = () => {
    if (!hitDirty) return
    hitDirty = false
    edgesLayer.drawHit(); cardsLayer.drawHit()
  }
  const cards = new Map<string, ReturnType<typeof createCard>>()
  const edges = new Map<string, ReturnType<typeof createEdge>>()
  const arrows = new Map<string, ReturnType<typeof createArrow>>()
  let arrowsByCard = new Map<string, FreeArrow[]>()
  let overviewPaths: BatchedStroke[] | null = null
  let overviewDrag = ''
  let movingEdges = new Set<string>()
  const overview = new K.Shape({ visible: false, listening: false, perfectDrawEnabled: false, sceneFunc(context) {
    if (!state) return
    if (!overviewPaths) {
      const groups = new Map<string, BatchedStroke>()
      for (const id of state.visibleRelationIds) {
        if (id === state.selectedEdge || movingEdges.has(id)) continue
        const line = edges.get(id)?.line
        const points = line?.getAttr('points') as number[] | undefined
        if (!line || !points?.length) continue
        const color = line.stroke(), dash = line.dash()
        if (typeof color !== 'string') continue
        const opacity = state.dimmedRelationIds.has(id) ? 0.17 : 0.7
        const key = color + '/' + dash.join(',') + '/' + opacity
        let group = groups.get(key)
        if (!group) { group = { color, dash, path: new Path2D(), tips: new Path2D(), opacity }; groups.set(key, group) }
        appendCurve(group.path, points)
        const sense = edges.get(id)?.group.getAttr('sense') as string | undefined
        if (sense !== 'none') appendTip(group.tips, points[6], points[7], Math.atan2(points[7] - points[5], points[6] - points[4]))
        if (sense === 'both') appendTip(group.tips, points[0], points[1], Math.atan2(points[1] - points[3], points[0] - points[2]))
      }
      overviewPaths = [...groups.values()]
    }
    context.save()
    context.setAttr('lineWidth', 2.5)
    for (const { path, tips, color, dash, opacity } of overviewPaths) {
      context.setAttr('globalAlpha', opacity)
      context.setAttr('strokeStyle', color); context.setLineDash(dash); context.stroke(path)
      context.setAttr('fillStyle', color); context.fill(tips)
    }
    context.restore()
  } })
  edgesLayer.add(overview)
  const hitContext = document.createElement('canvas').getContext('2d')
  let incident = new Map<string, Relation[]>()
  let lanes = new Map<string, number>()
  let camera: Camera = { x: 0, y: 0, scale: 1 }
  let lowDetail = false
  let state: SceneState | undefined
  let palette = readPalette(host)
  let frame = 0
  let drag: Drag | null = null
  const pointers = new Map<number, Point>()
  let pinch: { center: Point; distance: number } | null = null
  let space = false
  let lastPointer: Point | null = null
  const dimensions = () => ({ x: stage.width(), y: stage.height() })
  const midpoint = () => ({ x: stage.width() / 2, y: stage.height() / 2 })
  const world = (p: Point) => ({ x: (p.x - camera.x) / camera.scale, y: (p.y - camera.y) / camera.scale })
  const position = (evt: MouseEvent) => {
    const rect = host.getBoundingClientRect()
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top }
  }
  const hitAt = (p: Point, includeBatchedEdge = true): Hit | null => {
    if (p.x < 0 || p.x >= stage.width() || p.y < 0 || p.y >= stage.height()) return null
    refreshHit()
    const layerHit = (layer: K.Layer) => {
      let shape: K.Node | null = layer.getIntersection(p)
      while (shape) {
        const hit = shape.getAttr('graphHit') as Hit | undefined
        if (hit) return hit
        shape = shape.getParent()
      }
      return null
    }
    const found = layerHit(cardsLayer) ?? batchedCardAt(world(p)) ?? layerHit(edgesLayer)
    if (found) return found
    if (includeBatchedEdge && overview.visible() && hitContext && state) {
      const point = world(p)
      const area = { left: point.x, right: point.x, top: point.y, bottom: point.y }
      hitContext.lineWidth = Math.min(28, 8 / camera.scale)
      for (const id of state.visibleRelationIds) {
        const edge = edges.get(id)
        if (!edge || !intersects(edge.bounds, area)) continue
        const points = edge.line.getAttr('points') as number[] | undefined
        if (!points?.length) continue
        const curve = new Path2D()
        appendCurve(curve, points)
        if (hitContext.isPointInStroke(curve, point.x, point.y)) return { kind: 'edge', id }
      }
    }
    return null
  }
  function batchedCardAt(point: Point): Hit | null {
    for (let i = batchedCards.length - 1; i >= 0; i--) {
      const card = batchedCards[i]
      if (batchedPorts && Math.hypot(point.x - (card.x + CARD_WIDTH - 1), point.y - (card.y + CARD_HEIGHT / 2)) <= 15) return { kind: 'port', id: card.id }
      if (point.x >= card.x && point.x <= card.x + CARD_WIDTH && point.y >= card.y && point.y <= card.y + CARD_HEIGHT) return { kind: 'card', id: card.id }
    }
    return null
  }
  const cardAt = (p: Point) => {
    const hit = hitAt(p, false)
    return (hit?.kind === 'card' || hit?.kind === 'port') && state?.visibleIds.has(hit.id) && !state.dimmedIds.has(hit.id) ? hit.id : ''
  }
  const cardPosition = (id: string) => cards.get(id)?.group.position()
  const showTargetRing = (id: string, point: Point) => {
    const box = cards.get(id)?.box
    targetRing.setAttrs({ ...point, stroke: palette.accent, silhouette: box ? silhouetteOf(box) : NEUTRAL_ENTITY_VISUAL.silhouette })
  }
  const annotationVisible = (arrow: FreeArrow) =>
    ![arrow.startCardId, arrow.endCardId].some((id) => id && cards.has(id) && !state?.visibleIds.has(id))
  function redrawPreview(p: Point | null) {
    if (!state) return
    if (state.tool === 'arrow') {
      const hover = p ? cardAt(p) : ''
      const destination = state.arrowEnd ?? (p && hover !== state.arrowStart?.cardId ? { point: world(p), cardId: hover || undefined } : null)
      const target = destination?.cardId ? cardPosition(destination.cardId) : undefined
      targetRing.visible(!!(state.arrowStart && target))
      if (target && destination?.cardId) showTargetRing(destination.cardId, target)
      preview.visible(!!(state.arrowStart && destination))
      if (state.arrowStart && destination) {
        const points = freeArrowPoints(state.arrowStart, destination, cardPosition)
        preview.setAttrs({ points, bezier: points.length === 8, stroke: palette.accent, fill: palette.accent })
      }
      return
    }
    const originId = drag?.hit?.kind === 'port' && !drag.pan && drag.moved ? drag.hit.id : state.tool === 'connect' ? state.source : ''
    const start = cards.get(originId)?.group.position()
    const hover = start && p ? cardAt(p) : ''
    const hoveredTarget = hover === originId ? '' : hover
    const endId = drag?.hit?.kind === 'port' && drag.moved ? hoveredTarget : state.target || hoveredTarget
    const end = endId ? cards.get(endId)?.group.position() : undefined
    const from = start ? { x: start.x + CARD_WIDTH, y: start.y + CARD_HEIGHT / 2 } : null
    const to = end ? cardCenter(end) : (p && hover !== originId && world(p))
    targetRing.visible(!!(start && end))
    if (end) showTargetRing(endId, end)
    const finalized = !!(start && state.target && !(drag?.hit?.kind === 'port' && drag.moved))
    preview.visible(!!(from && to && (!finalized || end)))
    if (from && to) {
      const points = start && end ? relationshipPoints(start, end, 0, endId === originId) : [from.x, from.y, to.x, to.y]
      preview.setAttrs({ points, bezier: points.length === 8, stroke: palette.accent, fill: palette.accent })
    }
  }
  function cull() {
    if (!state) return
    let attached = false
    // Culled nodes leave the layer instead of being hidden: Konva walks every descendant to clear
    // transform caches on each camera change, so detached nodes cost nothing while off screen.
    const show = (layer: K.Layer, node: K.Group, visible: boolean) => {
      const parent = node.getParent()
      if (visible && parent !== layer) { layer.add(node); attached = true }
      else if (!visible && parent) node.remove()
    }
    const { x, y } = dimensions()
    const min = world({ x: -120, y: -120 }), max = world({ x: x + 120, y: y + 120 })
    const viewport = { left: min.x, top: min.y, right: max.x, bottom: max.y }
    const active = drag && !drag.pan ? drag.hit?.id : undefined
    let inView = 0
    if (camera.scale < LABEL_SCALE && state.visibleRelationIds.size >= OVERVIEW_EXIT) {
      for (const id of state.visibleRelationIds) {
        const edge = edges.get(id)
        if (edge && intersects(edge.bounds, viewport) && ++inView >= OVERVIEW_ENTER) break
      }
    }
    lowDetail = camera.scale < LABEL_SCALE && inView >= (lowDetail ? OVERVIEW_EXIT : OVERVIEW_ENTER)
    if (lowDetail) {
      const draggedCard = drag?.moved && !drag.pan && drag.hit?.kind === 'card' ? drag.hit.id : ''
      if (draggedCard !== overviewDrag) {
        overviewDrag = draggedCard
        movingEdges = new Set((incident.get(draggedCard) ?? []).map((rel) => rel.id))
        overviewPaths = null
      }
    }
    overview.visible(lowDetail)
    const batch = camera.scale < TITLE_SCALE
    texturesVisible = camera.scale >= PORT_SCALE
    batchedCards = []
    batchedPorts = batch && camera.scale >= PORT_SCALE && state.tool === 'connect'
    for (const [id, { group, box, title, type, port }] of cards) {
      const x = group.x(), y = group.y()
      const visible = state.visibleIds.has(id) && (active === id || (x <= max.x && x + CARD_WIDTH >= min.x && y <= max.y && y + CARD_HEIGHT >= min.y))
      const selected = id === state.selectedCard || id === state.source || id === state.target || id === state.arrowStart?.cardId || id === state.arrowEnd?.cardId
      const batched = visible && batch && !selected && active !== id
      if (batched) batchedCards.push(Object.assign({ x, y, id, silhouette: silhouetteOf(box), texture: (box.getAttr('textureId') as TextureId | undefined) ?? 'none' },state.dimmedIds.has(id) ? { faded: true } : {}))
      show(cardsLayer, group, visible && !batched)
      if (visible && !batched) {
        title.visible(camera.scale >= TITLE_SCALE || selected)
        type.visible(camera.scale >= 0.72 || selected)
        port.visible((camera.scale >= PORT_SCALE && state.tool === 'connect') || (camera.scale >= 0.15 && selected))
      }
    }
    for (const [id, edge] of edges) {
      const selected = id === state.selectedEdge
      const visible = state.visibleRelationIds.has(id) && (selected || (lowDetail ? movingEdges.has(id) : intersects(edge.bounds, viewport)))
      show(edgesLayer, edge.group, visible)
      if (visible) {
        edge.label.visible(selected || camera.scale >= LABEL_SCALE)
        edge.line.hitStrokeWidth(Math.min(32, 10 / camera.scale))
      }
    }
    for (const [id, arrow] of arrows) {
      const visible = annotationVisible(arrow.data) && (active === id || intersects(arrow.bounds, viewport))
      arrow.group.visible(visible)
      arrow.start.visible(visible && state.selectedArrow === id)
      arrow.end.visible(visible && state.selectedArrow === id)
    }
    if (attached) {
      for (const arrow of arrows.values()) if (arrow.start.visible()) { arrow.start.moveToTop(); arrow.end.moveToTop() }
      targetRing.moveToTop(); preview.moveToTop()
    }
    cardsLayer.batchDraw()
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; cull() })
  }
  function setCamera(next: Camera) {
    camera = next
    stage.setAttrs({ x: next.x, y: next.y, scaleX: next.scale, scaleY: next.scale })
    schedule()
  }
  function fit() {
    if (!state) return
    const points = [...state.visibleIds].flatMap((id) => {
      const node = cards.get(id)
      return node ? [node.group.position()] : []
    })
    for (const relation of state.relations) {
      if (!state.visibleRelationIds.has(relation.id)) continue
      const edge = edges.get(relation.id)
      if (edge && (edge.lane !== 0 || relation.sourceId === relation.targetId)) {
        points.push({ x: edge.bounds.left, y: edge.bounds.top }, { x: edge.bounds.right - CARD_WIDTH, y: edge.bounds.bottom - CARD_HEIGHT })
      }
    }
    for (const arrow of arrows.values()) {
      if (!annotationVisible(arrow.data)) continue
      points.push(arrow.start.position(), arrow.end.position())
    }
    const padding = stage.width() < 640 ? 32 : stage.height() < 760 ? 112 : 136
    setCamera(fitGraph(points, stage.width(), stage.height(), padding))
  }
  function focus(id: string) {
    const group = cards.get(id)?.group
    if (!group) return
    const point = cardCenter(group.position())
    const center = midpoint()
    const scale = Math.max(0.85, camera.scale)
    setCamera({ x: center.x - point.x * scale, y: center.y - point.y * scale, scale })
  }
  function syncGeometry(relation: Relation, force = false) {
    const edge = edges.get(relation.id), a = cards.get(relation.sourceId), b = cards.get(relation.targetId)
    if (!edge || !a || !b) return
    const source = a.group.position(), target = b.group.position(), lane = lanes.get(relation.id) ?? 0
    if (!force && edge.source && edge.target && same(source, edge.source) && same(target, edge.target) && lane === edge.lane) return
    edge.source = source; edge.target = target; edge.lane = lane
    const p = relationshipPoints(source, target, lane, relation.sourceId === relation.targetId)
    edge.line.setAttr('points', p)
    edge.bounds = bounds(p, 26)
    const sense = relationDirection(relation)
    const terminal = (tip: K.RegularPolygon, marker: K.RegularPolygon, x: number, y: number, angle: number, directed: boolean) => {
      const offset = directed ? 8 : 0
      const extra = marker.visible()
      const shift = offset + (extra ? 12 : 0)
      tip.position({ x: x - Math.cos(angle) * shift, y: y - Math.sin(angle) * shift })
      tip.rotation(directed && !extra ? angle * 180 / Math.PI + 90 : 0)
      if (extra) {
        marker.position({ x: x - Math.cos(angle) * offset, y: y - Math.sin(angle) * offset })
        marker.rotation(angle * 180 / Math.PI + 90)
      }
    }
    terminal(edge.start, edge.startDirection, p[0], p[1], Math.atan2(p[1] - p[3], p[0] - p[2]), sense === 'both')
    terminal(edge.end, edge.direction, p[6], p[7], Math.atan2(p[7] - p[5], p[6] - p[4]), sense !== 'none')
    const mid = { x: (p[0] + 3 * p[2] + 3 * p[4] + p[6]) / 8, y: (p[1] + 3 * p[3] + 3 * p[5] + p[7]) / 8 }
    edge.symbol.position(mid)
    edge.label.position({ x: mid.x - edge.text.width() / 2, y: mid.y - 27 })
  }
  function syncArrow(arrow: ReturnType<typeof createArrow>, moving?: { end: 'start' | 'end'; point: Point }) {
    const data = arrow.data
    const start = moving?.end === 'start' ? { point: moving.point } : { point: data.start, cardId: data.startCardId }
    const end = moving?.end === 'end' ? { point: moving.point } : { point: data.end, cardId: data.endCardId }
    const points = freeArrowPoints(start, end, cardPosition)
    arrow.line.setAttrs({ points, bezier: points.length === 8 })
    arrow.start.position({ x: points[0], y: points[1] })
    arrow.end.position({ x: points[points.length - 2], y: points[points.length - 1] })
    arrow.bounds = bounds(points, 16)
  }
  function sync(next: SceneState) {
    const old = state
    state = next
    overviewPaths = null
    if (old?.entities !== next.entities) {
      const ids = new Set(next.entities.map((item) => item.id))
      for (const [id, node] of cards) if (!ids.has(id)) { node.group.destroy(); cards.delete(id) }
    }
    for (const item of next.entities) {
      const point = next.positions[item.id] ?? { x: 0, y: 0 }
      let node = cards.get(item.id)
      if (!node) { node = createCard(item, point); cards.set(item.id, node) }
      if (!(drag?.moved && !drag.pan && drag.hit?.kind === 'card' && drag.hit.id === item.id)) node.group.position(point)
      const active = item.id === next.selectedCard || item.id === next.source || item.id === next.target || item.id === next.arrowStart?.cardId || item.id === next.arrowEnd?.cardId
      node.group.opacity(next.dimmedIds.has(item.id) ? 0.22 : 1)
      const visual = entityVisualFor(item.type)
      if (node.box.getAttr('textureId') !== visual.texture) node.box.setAttrs({ textureId: visual.texture, texture: cardTexture(visual.texture) })
      node.box.setAttrs({ silhouette: visual.silhouette, fill: palette.card, stroke: active ? palette.accent : palette.border, strokeWidth: active ? 2.5 : 1.5 })
      node.title.setAttrs({ text: item.title, fill: palette.text })
      const typeLabel = next.typeLabels[item.type] ?? item.type
      node.type.setAttrs({ text: typeLabel, fill: palette.muted })
      node.port.setAttrs({ fill: palette.accent, stroke: palette.card })
    }
    if (old?.relations !== next.relations) {
      const ids = new Set(next.relations.map((item) => item.id))
      for (const [id, edge] of edges) if (!ids.has(id)) { edge.group.destroy(); edges.delete(id) }
      incident = new Map()
      for (const rel of next.relations) for (const id of new Set([rel.sourceId, rel.targetId])) {
        const list = incident.get(id)
        if (list) list.push(rel)
        else incident.set(id, [rel])
      }
      lanes = relationshipLanes(next.relations)
    }
    const styles = new Map(next.styles.map((style) => [style.type, style]))
    for (const relation of next.relations) {
      const style = styles.get(relation.type)
      if (!style) continue
      let edge = edges.get(relation.id)
      if (!edge) { edge = createEdge(relation.id); edges.set(relation.id, edge) }
      const selected = relation.id === next.selectedEdge
      const color = selected ? palette.accent : style.color
      edge.group.opacity(next.dimmedRelationIds.has(relation.id) ? 0.2 : 1)
      const tipSides = style.tip === 'triangle' ? 3 : style.tip === 'diamond' ? 4 : 20
      const label = relation.label || relation.type
      const sense = relationDirection(relation)
      const directionalTip = sense !== 'none' && style.tip !== 'triangle'
      const startMarker = sense === 'both' && style.tip !== 'triangle'
      const showStart = sense !== 'forward'
      const previousSense = edge.group.getAttr('sense')
      const geometryChanged = edge.text.text() !== label || edge.direction.visible() !== directionalTip || previousSense !== sense
      edge.group.setAttr('sense', sense)
      edge.line.setAttrs({ stroke: color, strokeWidth: selected ? 3.5 : 2, dash: strokeDash(style.stroke) })
      edge.start.setAttrs({ fill: color, sides: tipSides, radius: tipSides === 20 ? 4 : 7, visible: showStart })
      edge.end.setAttrs({ fill: color, sides: tipSides, radius: tipSides === 20 ? 4 : 8 })
      edge.direction.fill(color); edge.direction.visible(directionalTip)
      edge.startDirection.fill(color); edge.startDirection.visible(startMarker)
      edge.symbol.setAttrs({ fill: color, sides: style.symbol === 'circle' ? 20 : 4, radius: 5, rotation: style.symbol === 'square' ? 45 : 0, visible: style.symbol !== 'none' })
      edge.labelBox.setAttrs({ fill: palette.card, stroke: selected ? palette.accent : palette.border, strokeWidth: 1 })
      edge.text.setAttrs({ text: label, fill: palette.text })
      edge.text.width(label.length > 28 ? 170 : 'auto')
      syncGeometry(relation, geometryChanged)
    }
    const annotations = new Set(next.annotations.map((item) => item.id))
    for (const [id, item] of arrows) if (!annotations.has(id)) { item.group.destroy(); item.start.destroy(); item.end.destroy(); arrows.delete(id) }
    if (old?.annotations !== next.annotations) {
      arrowsByCard = new Map()
      for (const item of next.annotations) for (const id of new Set([item.startCardId, item.endCardId])) {
        if (!id) continue
        const list = arrowsByCard.get(id)
        if (list) list.push(item)
        else arrowsByCard.set(id, [item])
      }
    }
    for (const item of next.annotations) {
      let arrow = arrows.get(item.id)
      if (!arrow) {
        arrow = createArrow(item); arrows.set(item.id, arrow)
        edgesLayer.add(arrow.group); cardsLayer.add(arrow.start, arrow.end)
      }
      arrow.data = item
      const selected = next.selectedArrow === item.id
      const color = selected ? palette.accent : item.color
      arrow.line.setAttrs({ fill: color, stroke: color, dash: strokeDash(item.stroke) })
      if (!(drag?.moved && drag.hit?.id === item.id && !drag.pan)) syncArrow(arrow)
      const dimmed = [item.startCardId, item.endCardId].some((id) => id && next.dimmedIds.has(id))
      arrow.group.opacity(dimmed ? 0.2 : 1)
      for (const end of [arrow.start, arrow.end]) {
        end.setAttrs({ fill: color, stroke: palette.card })
        if (selected) end.moveToTop()
      }
    }
    targetRing.moveToTop(); preview.moveToTop()
    host.style.cursor = next.tool === 'move' ? 'grab' : 'crosshair'
    cull(); redrawPreview(lastPointer)
  }
  function moveObject(hit: Hit, point: Point) {
    if (hit.kind === 'card') {
      cards.get(hit.id)?.group.position(point)
      for (const rel of incident.get(hit.id) ?? []) syncGeometry(rel)
      for (const item of arrowsByCard.get(hit.id) ?? []) {
        const arrow = arrows.get(item.id)
        if (arrow) syncArrow(arrow)
      }
    } else if (hit.kind === 'start' || hit.kind === 'end') {
      const arrow = arrows.get(hit.id)
      if (arrow) syncArrow(arrow, { end: hit.kind, point })
    }
    schedule()
  }
  function cancelDrag() {
    if (drag?.hit?.kind === 'card') callbacks.dragCard(drag.hit.id, null)
    if (drag?.hit && drag.origin && drag.moved) {
      if (drag.hit.kind === 'card') moveObject(drag.hit, drag.origin)
      else if (drag.hit.kind === 'start' || drag.hit.kind === 'end') {
        const arrow = arrows.get(drag.hit.id)
        if (arrow) syncArrow(arrow)
      }
    }
    drag = null; pinch = null
    redrawPreview(null)
  }
  const down = (event: PointerEvent) => {
    if (!state || event.button !== 0) return
    event.preventDefault()
    const p = position(event); pointers.set(event.pointerId, p); lastPointer = p
    // Window listeners also handle mouse releases when the browser doesn't retain capture.
    if (typeof host.setPointerCapture === 'function') host.setPointerCapture(event.pointerId)
    if (pointers.size > 1) {
      cancelDrag()
      const [a, b] = [...pointers.values()]
      pinch = { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) }
      return
    }
    const hit = hitAt(p, state.tool === 'move')
    let origin: Point | null = null
    if (!space && state.tool === 'move') {
      if (hit?.kind === 'card') origin = cards.get(hit.id)?.group.position() ?? null
      if (hit?.kind === 'start' || hit?.kind === 'end') origin = arrows.get(hit.id)?.[hit.kind].position() ?? null
    }
    drag = { pointer: event.pointerId, start: p, hit, origin, moved: false, scale: camera.scale,
      pan: space || (!origin && (hit?.kind !== 'port' || state.tool === 'arrow')) }
  }
  const move = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId) && !(event.target instanceof Node && host.contains(event.target))) return
    if (pointers.has(event.pointerId) && event.pointerType === 'mouse' && event.buttons === 0) {
      pointers.delete(event.pointerId); cancelDrag()
    }
    const p = position(event); lastPointer = p
    const previous = pointers.get(event.pointerId)
    if (previous) pointers.set(event.pointerId, p)
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()]
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch.distance > 0) setCamera(zoomGraph(camera, pinch.center, camera.scale * distance / pinch.distance, center))
      pinch = { center, distance }
      return
    }
    if (drag && drag.pointer === event.pointerId) {
      const dx = p.x - drag.start.x, dy = p.y - drag.start.y
      if (!drag.moved && Math.hypot(dx, dy) < 5) return
      const first = !drag.moved
      drag.moved = true
      if (drag.pan && previous) {
        host.style.cursor = 'grabbing'
        setCamera({ ...camera, x: camera.x + (first ? dx : p.x - previous.x), y: camera.y + (first ? dy : p.y - previous.y) })
      } else if (drag.hit && drag.origin) {
        moveObject(drag.hit, { x: limit(drag.origin.x + dx / drag.scale), y: limit(drag.origin.y + dy / drag.scale) })
        if (drag.hit.kind === 'card') callbacks.dragCard(drag.hit.id, { x: event.clientX, y: event.clientY })
      }
    }
    if (!drag?.pan && (state?.tool !== 'move' || drag?.hit?.kind === 'port')) redrawPreview(p)
  }
  const up = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return
    if (pinch) { if (pointers.size < 2) pinch = null; return }
    const current = drag
    if (!current || current.pointer !== event.pointerId) return
    const p = position(event)
    drag = null
    host.style.cursor = space ? 'grab' : state?.tool === 'move' ? 'grab' : 'crosshair'
    if (!current.moved && !space) callbacks.select(current.hit, world(p))
    else if (!current.pan && current.hit) {
      const { kind, id } = current.hit
      if (kind === 'card' && current.origin) {
        const transferred = callbacks.dropCard(id, { x: event.clientX, y: event.clientY })
        callbacks.dragCard(id, null)
        if (transferred || !host.contains(document.elementFromPoint(event.clientX, event.clientY))) moveObject(current.hit, current.origin)
        else {
          const point = cards.get(id)?.group.position()
          if (point) callbacks.move(id, point)
        }
      } else if (kind === 'port') {
        const target = host.contains(document.elementFromPoint(event.clientX, event.clientY)) ? cardAt(p) : ''
        if (target) callbacks.connect(id, target)
      } else if (kind === 'start' || kind === 'end') {
        const arrow = arrows.get(id)
        if (arrow && host.contains(document.elementFromPoint(event.clientX, event.clientY))) {
          // Ignore the dragged handle when finding the card underneath it.
          arrow[kind].hide()
          cardsLayer.drawHit()
          const cardId = cardAt(p) || undefined
          const position = cardId ? cardPosition(cardId) : undefined
          callbacks.moveArrow(id, kind, { point: position ? cardCenter(position) : arrow[kind].position(), cardId })
        } else if (arrow) syncArrow(arrow)
      }
    }
    schedule(); redrawPreview(p)
  }
  const cancelPointer = (event: PointerEvent) => { if (pointers.delete(event.pointerId)) cancelDrag() }
  const leave = () => { if (!drag) { lastPointer = null; redrawPreview(null) } }
  const wheel = (event: WheelEvent) => {
    event.preventDefault()
    if (drag || pinch) return
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.height() : 1
    const dx = event.deltaX * unit, dy = event.deltaY * unit
    // Wheel mice generally emit discrete ticks; precision pixel deltas are typically a trackpad.
    const trackpad = event.deltaMode === 0 && (dx !== 0 || Math.abs(dy) < 40 || dy % 1 !== 0)
    if (trackpad && !event.ctrlKey && !event.metaKey) setCamera({ ...camera, x: camera.x - dx, y: camera.y - dy })
    else setCamera(zoomGraph(camera, position(event), camera.scale * Math.exp(Math.max(-0.35, Math.min(0.35, -dy * (event.ctrlKey ? 0.013 : 0.0025))))))
    lastPointer = position(event); redrawPreview(lastPointer)
  }
  const keydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return
    if (event.key === 'Escape') { cancelDrag(); callbacks.cancel() }
    if (event.code === 'Space' && !isField(event.target)) { space = true; host.style.cursor = 'grab'; event.preventDefault() }
  }
  const keyup = (event: KeyboardEvent) => { if (event.code === 'Space') { space = false; host.style.cursor = state?.tool === 'move' ? 'grab' : 'crosshair' } }
  const blur = () => { space = false; pointers.clear(); cancelDrag(); host.style.cursor = state?.tool === 'move' ? 'grab' : 'crosshair' }
  host.addEventListener('pointerdown', down)
  window.addEventListener('pointermove', move, true)
  window.addEventListener('pointerup', up, true)
  window.addEventListener('pointercancel', cancelPointer, true)
  host.addEventListener('pointerleave', leave)
  host.addEventListener('wheel', wheel, { passive: false })
  window.addEventListener('keydown', keydown)
  window.addEventListener('keyup', keyup)
  window.addEventListener('blur', blur)
  const observer = new ResizeObserver(() => {
    const before = dimensions(), after = { x: host.clientWidth, y: host.clientHeight }
    if (after.x <= 0 || after.y <= 0 || same(before, after)) return
    stage.size({ width: after.x, height: after.y })
    setCamera(resizeGraph(camera, before, after))
  })
  observer.observe(host)
  const theme = new MutationObserver(() => { palette = readPalette(host); if (state) sync(state) })
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return {
    sync, focus, fit, zoom: (factor: number) => setCamera(zoomGraph(camera, midpoint(), camera.scale * factor)),
    destroy() {
      observer.disconnect(); theme.disconnect(); cancelAnimationFrame(frame)
      host.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', cancelPointer, true)
      host.removeEventListener('pointerleave', leave); host.removeEventListener('wheel', wheel)
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur)
      for (const node of cards.values()) node.group.destroy()
      for (const edge of edges.values()) edge.group.destroy()
      stage.destroy()
    },
  }
}
