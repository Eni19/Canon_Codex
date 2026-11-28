import type { TextureId } from '@/domain/entities/entityVisual'
import { seeded } from './seeded'

/**
 * Procedural textures of the record types (ADR-011), drawn in code as small seamless tiles. Each
 * tile is painted once per (texture, ink colour, device pixel ratio) and kept as a `CanvasPattern`,
 * shared by every card of the graph and of the boards: a handful of small bitmaps instead of one
 * cache per card.
 *
 * Tiles are measured in CSS pixels; the pattern maps one tile pixel to one device pixel. Painters
 * draw only in the ink colour, at the opacity they need; the renderer lays the pattern over the
 * card's solid fill, inside the card's silhouette.
 */

type Painter = (c: CanvasRenderingContext2D, w: number, h: number) => void
export type TextureTile = { readonly width: number; readonly height: number; readonly paint: Painter }

/** Largest tile side, in CSS pixels. */
export const MAX_TILE_SIZE = 96

/** Repeats a motif on the eight neighbouring tiles too, so whatever crosses an edge wraps around. */
function wrapped(w: number, h: number, draw: (dx: number, dy: number) => void) {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) draw(dx, dy)
}
function line(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  c.moveTo(x1, y1); c.lineTo(x2, y2)
}
/** Painters give relative opacities; tiles are painted three times stronger and the renderer
 * scales the whole tile down to the opacity the theme allows (see `textureOpacity`). */
const opacity = (c: CanvasRenderingContext2D, alpha: number) => { c.globalAlpha = Math.min(1, alpha * 3) }
function stroke(c: CanvasRenderingContext2D, alpha: number, width: number, trace: () => void) {
  opacity(c, alpha); c.lineWidth = width
  c.beginPath(); trace(); c.stroke()
}

const tile = (width: number, height: number, paint: Painter): TextureTile => ({ width, height, paint })

