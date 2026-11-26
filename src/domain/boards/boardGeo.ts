import type { Point } from '@/domain/canvas/geometry'
import type { GeoType } from './boardCanvas'

export type GeoOutline = { outline: Point[]; marks: Point[][] }

const polygon = (w: number, h: number, sides: number, rotation = -Math.PI / 2): Point[] =>
  Array.from({ length: sides }, (_, i) => {
    const angle = rotation + (i / sides) * Math.PI * 2
    return { x: w / 2 + Math.cos(angle) * w / 2, y: h / 2 + Math.sin(angle) * h / 2 }
  })

const ellipse = (cx: number, cy: number, rx: number, ry: number, from = 0, to = Math.PI * 2, steps = 48): Point[] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const angle = from + (to - from) * i / steps
    return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry }
  })

/**
 * Contorno fechado de cada forma geométrica, no espaço da forma (0..w, 0..h), mais marcas
 * internas abertas (o X da caixa e o visto da caixa marcada).
 */
export function geoOutline(geo: GeoType, w: number, h: number): GeoOutline {
  const rect = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]
  switch (geo) {
    case 'rectangle': return { outline: rect, marks: [] }
    case 'ellipse': return { outline: ellipse(w / 2, h / 2, w / 2, h / 2).slice(0, -1), marks: [] }
    case 'triangle': return { outline: [{ x: w / 2, y: 0 }, { x: w, y: h }, { x: 0, y: h }], marks: [] }
    case 'diamond': return { outline: [{ x: w / 2, y: 0 }, { x: w, y: h / 2 }, { x: w / 2, y: h }, { x: 0, y: h / 2 }], marks: [] }
    case 'pentagon': return { outline: polygon(w, h, 5), marks: [] }
    case 'hexagon': return { outline: polygon(w, h, 6, 0), marks: [] }
    case 'octagon': return { outline: polygon(w, h, 8, Math.PI / 8), marks: [] }
    case 'star': {
      const points: Point[] = []
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 === 0 ? 1 : 0.42
        points.push({ x: w / 2 + Math.cos(angle) * w / 2 * k, y: h / 2 + Math.sin(angle) * h / 2 * k })
      }
      return { outline: points, marks: [] }
    }
    case 'rhombus': { const o = Math.min(w * 0.25, h); return { outline: [{ x: o, y: 0 }, { x: w, y: 0 }, { x: w - o, y: h }, { x: 0, y: h }], marks: [] } }
    case 'rhombus-2': { const o = Math.min(w * 0.25, h); return { outline: [{ x: 0, y: 0 }, { x: w - o, y: 0 }, { x: w, y: h }, { x: o, y: h }], marks: [] } }
    case 'trapezoid': { const o = Math.min(w * 0.25, h); return { outline: [{ x: o, y: 0 }, { x: w - o, y: 0 }, { x: w, y: h }, { x: 0, y: h }], marks: [] } }
    case 'oval': {
      // Cápsula: semicírculos nas pontas do lado menor.
      if (w >= h) { const r = h / 2; return { outline: [...ellipse(w - r, r, r, r, -Math.PI / 2, Math.PI / 2, 24), ...ellipse(r, r, r, r, Math.PI / 2, Math.PI * 1.5, 24)], marks: [] } }
      const r = w / 2
      return { outline: [...ellipse(r, r, r, r, Math.PI, Math.PI * 2, 24), ...ellipse(r, h - r, r, r, 0, Math.PI, 24)], marks: [] }
    }
    case 'arrow-right': case 'arrow-left': case 'arrow-up': case 'arrow-down': {
      const horizontal = geo === 'arrow-right' || geo === 'arrow-left'
      const L = horizontal ? w : h, T = horizontal ? h : w
      const head = Math.min(L, T) / 2, shaft = T / 3
      // Seta para a direita em coordenadas (comprimento, espessura), depois girada para o lado pedido.
      const base = [{ x: 0, y: shaft }, { x: L - head, y: shaft }, { x: L - head, y: 0 }, { x: L, y: T / 2 }, { x: L - head, y: T }, { x: L - head, y: T - shaft }, { x: 0, y: T - shaft }]
      const map = (p: Point): Point => geo === 'arrow-right' ? p : geo === 'arrow-left' ? { x: L - p.x, y: p.y } : geo === 'arrow-down' ? { x: p.y, y: p.x } : { x: p.y, y: L - p.x }
      return { outline: base.map(map), marks: [] }
    }
    case 'x-box': return { outline: rect, marks: [[{ x: 0, y: 0 }, { x: w, y: h }], [{ x: w, y: 0 }, { x: 0, y: h }]] }
    case 'check-box': {
      const s = Math.min(w, h) * 0.82
      const ox = (w - s) / 2, oy = (h - s) / 2
      return { outline: rect, marks: [[{ x: ox + s * 0.25, y: oy + s * 0.52 }, { x: ox + s * 0.45, y: oy + s * 0.75 }, { x: ox + s * 0.75, y: oy + s * 0.3 }]] }
    }
    case 'heart': {
      const points: Point[] = []
      for (let i = 0; i <= 64; i++) {
        const t = (i / 64) * Math.PI * 2
        const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
        points.push({ x: w / 2 + x / 32 * w, y: (12 - y) / 29 * h })
      }
      return { outline: points.slice(0, -1), marks: [] }
    }
    case 'cloud': {
      // Bolhas em volta de uma elipse, como a nuvem do tldraw.
      const bumps = Math.max(6, Math.round((w + h) / 60))
      const points: Point[] = []
      for (let i = 0; i < bumps; i++) {
        const a0 = (i / bumps) * Math.PI * 2, a1 = ((i + 1) / bumps) * Math.PI * 2
        const p0 = { x: w / 2 + Math.cos(a0) * w * 0.42, y: h / 2 + Math.sin(a0) * h * 0.38 }
        const p1 = { x: w / 2 + Math.cos(a1) * w * 0.42, y: h / 2 + Math.sin(a1) * h * 0.38 }
        const mid = (a0 + a1) / 2, bulge = { x: w / 2 + Math.cos(mid) * w * 0.5, y: h / 2 + Math.sin(mid) * h * 0.5 }
        for (let k = 0; k < 8; k++) {
          const t = k / 8
          points.push({ x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * bulge.x + t * t * p1.x, y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * bulge.y + t * t * p1.y })
        }
      }
      return { outline: points, marks: [] }
    }
  }
}

