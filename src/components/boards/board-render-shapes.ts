import { getStroke } from 'perfect-freehand'
import { STROKE_WIDTHS } from '@/domain/boards/boardArrow'
import type { BoardDash, BoardDraw, BoardGeo, BoardImage, BoardLine, BoardNote } from '@/domain/boards/boardCanvas'
import { geoOutline, handDrawnPath } from '@/domain/boards/boardGeo'
import { BOARD_PALETTE, LABEL_FONT_SIZES, LABEL_PADDING, TEXT_LINE_HEIGHT, fillColor } from '@/domain/boards/boardStyles'
import type { Point } from '@/domain/canvas/geometry'
import { fillCentered, wrapLines, type BoardPalette } from './board-render'

type Ctx = CanvasRenderingContext2D

export type LabelLayout = { lines: string[]; width: number; height: number; lineHeight: number; font: string; fontSize: number }

/** Rótulo de nota ou forma: quebra na largura útil (menos o recuo de 16 px de cada lado). */
export function layoutLabel(ctx: Ctx, shape: { text: string; size: BoardNote['size']; font: BoardNote['font']; scale: number }, width: number, palette: BoardPalette): LabelLayout {
  const fontSize = LABEL_FONT_SIZES[shape.size] * shape.scale
  const font = `${fontSize}px ${palette.fonts[shape.font]}`
  ctx.save()
  ctx.font = font
  const inner = Math.max(1, width - LABEL_PADDING * 2 * shape.scale)
  const lines = shape.text ? wrapLines(ctx, shape.text, inner) : []
  const measured = lines.length ? Math.max(...lines.map((line) => ctx.measureText(line).width)) : 0
  ctx.restore()
  const lineHeight = fontSize * TEXT_LINE_HEIGHT
  return { lines, width: measured, height: lines.length * lineHeight + LABEL_PADDING * 2 * shape.scale, lineHeight, font, fontSize }
}

/** Escreve o rótulo dentro da caixa w × h com o alinhamento horizontal e vertical da forma. */
export function drawLabel(ctx: Ctx, layout: LabelLayout, w: number, h: number, align: BoardNote['align'], verticalAlign: BoardNote['verticalAlign'], color: string, scale: number) {
  if (!layout.lines.length) return
  const pad = LABEL_PADDING * scale
  const textHeight = layout.lines.length * layout.lineHeight
  const top = verticalAlign === 'start' ? pad : verticalAlign === 'end' ? h - pad - textHeight : (h - textHeight) / 2
  ctx.save()
  ctx.font = layout.font
  ctx.fillStyle = color
  ctx.textAlign = align === 'start' ? 'left' : align === 'end' ? 'right' : 'center'
  ctx.textBaseline = 'alphabetic'
  const x = align === 'start' ? pad : align === 'end' ? w - pad : w / 2
  layout.lines.forEach((line, i) => fillCentered(ctx, line, x, top + (i + 0.5) * layout.lineHeight))
  ctx.restore()
}

function tracePath(ctx: Ctx, points: Point[], closed: boolean) {
  ctx.beginPath()
  points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
  if (closed) ctx.closePath()
}

/** Traço com o estilo de linha do tldraw: desenhado à mão, contínuo, tracejado ou pontilhado. */
export function strokeStyled(ctx: Ctx, points: Point[], closed: boolean, dash: BoardDash, strokeWidth: number, color: string, seed: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = strokeWidth
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (dash === 'dashed') ctx.setLineDash([strokeWidth * 2, strokeWidth * 2])
  if (dash === 'dotted') ctx.setLineDash([0, strokeWidth * 2])
  tracePath(ctx, dash === 'draw' ? handDrawnPath(points, closed, seed, strokeWidth) : points, closed && dash !== 'draw')
  ctx.stroke()
  ctx.restore()
}

function fillShape(ctx: Ctx, points: Point[], fill: BoardGeo['fill'], color: BoardGeo['color'], bounds: { w: number; h: number }) {
  const value = fillColor(color, fill)
  if (!value) return
  ctx.save()
  tracePath(ctx, points, true)
  if (fill === 'pattern') {
    ctx.clip()
    ctx.strokeStyle = value
    ctx.lineWidth = 2
    for (let d = -bounds.h; d < bounds.w + bounds.h; d += 8) { ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d - bounds.h, bounds.h); ctx.stroke() }
  } else {
    ctx.fillStyle = value
    ctx.fill()
  }
  ctx.restore()
}

export const geoHeight = (shape: Pick<BoardGeo, 'h' | 'growY'>) => shape.h + shape.growY
export const noteSize = (shape: Pick<BoardNote, 'scale' | 'growY'>) => ({ w: 200 * shape.scale, h: (200 + shape.growY) * shape.scale })

// Cada objeto de forma é substituído quando muda, então dá para guardar o que é caro de calcular.
const geoPaths = new WeakMap<BoardGeo, { outline: Point[]; stroke: Point[]; marks: Point[][] }>()
function geoPathsOf(shape: BoardGeo) {
  let paths = geoPaths.get(shape)
  if (!paths) {
    const sw = STROKE_WIDTHS[shape.size] * shape.scale
    const { outline, marks } = geoOutline(shape.geo, shape.w, geoHeight(shape))
    const hand = shape.dash === 'draw'
    paths = {
      outline,
      stroke: hand ? handDrawnPath(outline, true, shape.id, sw) : outline,
      marks: marks.map((mark, i) => hand ? handDrawnPath(mark, false, `${shape.id}:${i}`, sw) : mark),
    }
    geoPaths.set(shape, paths)
  }
  return paths
}