export const TEXTURE_TILES: Readonly<Record<Exclude<TextureId, 'none'>, TextureTile>> = {
  // Fine photographic grain: scattered specks of two sizes.
  photoGrain: tile(48, 48, (c, w, h) => {
    const random = seeded(101)
    for (let i = 0; i < 150; i++) {
      opacity(c, 0.1 + random() * 0.16)
      const size = random() < 0.8 ? 1 : 1.6
      c.fillRect(random() * w, random() * h, size, size)
    }
  }),
  // Flat-topped hexagons; the tile holds one hexagon and halves of its neighbours.
  honeycomb: tile(30, 18, (c, w, h) => stroke(c, 0.2, 1, () => {
    const s = w / 3, half = h / 2
    const hex = (cx: number, cy: number) => {
      c.moveTo(cx - s, cy)
      c.lineTo(cx - s / 2, cy - half); c.lineTo(cx + s / 2, cy - half); c.lineTo(cx + s, cy)
      c.lineTo(cx + s / 2, cy + half); c.lineTo(cx - s / 2, cy + half); c.closePath()
    }
    hex(s, half); hex(s * 2.5, 0); hex(s * 2.5, h); hex(-s / 2, 0); hex(-s / 2, h)
  })),
  // Map contour lines: gentle waves of different heights, periodic across the tile.
  contour: tile(64, 32, (c, w) => stroke(c, 0.2, 1, () => {
    for (const [base, amp, phase] of [[4, 2.5, 0], [12, 3.5, 1.3], [21, 2, 2.4], [28, 3, 4]] as const) {
      for (let x = 0; x <= w; x += 2) {
        const y = base + amp * Math.sin((x / w) * Math.PI * 2 + phase)
        if (x) c.lineTo(x, y); else c.moveTo(x, y)
      }
    }
  })),
  // Bricks in running bond.
  brick: tile(32, 16, (c, w, h) => stroke(c, 0.2, 1, () => {
    line(c, 0, 0.5, w, 0.5); line(c, 0, h / 2 + 0.5, w, h / 2 + 0.5)
    line(c, 0.5, 0, 0.5, h / 2); line(c, w / 2 + 0.5, h / 2, w / 2 + 0.5, h)
  })),
  // Kraft paper: short fibres at random angles.
  kraftFiber: tile(64, 64, (c, w, h) => {
    const random = seeded(202)
    const fibres = Array.from({ length: 70 }, () => ({ x: random() * w, y: random() * h, a: random() * Math.PI, l: 3 + random() * 7, o: 0.1 + random() * 0.14 }))
    for (const f of fibres) stroke(c, f.o, 0.8, () => wrapped(w, h, (dx, dy) =>
      line(c, f.x + dx, f.y + dy, f.x + dx + Math.cos(f.a) * f.l, f.y + dy + Math.sin(f.a) * f.l)))
  }),
  // Diagonal hatching, rising to the right.
  diagonalHatch: tile(10, 10, (c, w, h) => stroke(c, 0.2, 1, () => {
    for (const k of [-1, 0, 1]) line(c, k * w, h, k * w + w, 0)
  })),
  // Aged paper: soft blotches.
  agedStains: tile(96, 96, (c, w, h) => {
    const random = seeded(303)
    for (let i = 0; i < 9; i++) {
      const x = random() * w, y = random() * h, r = 8 + random() * 18, alpha = 0.06 + random() * 0.08
      const ry = r * (0.6 + random() * 0.4), turn = random() * Math.PI
      wrapped(w, h, (dx, dy) => {
        opacity(c, alpha)
        c.beginPath()
        c.ellipse(x + dx, y + dy, r, ry, turn, 0, Math.PI * 2)
        c.fill()
      })
    }
  }),
  // Ruled notebook lines.
  ruledLines: tile(8, 8, (c, w) => stroke(c, 0.22, 1, () => line(c, 0, 7.5, w, 7.5))),
  // Halftone dots on a diagonal grid.
  halftone: tile(8, 8, (c) => {
    opacity(c, 0.24)
    c.beginPath()
    for (const [x, y] of [[2, 2], [6, 6]]) { c.moveTo(x + 1.3, y); c.arc(x, y, 1.3, 0, Math.PI * 2) }
    c.fill()
  }),
  // Cross hatching.
  crossHatch: tile(10, 10, (c, w, h) => stroke(c, 0.17, 1, () => {
    for (const k of [-1, 0, 1]) { line(c, k * w, h, k * w + w, 0); line(c, k * w, 0, k * w + w, h) }
  })),
  // Fur: short, slightly curved strokes leaning the same way.
  fur: tile(48, 48, (c, w, h) => {
    const random = seeded(404)
    const hairs = Array.from({ length: 60 }, () => ({ x: random() * w, y: random() * h, l: 4 + random() * 5, bend: (random() - 0.5) * 3, o: 0.12 + random() * 0.14 }))
    for (const hair of hairs) stroke(c, hair.o, 0.8, () => wrapped(w, h, (dx, dy) => {
      c.moveTo(hair.x + dx, hair.y + dy)
      c.quadraticCurveTo(hair.x + dx + hair.bend, hair.y + dy - hair.l / 2, hair.x + dx + hair.bend * 0.4 + 1.5, hair.y + dy - hair.l)
    }))
  }),
  // Cells: rings of different sizes, each with a nucleus.
  cells: tile(64, 64, (c, w, h) => {
    const random = seeded(505)
    for (let i = 0; i < 11; i++) {
      const x = random() * w, y = random() * h, r = 4 + random() * 6
      wrapped(w, h, (dx, dy) => {
        stroke(c, 0.18, 1, () => { c.moveTo(x + dx + r, y + dy); c.arc(x + dx, y + dy, r, 0, Math.PI * 2) })
        opacity(c, 0.22)
        c.beginPath(); c.arc(x + dx + r * 0.2, y + dy - r * 0.1, Math.max(1, r * 0.22), 0, Math.PI * 2); c.fill()
      })
    }
  }),
  // Sine waves, one per tile row.
  sineWaves: tile(24, 10, (c, w, h) => stroke(c, 0.22, 1, () => {
    for (let x = 0; x <= w; x += 1) {
      const y = h / 2 + 2.6 * Math.sin((x / w) * Math.PI * 2)
      if (x) c.lineTo(x, y); else c.moveTo(x, y)
    }
  })),
  // Brushed metal: horizontal hairlines of varying strength, full width so the tile repeats.
  brushedMetal: tile(48, 48, (c, w, h) => {
    const random = seeded(606)
    for (let y = 0.5; y < h; y += 1) {
      const alpha = random() * 0.16
      if (alpha > 0.04) stroke(c, alpha, 0.6, () => line(c, 0, y, w, y))
    }
  }),
  // Squared paper.
  grid: tile(12, 12, (c, w, h) => stroke(c, 0.18, 1, () => { line(c, 0, h - 0.5, w, h - 0.5); line(c, w - 0.5, 0, w - 0.5, h) })),
  // Orbital rings: tilted ellipses around a small body, one system per tile.
  orbitalRings: tile(56, 56, (c, w, h) => {
    const cx = w / 2, cy = h / 2
    stroke(c, 0.18, 1, () => {
      for (const r of [8, 15, 23]) { c.moveTo(cx + r, cy); c.ellipse(cx, cy, r, r * 0.45, -0.35, 0, Math.PI * 2) }
    })
    opacity(c, 0.24)
    c.beginPath(); c.arc(cx, cy, 2, 0, Math.PI * 2); c.fill()
  }),
  // Regular vertical stripes, as on a scale.
  verticalStripes: tile(7, 8, (c, w, h) => stroke(c, 0.2, 1, () => line(c, w - 0.5, 0, w - 0.5, h))),
}

