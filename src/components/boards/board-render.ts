import { arrowheadBase, arrowheadShape, arrowStrokeWidth, pathLength, pointAlong, type ArrowGeometry } from '@/domain/boards/boardArrow'
import type { BoardArrow, BoardCard, BoardFont, BoardLegacy, BoardText } from '@/domain/boards/boardCanvas'
import { ARROW_LABEL_FONT_SIZES, ARROW_LABEL_PADDING, BOARD_BACKGROUND, BOARD_FONT_VARIABLES, BOARD_PALETTE, TEXT_FONT_SIZES, TEXT_LINE_HEIGHT } from '@/domain/boards/boardStyles'
import { traceSilhouette } from '@/domain/canvas/entitySilhouettes'
import type { Point } from '@/domain/canvas/geometry'
import { entityVisualFor, type SilhouetteId } from '@/domain/entities/entityVisual'
import { getCardDisplay } from '@/lib/canvas/cardDisplay'
import { readTextureTheme, texturePaint, type TextureTheme } from '@/lib/canvas/textureTheme'
import type { BoardEntitySummary } from './board-types'

export type BoardPalette = {
  primary: string; primary14: string; primary30: string; primary35Border: string; primary48Border: string; primary55Black: string; primaryForeground: string
  surface96: string; surface: string; background: string; foreground: string; muted: string; warning: string; border: string
  sans: string; serif: string; rem: number; fonts: Record<BoardFont, string>
  /** Ink and opacities of the record-type textures on this theme (ADR-011). */
  texture: TextureTheme
}

export function readBoardPalette(host: HTMLElement): BoardPalette {
  const probe = document.createElement('span')
  probe.style.display = 'none'
  host.appendChild(probe)
  const color = (css: string) => { probe.style.color = ''; probe.style.color = css; return getComputedStyle(probe).color }
  const family = (css: string) => { probe.style.fontFamily = ''; probe.style.fontFamily = css; return getComputedStyle(probe).fontFamily }
  const palette: Omit<BoardPalette, 'texture'> = {
    primary: color('var(--primary)'),
    primary14: color('color-mix(in oklch, var(--primary) 14%, transparent)'),
    primary30: color('color-mix(in oklch, var(--primary) 30%, transparent)'),
    primary35Border: color('color-mix(in oklch, var(--primary) 35%, var(--border))'),
    primary48Border: color('color-mix(in oklch, var(--primary) 48%, var(--border))'),
    primary55Black: color('color-mix(in oklch, var(--primary) 55%, black)'),
    primaryForeground: color('var(--primary-foreground)'),
    surface96: color('color-mix(in oklch, var(--surface) 96%, transparent)'),
    surface: color('var(--surface)'),
    background: color('var(--background)'),
    foreground: color('var(--foreground)'),
    muted: color('var(--muted-foreground)'),
    warning: color('var(--warning)'),
    border: color('var(--border)'),
    sans: getComputedStyle(host).fontFamily || 'sans-serif',
    serif: family('var(--font-serif), serif'),
    rem: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
    fonts: {
      draw: family(`var(${BOARD_FONT_VARIABLES.draw}), sans-serif`),
      sans: family(`var(${BOARD_FONT_VARIABLES.sans}), sans-serif`),
      serif: family(`var(${BOARD_FONT_VARIABLES.serif}), serif`),
      mono: family(`var(${BOARD_FONT_VARIABLES.mono}), monospace`),
    },
  }
  probe.remove()
  // Text drawn over a card's body: title, subtitle and type label.
  const texture = readTextureTheme({ card: palette.surface, background: palette.background, foreground: palette.foreground, texts: [palette.foreground, palette.muted, palette.primary] })
  return { ...palette, texture }
}

type Ctx = CanvasRenderingContext2D

/**
 * Escreve uma linha centrada verticalmente em `centerY` como o CSS faz (meia entrelinha sobre a
 * ascendente e a descendente da fonte), e não pelo quadrado da fonte. Assim acentos de maiúsculas
 * como Ã ficam dentro da linha, iguais ao HTML.
 */
export function fillCentered(ctx: Ctx, text: string, x: number, centerY: number) {
  const { ascent, descent } = fontMetrics(ctx)
  // Abaixo de 3 px na tela o texto é só um borrão: pular não muda o que se vê e poupa o quadro
  // inteiro quando está afastado.
  const m = ctx.getTransform()
  if ((ascent + descent) * Math.hypot(m.a, m.b) < MIN_READABLE_PX) return
  ctx.fillText(text, x, centerY + (ascent - descent) / 2)
}