/** Gerador pseudoaleatório estável por ID, para que o traço "desenhado" não mude a cada quadro. */
export function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/**
 * Traço "desenhado à mão" (estilo `draw` do tldraw): reamostra o caminho e desloca cada ponto um
 * pouco, de forma suave e sempre igual para a mesma forma. Cantos ficam levemente arredondados.
 */
export function handDrawnPath(points: Point[], closed: boolean, seed: string, strokeWidth: number): Point[] {
  if (points.length < 2) return points
  const random = seededRandom(seed)
  const path = closed ? [...points, points[0]] : points
  const spacing = Math.max(6, strokeWidth * 4)
  const result: Point[] = []
  const amplitude = strokeWidth * 0.35
  let phase = random() * Math.PI * 2
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    const steps = Math.max(1, Math.round(length / spacing))
    const nx = length ? -(b.y - a.y) / length : 0, ny = length ? (b.x - a.x) / length : 0
    for (let s = i === 1 ? 0 : 1; s <= steps; s++) {
      const t = s / steps
      phase += 0.6 + random() * 0.4
      const offset = Math.sin(phase) * amplitude
      result.push({ x: a.x + (b.x - a.x) * t + nx * offset, y: a.y + (b.y - a.y) * t + ny * offset })
    }
  }
  if (closed && result.length > 2) result[result.length - 1] = result[0]
  return result
}