type CanvasLike = { width: number; height: number; getContext(kind: '2d'): CanvasRenderingContext2D | null }

/** A painted tile as a pattern, with the strongest opacity it reaches (0 to 1). */
export type TexturePattern = { readonly pattern: CanvasPattern; readonly peak: number }

type PatternCache = {
  /** The pattern of `texture` in `ink` at `dpr`, or null for `none` or when canvas is unavailable. */
  get(target: CanvasRenderingContext2D, texture: TextureId, ink: string, dpr: number): TexturePattern | null
  readonly size: number
  clear(): void
}

function peakAlpha(c: CanvasRenderingContext2D, width: number, height: number) {
  const data = c.getImageData(0, 0, width, height).data
  let peak = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] > peak) peak = data[i]
  return peak / 255
}

/**
 * A bounded cache of texture patterns. Entries beyond `limit` drop the least recently used, so
 * switching themes or screens back and forth never piles up tiles.
 */
export function createTexturePatterns({
  createCanvas = (width: number, height: number): CanvasLike => Object.assign(document.createElement('canvas'), { width, height }),
  limit = Object.keys(TEXTURE_TILES).length * 2,
} = {}): PatternCache {
  const patterns = new Map<string, TexturePattern | null>()
  return {
    get(target, texture, ink, dpr) {
      if (texture === 'none') return null
      const ratio = Math.max(1, Math.min(4, Math.round(dpr * 4) / 4))
      const key = texture + '|' + ink + '|' + ratio
      if (patterns.has(key)) {
        const cached = patterns.get(key)!
        patterns.delete(key); patterns.set(key, cached)
        return cached
      }
      const { width, height, paint } = TEXTURE_TILES[texture]
      const element = createCanvas(Math.round(width * ratio), Math.round(height * ratio))
      const c = element.getContext('2d')
      let result: TexturePattern | null = null
      if (c) {
        c.scale(element.width / width, element.height / height)
        c.fillStyle = ink; c.strokeStyle = ink
        paint(c, width, height)
        const pattern = target.createPattern(element as HTMLCanvasElement, 'repeat')
        if (pattern && typeof DOMMatrix !== 'undefined') pattern.setTransform(new DOMMatrix([width / element.width, 0, 0, height / element.height, 0, 0]))
        if (pattern) result = { pattern, peak: peakAlpha(c, element.width, element.height) }
      }
      patterns.set(key, result)
      while (patterns.size > limit) patterns.delete(patterns.keys().next().value!)
      return result
    },
    get size() { return patterns.size },
    clear() { patterns.clear() },
  }
}

/** The cache shared by the relationship graph and the boards. */
export const entityTexturePatterns = createTexturePatterns()