const MIN_READABLE_PX = 3
const metricsCache = new Map<string, { ascent: number; descent: number }>()
/** Ascendente e descendente da fonte atual, medidas uma vez por fonte. */
function fontMetrics(ctx: Ctx) {
  let metrics = metricsCache.get(ctx.font)
  if (!metrics) {
    const m = ctx.measureText('Hg')
    metrics = { ascent: m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent, descent: m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent }
    metricsCache.set(ctx.font, metrics)
  }
  return metrics
}
/** Esquece medidas guardadas quando as fontes terminam de carregar. */
export function resetTextCaches() { metricsCache.clear(); wrapCache.clear() }
const wrapCache = new Map<string, string[]>()
const setSpacing = (ctx: Ctx, px: number) => { if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px` }

/** Quebra em linhas como o navegador (por palavras; palavra longa demais transborda). */
export function wrapLines(ctx: Ctx, text: string, maxWidth: number | null): string[] {
  const key = `${ctx.font}|${(ctx as Ctx & { letterSpacing?: string }).letterSpacing ?? ''}|${maxWidth}|${text}`
  const cached = wrapCache.get(key)
  if (cached) return cached
  if (wrapCache.size > 5000) wrapCache.clear()
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    if (maxWidth === null) { lines.push(paragraph); continue }
    const words = paragraph.split(/(\s+)/)
    let line = ''
    for (const word of words) {
      const candidate = line + word
      if (line && ctx.measureText(candidate.trimEnd()).width > maxWidth && word.trim()) { lines.push(line.trimEnd()); line = word.trimStart() }
      else line = candidate
    }
    lines.push(line)
  }
  wrapCache.set(key, lines)
  return lines
}

export type TextLayout = { lines: string[]; width: number; height: number; lineHeight: number; fontSize: number; font: string }

/** Medidas do texto como o `TextShapeUtil`: largura automática ou quebra em `w`, altura por linha. */
export function layoutText(ctx: Ctx, shape: Pick<BoardText, 'text' | 'font' | 'size' | 'scale' | 'autoSize' | 'w'>, palette: BoardPalette): TextLayout {
  const fontSize = TEXT_FONT_SIZES[shape.size]
  const font = `${fontSize}px ${palette.fonts[shape.font]}`
  ctx.save()
  ctx.font = font
  setSpacing(ctx, 0)
  const lines = wrapLines(ctx, shape.text || ' ', shape.autoSize ? null : shape.w)
  const measured = Math.max(...lines.map((line) => ctx.measureText(line).width))
  ctx.restore()
  const lineHeight = fontSize * TEXT_LINE_HEIGHT
  const width = shape.autoSize ? Math.max(shape.w, Math.ceil(measured) + 2) : shape.w
  return { lines, width: width * shape.scale, height: lines.length * lineHeight * shape.scale, lineHeight, fontSize, font }
}

export function drawText(ctx: Ctx, shape: BoardText, layout: TextLayout) {
  ctx.save()
  ctx.scale(shape.scale, shape.scale)
  ctx.font = layout.font
  ctx.fillStyle = BOARD_PALETTE[shape.color].solid
  ctx.textBaseline = 'alphabetic'
  const width = layout.width / shape.scale
  ctx.textAlign = shape.textAlign === 'middle' ? 'center' : shape.textAlign === 'end' ? 'right' : 'left'
  const x = shape.textAlign === 'middle' ? width / 2 : shape.textAlign === 'end' ? width : 0
  layout.lines.forEach((line, i) => fillCentered(ctx, line, x, (i + 0.5) * layout.lineHeight))
  ctx.restore()
}

export type LabelLayout = { lines: string[]; width: number; height: number; lineHeight: number; font: string; center: Point }

export function layoutArrowLabel(ctx: Ctx, arrow: BoardArrow, geometry: ArrowGeometry, palette: BoardPalette): LabelLayout | null {
  if (!arrow.text.trim()) return null
  const fontSize = ARROW_LABEL_FONT_SIZES[arrow.size] * arrow.scale
  const font = `${fontSize}px ${palette.fonts[arrow.font]}`
  ctx.save()
  ctx.font = font
  const lines = arrow.text.split('\n')
  const width = Math.max(...lines.map((line) => ctx.measureText(line).width)) + ARROW_LABEL_PADDING * 2 * arrow.scale
  ctx.restore()
  const lineHeight = fontSize * TEXT_LINE_HEIGHT
  const center = pointAlong(geometry.points, pathLength(geometry.points) * arrow.labelPosition)
  return { lines, width, height: lines.length * lineHeight + ARROW_LABEL_PADDING * 2 * arrow.scale, lineHeight, font, center }
}

function dashFor(arrow: BoardArrow, sw: number): number[] {
  if (arrow.dash === 'dashed') return [sw * 2, sw * 2]
  if (arrow.dash === 'dotted') return [0, sw * 2]
  return []
}

/** Seta em coordenadas da página. O estilo "draw" do tldraw é um traço contínuo de pontas redondas. */
export function drawArrow(ctx: Ctx, arrow: BoardArrow, geometry: ArrowGeometry, label: LabelLayout | null) {
  if (!geometry.valid) return
  const sw = arrowStrokeWidth(arrow)
  const color = BOARD_PALETTE[arrow.color].solid
  ctx.save()
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.lineWidth = sw
  ctx.strokeStyle = color
  ctx.fillStyle = color
  if (label) {
    // O rótulo recorta a linha, como o tldraw faz com a máscara do label.
    ctx.save()
    ctx.beginPath()
    ctx.rect(-1e6, -1e6, 2e6, 2e6)
    ctx.rect(label.center.x - label.width / 2, label.center.y - label.height / 2, label.width, label.height)
    ctx.clip('evenodd')
  }
  ctx.setLineDash(dashFor(arrow, sw))
  ctx.beginPath()
  geometry.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
  ctx.stroke()
  if (label) ctx.restore()
  ctx.setLineDash([])
  for (const side of ['start', 'end'] as const) {
    const kind = side === 'start' ? arrow.arrowheadStart : arrow.arrowheadEnd
    const { point, int } = arrowheadBase(geometry.points, side, sw)
    const head = arrowheadShape(kind, point, int)
    if (!head) continue
    ctx.beginPath()
    if (head.circle) ctx.arc(head.circle.center.x, head.circle.center.y, head.circle.r, 0, Math.PI * 2)
    else head.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
    if (head.closed) { ctx.closePath(); ctx.fill() }
    ctx.stroke()
  }
  if (label) {
    ctx.font = label.font
    ctx.fillStyle = BOARD_PALETTE[arrow.labelColor].solid
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
    const top = label.center.y - label.height / 2 + ARROW_LABEL_PADDING * arrow.scale
    label.lines.forEach((line, i) => fillCentered(ctx, line, label.center.x, top + (i + 0.5) * label.lineHeight))
  }
  ctx.restore()
}

export function drawLegacy(ctx: Ctx, shape: BoardLegacy, palette: BoardPalette) {
  ctx.save()
  ctx.setLineDash([6, 4])
  ctx.strokeStyle = palette.muted
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, shape.w - 1, shape.h - 1)
  ctx.setLineDash([])
  ctx.fillStyle = palette.muted
  ctx.font = `${0.7 * palette.rem}px ${palette.sans}`
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  fillCentered(ctx, `Forma "${shape.type}" do editor anterior`, shape.w / 2, shape.h / 2)
  ctx.restore()
}

type ImageGetter = (assetId: string, variant: 'original' | 'thumbnail') => HTMLImageElement | null
type IconGetter = () => HTMLImageElement | null
type TypeIconGetter = (name: string) => CanvasImageSource | null

// Card outlines by record type (ADR-011), cached per silhouette and size: cards keep their size
// across frames, so each outline is traced once. The cache is small and is simply reset when full.
const outlines = new Map<string, Path2D>()
/** Smallest on-screen card height, in device pixels, that still gets its texture. */
const MIN_TEXTURE_PX = 48
function cardOutline(silhouette: SilhouetteId, x: number, y: number, w: number, h: number) {
  const key = `${silhouette}|${x}|${y}|${w}|${h}`
  let path = outlines.get(key)
  if (!path) {
    if (outlines.size >= 512) outlines.clear()
    path = new Path2D()
    traceSilhouette(path, silhouette, x, y, w, h)
    outlines.set(key, path)
  }
  return path
}

const VIEW_COLUMNS: Record<BoardCard['viewMode'], number | null> = { minimal: null, card: 0.35, portrait: 0.58, dossier: 0.42, wide: 0.72 }

/** Imagem com `object-fit: cover` (ou `contain`) e `object-position` em porcentagem. */
const FILTERED_MAX_SIDE = 1024
const filteredImages = new WeakMap<HTMLImageElement, HTMLCanvasElement>()
/**
 * Imagem do cartão com o filtro do CSS (`saturate(.75) contrast(1.05)`) aplicado uma vez, numa
 * cópia de até 1.024 px. Aplicar `ctx.filter` a cada quadro custava caro com muitos cartões.
 */
function filteredImage(img: HTMLImageElement): HTMLCanvasElement {
  let canvas = filteredImages.get(img)
  if (!canvas) {
    const scale = Math.min(1, FILTERED_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')!
    ctx.filter = 'saturate(0.75) contrast(1.05)'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    filteredImages.set(img, canvas)
  }
  return canvas
}

function drawImageFit(ctx: Ctx, img: HTMLImageElement | HTMLCanvasElement, x: number, y: number, w: number, h: number, fit: 'cover' | 'contain', posX: number, posY: number) {
  const iw = img instanceof HTMLImageElement ? img.naturalWidth : img.width, ih = img instanceof HTMLImageElement ? img.naturalHeight : img.height
  const scale = fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih)
  const dw = iw * scale, dh = ih * scale
  ctx.drawImage(img, x + (w - dw) * posX, y + (h - dh) * posY, dw, dh)
}

/**
 * Cartão de registro, reproduzindo o CSS de `investigation-board.module.css` (`.entityCard` e as
 * visualizações mínima, cartão, retrato, dossiê e local amplo).
 */
export function drawCard(ctx: Ctx, card: BoardCard, entity: BoardEntitySummary | undefined, palette: BoardPalette, image: ImageGetter, warningIcon: IconGetter, typeIcon: TypeIconGetter, supportsFilter: boolean) {
  const { w, h } = card
  const rem = palette.rem
  if (!entity) {
    ctx.save()
    ctx.fillStyle = palette.surface
    ctx.fillRect(0, 0, w, h)
    ctx.setLineDash([3, 3]); ctx.strokeStyle = palette.warning; ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1)
    ctx.setLineDash([])
    const icon = warningIcon(), size = 1.4 * rem, gap = 0.35 * rem
    const titleSize = rem, idSize = 0.55 * rem
    const total = size + gap + titleSize * 1.5 + gap + idSize * 1.5
    let y = (h - total) / 2
    if (icon) ctx.drawImage(icon, (w - size) / 2, y, size, size)
    y += size + gap
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
    ctx.font = `700 ${titleSize}px ${palette.sans}`; ctx.fillStyle = palette.warning
    fillCentered(ctx, 'Entidade indisponível', w / 2, y + titleSize * 0.75)
    y += titleSize * 1.5 + gap
    ctx.font = `${idSize}px ${palette.sans}`; ctx.fillStyle = palette.muted
    let id = card.entityId
    while (id.length > 3 && ctx.measureText(`${id}…`).width > w * 0.8) id = id.slice(0, -1)
    fillCentered(ctx, id === card.entityId ? id : `${id}…`, w / 2, y + idSize * 0.75)
    ctx.restore()
    return
  }
  const mode = card.viewMode
  const border = mode === 'dossier' ? 2 : 1
  // The card takes the silhouette of its record type; shadow, clip and border follow it.
  const visual = entityVisualFor(entity.type)
  const outline = cardOutline(visual.silhouette, 0, 0, w, h)
  ctx.save()
  // box-shadow: .45rem .55rem 0 color-mix(black 28%)
  ctx.save()
  ctx.translate(0.45 * rem, 0.55 * rem)
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.fill(outline)
  ctx.restore()
  ctx.clip(outline)
  ctx.fillStyle = palette.surface96
  ctx.fillRect(0, 0, w, h)
  // The type's texture lies under the image column and the text. On a card only a few dozen pixels
  // tall the texture is noise, so it is left out there, as below the port zoom of the graph.
  const screen = ctx.getTransform()
  const display = getCardDisplay()
  const texture = display.textureScale > 0 && Math.hypot(screen.a, screen.b) * h >= MIN_TEXTURE_PX
    ? texturePaint(palette.texture, visual.texture, ctx, globalThis.devicePixelRatio || 1) : null
  if (texture) {
    ctx.save()
    ctx.globalAlpha *= texture.opacity * display.textureScale; ctx.fillStyle = texture.pattern
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }
  const innerX = border, innerY = border, innerW = w - border * 2, innerH = h - border * 2
  const column = VIEW_COLUMNS[mode]
  const thumbnail = card.showImage && entity.thumbnailAssetId ? entity.thumbnailAssetId : undefined
  const col1 = column === null ? innerW : innerW * column
  let bodyX = innerX, bodyW = col1
  if (thumbnail && column !== null) {
    const img = image(thumbnail, mode === 'portrait' || mode === 'dossier' ? 'original' : 'thumbnail')
    if (img) {
      ctx.save()
      ctx.beginPath(); ctx.rect(innerX, innerY, col1, innerH); ctx.clip()
      if (mode === 'wide') { ctx.fillStyle = palette.background; ctx.fillRect(innerX, innerY, col1, innerH) }
      const source = supportsFilter ? filteredImage(img) : img
      if (mode === 'wide') drawImageFit(ctx, source, innerX, innerY, col1, innerH, 'contain', 0.5, 0.5)
      else drawImageFit(ctx, source, innerX, innerY, col1, innerH, 'cover', 0.5, mode === 'portrait' ? 0.15 : 0)
      ctx.restore()
    }
    bodyX = innerX + col1
    bodyW = innerW - col1
  } else if (column === null) {
    bodyW = innerW
  }
  if (mode === 'wide' && thumbnail) {
    ctx.fillStyle = palette.primary35Border
    ctx.fillRect(bodyX, innerY, 1, innerH)
  }
  // Corpo: coluna flexível centralizada (no local amplo, alinhada embaixo).
  const pad = mode === 'minimal' ? rem : mode === 'wide' ? 0.75 * rem : 0.75 * rem
  const padY = mode === 'minimal' ? rem : mode === 'wide' ? 0.9 * rem : 0.75 * rem
  const contentX = bodyX + (mode === 'wide' && thumbnail ? 1 : 0) + pad
  const contentW = Math.max(0, bodyW - pad * 2 - (mode === 'wide' && thumbnail ? 1 : 0))
  type Block = { height: number; draw: (top: number) => void }
  const blocks: Block[] = []
  const gap = 0.32 * rem
  if (card.showType) {
    const size = 0.55 * rem, iconSize = size * 1.5
    blocks.push({ height: size * 1.5, draw: (top) => {
      // The type's icon leads the label, so the type does not depend on colour or text alone.
      // Like text, an icon under 3 px on screen is a blur and is skipped.
      const icon = Math.hypot(screen.a, screen.b) * iconSize >= MIN_READABLE_PX ? typeIcon(entity.typeIcon) : null
      if (icon) ctx.drawImage(icon, contentX, top, iconSize, iconSize)
      const labelX = contentX + (icon ? iconSize + 0.25 * rem : 0)
      ctx.font = `800 ${size}px ${palette.sans}`; setSpacing(ctx, size * 0.14); ctx.fillStyle = palette.primary
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; fillCentered(ctx, entity.typeLabel.toUpperCase(), labelX, top + size * 0.75)
      setSpacing(ctx, 0)
    } })
  }
  {
    const size = (mode === 'wide' ? 1.08 : 1) * rem
    ctx.font = `${size}px ${palette.serif}`
    const lines = wrapLines(ctx, (card.customLabel || entity.title).toUpperCase(), contentW)
    const lineHeight = size * 1.05
    blocks.push({ height: lines.length * lineHeight, draw: (top) => {
      ctx.save(); ctx.beginPath(); ctx.rect(contentX, top, contentW, lines.length * lineHeight); ctx.clip()
      ctx.font = `${size}px ${palette.serif}`; ctx.fillStyle = palette.foreground; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      lines.forEach((line, i) => fillCentered(ctx, line, contentX, top + (i + 0.5) * lineHeight))
      ctx.restore()
    } })
  }
  if (entity.subtitle && mode !== 'minimal') {
    const size = 0.62 * rem
    ctx.font = `${size}px ${palette.sans}`
    const lines = wrapLines(ctx, entity.subtitle, contentW)
    blocks.push({ height: lines.length * size * 1.5, draw: (top) => {
      ctx.font = `${size}px ${palette.sans}`; ctx.fillStyle = palette.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      lines.forEach((line, i) => fillCentered(ctx, line, contentX, top + (i + 0.5) * size * 1.5))
    } })
  }
  if (card.showStatus && entity.status && mode !== 'minimal' && mode !== 'wide') {
    const size = 0.58 * rem, dot = 0.35 * rem
    blocks.push({ height: size * 1.5, draw: (top) => {
      const cy = top + size * 0.75
      ctx.beginPath(); ctx.arc(contentX + dot / 2, cy, dot / 2, 0, Math.PI * 2); ctx.fillStyle = palette.primary; ctx.fill()
      ctx.font = `${size}px ${palette.sans}`; ctx.fillStyle = palette.foreground; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      fillCentered(ctx, entity.status!.toUpperCase(), contentX + dot + 0.3 * rem, cy)
    } })
  }
  if (card.showTags && entity.tags.length > 0 && mode !== 'minimal' && mode !== 'portrait' && mode !== 'wide') {
    const size = 0.48 * rem, px = 0.28 * rem, py = 0.1 * rem, tagGap = 0.2 * rem
    ctx.font = `${size}px ${palette.sans}`
    const chips = entity.tags.slice(0, 3).map((tag) => ({ text: tag.toUpperCase(), width: ctx.measureText(tag.toUpperCase()).width + px * 2 }))
    const chipH = size * 1.5 + py * 2
    const rows: Array<typeof chips> = [[]]
    let rowWidth = 0
    for (const chip of chips) {
      if (rows[rows.length - 1].length && rowWidth + tagGap + chip.width > contentW) { rows.push([]); rowWidth = 0 }
      rowWidth += (rows[rows.length - 1].length ? tagGap : 0) + chip.width
      rows[rows.length - 1].push(chip)
    }
    blocks.push({ height: rows.length * chipH + (rows.length - 1) * tagGap, draw: (top) => {
      ctx.font = `${size}px ${palette.sans}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      rows.forEach((row, r) => {
        let x = contentX
        const y = top + r * (chipH + tagGap)
        for (const chip of row) {
          ctx.fillStyle = palette.primary; ctx.fillRect(x, y, chip.width, chipH)
          ctx.fillStyle = palette.primaryForeground; fillCentered(ctx, chip.text, x + px, y + chipH / 2)
          x += chip.width + tagGap
        }
      })
    } })
  }
  const total = blocks.reduce((sum, block) => sum + block.height, 0) + gap * Math.max(0, blocks.length - 1)
  const areaTop = innerY + padY, areaH = innerH - padY * 2
  let top = mode === 'wide' && thumbnail ? areaTop + areaH - total : areaTop + (areaH - total) / 2
  ctx.save()
  ctx.beginPath(); ctx.rect(bodyX, innerY, bodyW, innerH); ctx.clip()
  for (const block of blocks) { block.draw(top); top += block.height + gap }
  ctx.restore()
  if (mode === 'dossier') {
    ctx.save()
    const size = 0.45 * rem
    ctx.font = `${size}px ${palette.sans}`; setSpacing(ctx, size * 0.18)
    ctx.fillStyle = palette.primary30; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
    ctx.translate(w - 0.5 * rem, h - 0.35 * rem); ctx.rotate(-4 * Math.PI / 180)
    ctx.fillText('CONFIDENCIAL', 0, 0) /* base embaixo */
    ctx.restore()
  }
  // Faixa à esquerda (::before) e alfinete.
  ctx.fillStyle = palette.primary
  ctx.fillRect(0, 0, 0.22 * rem, h)
  ctx.restore()
  // Borda por cima do conteúdo.
  ctx.save()
  // In high-contrast modes the outline is thicker and in the text colour, so the silhouette still
  // reads without the texture.
  const outlineWidth = display.strongOutline ? border + 1.5 : border
  ctx.strokeStyle = display.strongOutline ? palette.foreground : palette.primary48Border
  ctx.lineWidth = outlineWidth
  if (mode === 'minimal') ctx.setLineDash([3, 3])
  ctx.stroke(cardOutline(visual.silhouette, outlineWidth / 2, outlineWidth / 2, w - outlineWidth, h - outlineWidth))
  ctx.restore()
  if (mode !== 'minimal') {
    const d = 0.65 * rem, x = w / 2 + d / 2, y = 0.35 * rem + d / 2
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,1)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2
    ctx.beginPath(); ctx.arc(x, y + 2, d / 2, 0, Math.PI * 2); ctx.fillStyle = palette.primary55Black; ctx.fill()
    ctx.restore()
    ctx.beginPath(); ctx.arc(x, y, d / 2, 0, Math.PI * 2); ctx.fillStyle = palette.primary; ctx.fill()
  }
}

/** Fundo do canvas: cor do tema e pontilhado fixo na tela, como `.tl-canvas` no CSS do quadro. */
export function drawBoardBackground(ctx: Ctx, width: number, height: number, palette: BoardPalette) {
  ctx.fillStyle = palette.background || BOARD_BACKGROUND
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = palette.primary14
  for (let x = 12; x < width; x += 24) for (let y = 12; y < height; y += 24) { ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill() }
}