/** Traço já calculado (desenhado à mão ou não), com o tipo de linha da forma. */
function strokePrepared(ctx: Ctx, points: Point[], closed: boolean, dash: BoardDash, strokeWidth: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = strokeWidth
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (dash === 'dashed') ctx.setLineDash([strokeWidth * 2, strokeWidth * 2])
  if (dash === 'dotted') ctx.setLineDash([0, strokeWidth * 2])
  tracePath(ctx, points, closed && dash !== 'draw')
  ctx.stroke()
  ctx.restore()
}

export function drawGeo(ctx: Ctx, shape: BoardGeo, label: LabelLayout | null, editing: boolean) {
  const w = shape.w, h = geoHeight(shape)
  const sw = STROKE_WIDTHS[shape.size] * shape.scale
  const { outline, stroke, marks } = geoPathsOf(shape)
  const color = BOARD_PALETTE[shape.color].solid
  fillShape(ctx, outline, shape.fill, shape.color, { w, h })
  strokePrepared(ctx, stroke, true, shape.dash, sw, color)
  marks.forEach((mark) => strokePrepared(ctx, mark, false, shape.dash, sw, color))
  if (label && !editing) drawLabel(ctx, label, w, h, shape.align, shape.verticalAlign, BOARD_PALETTE[shape.labelColor].solid, shape.scale)
}

export function drawNote(ctx: Ctx, shape: BoardNote, label: LabelLayout | null, editing: boolean) {
  const { w, h } = noteSize(shape)
  ctx.save()
  // Duas sombras suaves, como o filtro da nota no tldraw.
  for (const [dy, blur] of [[3, 6], [6, 12]]) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = dy
    ctx.fillStyle = BOARD_PALETTE[shape.color].noteFill; ctx.fillRect(0, 0, w, h); ctx.restore()
  }
  ctx.fillStyle = BOARD_PALETTE[shape.color].noteFill
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
  const text = shape.labelColor === 'black' ? BOARD_PALETTE[shape.color].noteText : BOARD_PALETTE[shape.labelColor].solid
  if (label && !editing) drawLabel(ctx, label, w, h, shape.align, shape.verticalAlign, text, shape.scale)
}

/** Opções do perfect-freehand próximas às do desenho do tldraw. */
export function freehandOutline(points: BoardDraw['points'], strokeWidth: number, isPen: boolean, last = true) {
  return getStroke(points.map(([x, y, pressure]) => [x, y, pressure]), {
    size: 1 + strokeWidth * 1.5, thinning: 0.65, smoothing: 0.65, streamline: 0.5, simulatePressure: !isPen, last,
    start: { taper: 0, cap: true }, end: { taper: 0, cap: true },
  })
}

const freehandCache = new WeakMap<BoardDraw, number[][]>()
/** O contorno do perfect-freehand só é recalculado quando o traço muda. */
function freehandOf(shape: BoardDraw, strokeWidth: number, complete: boolean) {
  if (!complete) return freehandOutline(shape.points, strokeWidth, shape.isPen, false)
  let outline = freehandCache.get(shape)
  if (!outline) { outline = freehandOutline(shape.points, strokeWidth, shape.isPen, true); freehandCache.set(shape, outline) }
  return outline
}

export function drawDraw(ctx: Ctx, shape: BoardDraw, complete = true) {
  const sw = STROKE_WIDTHS[shape.size] * shape.scale
  const color = BOARD_PALETTE[shape.color].solid
  const points = shape.points.map(([x, y]) => ({ x, y }))
  if (shape.isClosed) fillShape(ctx, points, shape.fill, shape.color, { w: 1e5, h: 1e5 })
  if (shape.dash === 'draw') {
    const outline = freehandOf(shape, sw, complete)
    if (outline.length < 2) return
    ctx.save()
    ctx.fillStyle = color
    ctx.beginPath()
    outline.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  } else {
    strokeStyled(ctx, points, shape.isClosed, shape.dash, sw, color, shape.id)
  }
}

/** Curva suave pelos pontos (Catmull-Rom), para o spline `cubic` da linha. */
function smoothPoints(points: Point[]): Point[] {
  if (points.length < 3) return points
  const result: Point[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)]
    for (let t = 0; t < 1; t += 1 / 16) {
      const t2 = t * t, t3 = t2 * t
      result.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      })
    }
  }
  result.push(points[points.length - 1])
  return result
}

export const linePath = (shape: Pick<BoardLine, 'points' | 'spline'>) => shape.spline === 'cubic' ? smoothPoints(shape.points) : shape.points

const linePaths = new WeakMap<BoardLine, Point[]>()
export function drawLine(ctx: Ctx, shape: BoardLine) {
  const sw = STROKE_WIDTHS[shape.size] * shape.scale
  let path = linePaths.get(shape)
  if (!path) { path = shape.dash === 'draw' ? handDrawnPath(linePath(shape), false, shape.id, sw) : linePath(shape); linePaths.set(shape, path) }
  strokePrepared(ctx, path, false, shape.dash, sw, BOARD_PALETTE[shape.color].solid)
}

export function drawImage(ctx: Ctx, shape: BoardImage, img: HTMLImageElement | null, palette: BoardPalette) {
  if (!img) {
    ctx.save()
    ctx.fillStyle = palette.surface
    ctx.fillRect(0, 0, shape.w, shape.h)
    ctx.restore()
    return
  }
  ctx.save()
  ctx.translate(shape.flipX ? shape.w : 0, shape.flipY ? shape.h : 0)
  ctx.scale(shape.flipX ? -1 : 1, shape.flipY ? -1 : 1)
  ctx.drawImage(img, 0, 0, shape.w, shape.h)
  ctx.restore()
}
