import type { SilhouetteId } from '@/domain/entities/entityVisual'

/**
 * Card outlines for the record types of the visual catalog (ADR-011), traced into any 2D path:
 * a `Path2D`, a canvas context or a Konva context. Only the five calls below are used, so the same
 * tracer serves the graph, its batched view and the boards, and a test can record the commands.
 *
 * Every outline stays inside the box (x, y, w, h), touches the midpoint of each side and is traced
 * clockwise (screen coordinates), so a hole traced the other way is left empty by a nonzero fill
 * even when many cards share one path. Some outlines add open strokes (a fold, ruler marks) after
 * the closed outline; filling them adds no area.
 */
export interface PathSink {
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void
  closePath(): void
}

/** Bezier handle length for a quarter circle. */
const KAPPA = 0.5523

type Tracer = (path: PathSink, x: number, y: number, w: number, h: number) => void

/** A corner curve from (ax, ay) to (bx, by) around the box corner (cx, cy); `k` = 0 is a sharp
 * corner, KAPPA a quarter circle and smaller values a squarer, superellipse-like corner. */
function corner(path: PathSink, ax: number, ay: number, cx: number, cy: number, bx: number, by: number, k = KAPPA) {
  path.bezierCurveTo(ax + (cx - ax) * k, ay + (cy - ay) * k, bx + (cx - bx) * k, by + (cy - by) * k, bx, by)
}

function roundedBox(path: PathSink, x: number, y: number, w: number, h: number, radius: number, k = KAPPA) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2))
  const right = x + w, bottom = y + h
  path.moveTo(x + r, y)
  path.lineTo(right - r, y)
  corner(path, right - r, y, right, y, right, y + r, k)
  path.lineTo(right, bottom - r)
  corner(path, right, bottom - r, right, bottom, right - r, bottom, k)
  path.lineTo(x + r, bottom)
  corner(path, x + r, bottom, x, bottom, x, bottom - r, k)
  path.lineTo(x, y + r)
  corner(path, x, y + r, x, y, x + r, y, k)
  path.closePath()
}

/** Straight-sided polygon from points relative to (x, y). */
function polygon(path: PathSink, x: number, y: number, points: readonly (readonly [number, number])[]) {
  path.moveTo(x + points[0][0], y + points[0][1])
  for (let i = 1; i < points.length; i++) path.lineTo(x + points[i][0], y + points[i][1])
  path.closePath()
}

/** A circle traced counterclockwise, so it is a hole inside a clockwise outline. */
function hole(path: PathSink, cx: number, cy: number, r: number) {
  const k = r * KAPPA
  path.moveTo(cx + r, cy)
  path.bezierCurveTo(cx + r, cy - k, cx + k, cy - r, cx, cy - r)
  path.bezierCurveTo(cx - k, cy - r, cx - r, cy - k, cx - r, cy)
  path.bezierCurveTo(cx - r, cy + k, cx - k, cy + r, cx, cy + r)
  path.bezierCurveTo(cx + k, cy + r, cx + r, cy + k, cx + r, cy)
  path.closePath()
}

const TRACERS: Record<SilhouetteId, Tracer> = {
  rounded: (path, x, y, w, h) => roundedBox(path, x, y, w, h, 8),
  badge: (path, x, y, w, h) => roundedBox(path, x, y, w, h, Math.min(22, h * 0.32)),
  capsule: (path, x, y, w, h) => roundedBox(path, x, y, w, h, h / 2),
  // Handles longer than a circle's give the flat-sided, full corners of a superellipse.
  squircle: (path, x, y, w, h) => roundedBox(path, x, y, w, h, Math.min(h / 2, w / 4), 0.9),
  hexagon: (path, x, y, w, h) => {
    const c = Math.min(16, w / 4)
    polygon(path, x, y, [[c, 0], [w - c, 0], [w, h / 2], [w - c, h], [c, h], [0, h / 2]])
  },
  chamfered: (path, x, y, w, h) => {
    const c = Math.min(10, w / 4, h / 4)
    polygon(path, x, y, [[c, 0], [w - c, 0], [w, c], [w, h - c], [w - c, h], [c, h], [0, h - c], [0, c]])
  },
  flag: (path, x, y, w, h) => {
    const f = Math.min(16, w / 4), r = Math.min(6, h / 4)
    path.moveTo(x + r, y)
    path.lineTo(x + w - f, y)
    path.lineTo(x + w, y + h / 2)
    path.lineTo(x + w - f, y + h)
    path.lineTo(x + r, y + h)
    corner(path, x + r, y + h, x, y + h, x, y + h - r)
    path.lineTo(x, y + r)
    corner(path, x, y + r, x, y, x + r, y)
    path.closePath()
  },
  tag: (path, x, y, w, h) => {
    const t = Math.min(14, w / 4), r = Math.min(6, h / 4)
    path.moveTo(x + t, y)
    path.lineTo(x + w - r, y)
    corner(path, x + w - r, y, x + w, y, x + w, y + r)
    path.lineTo(x + w, y + h - r)
    corner(path, x + w, y + h - r, x + w, y + h, x + w - r, y + h)
    path.lineTo(x + t, y + h)
    path.lineTo(x, y + h / 2)
    path.closePath()
    hole(path, x + t * 0.6, y + h / 2, Math.min(3.5, h / 10))
  },
  ticket: (path, x, y, w, h) => {
    // Concave corner notches, as on a printed ticket.
    const n = Math.min(10, w / 5, h / 5)
    path.moveTo(x + n, y)
    path.lineTo(x + w - n, y)
    path.quadraticCurveTo(x + w - n, y + n, x + w, y + n)
    path.lineTo(x + w, y + h - n)
    path.quadraticCurveTo(x + w - n, y + h - n, x + w - n, y + h)
    path.lineTo(x + n, y + h)
    path.quadraticCurveTo(x + n, y + h - n, x, y + h - n)
    path.lineTo(x, y + n)
    path.quadraticCurveTo(x + n, y + n, x + n, y)
    path.closePath()
  },
  pediment: (path, x, y, w, h) => {
    // A straight gable on top, as on the front of a building.
    const p = Math.min(12, h / 4), r = Math.min(4, h / 8)
    path.moveTo(x, y + p)
    path.lineTo(x + w / 2, y)
    path.lineTo(x + w, y + p)
    path.lineTo(x + w, y + h - r)
    corner(path, x + w, y + h - r, x + w, y + h, x + w - r, y + h)
    path.lineTo(x + r, y + h)
    corner(path, x + r, y + h, x, y + h, x, y + h - r)
    path.closePath()
  },
  arch: (path, x, y, w, h) => {
    // A curved top, as on a portal; the curve's highest point is the top midpoint.
    const p = Math.min(12, h / 4), r = Math.min(4, h / 8)
    path.moveTo(x, y + p)
    path.quadraticCurveTo(x + w / 2, y - p, x + w, y + p)
    path.lineTo(x + w, y + h - r)
    corner(path, x + w, y + h - r, x + w, y + h, x + w - r, y + h)
    path.lineTo(x + r, y + h)
    corner(path, x + r, y + h, x, y + h, x, y + h - r)
    path.closePath()
  },
  folder: (path, x, y, w, h) => {
    // The tab runs along the top left and covers the top midpoint; the body starts lower.
    const t = Math.min(8, h / 6), r = Math.min(5, h / 8), tabEnd = x + w * 0.58
    path.moveTo(x + r, y)
    path.lineTo(tabEnd, y)
    path.lineTo(tabEnd + t, y + t)
    path.lineTo(x + w - r, y + t)
    corner(path, x + w - r, y + t, x + w, y + t, x + w, y + t + r)
    path.lineTo(x + w, y + h - r)
    corner(path, x + w, y + h - r, x + w, y + h, x + w - r, y + h)
    path.lineTo(x + r, y + h)
    corner(path, x + r, y + h, x, y + h, x, y + h - r)
    path.lineTo(x, y + r)
    corner(path, x, y + r, x, y, x + r, y)
    path.closePath()
  },
  foldedCorner: (path, x, y, w, h) => {
    const d = Math.min(16, w / 4, h / 3), r = Math.min(4, h / 8)
    path.moveTo(x + r, y)
    path.lineTo(x + w - d, y)
    path.lineTo(x + w, y + d)
    path.lineTo(x + w, y + h - r)
    corner(path, x + w, y + h - r, x + w, y + h, x + w - r, y + h)
    path.lineTo(x + r, y + h)
    corner(path, x + r, y + h, x, y + h, x, y + h - r)
    path.lineTo(x, y + r)
    corner(path, x, y + r, x, y, x + r, y)
    path.closePath()
    // The fold itself, an open stroke inside the outline.
    path.moveTo(x + w - d, y)
    path.lineTo(x + w - d, y + d)
    path.lineTo(x + w, y + d)
  },
  serrated: (path, x, y, w, h) => {
    // Sawtooth top, as on a sealed evidence bag; an odd tooth count puts a tip on the midpoint.
    const a = Math.min(5, h / 10), r = Math.min(4, h / 8)
    const teeth = Math.max(3, Math.round(w / 14)) | 1, step = w / teeth
    path.moveTo(x, y + a)
    for (let i = 0; i < teeth; i++) {
      path.lineTo(x + (i + 0.5) * step, y)
      path.lineTo(x + (i + 1) * step, y + a)
    }
    path.lineTo(x + w, y + h - r)
    corner(path, x + w, y + h - r, x + w, y + h, x + w - r, y + h)
    path.lineTo(x + r, y + h)
    corner(path, x + r, y + h, x, y + h, x, y + h - r)
    path.closePath()
  },
  scroll: (path, x, y, w, h) => {
    // A full-height sheet between two shorter rolls at the ends.
    const s = Math.min(10, w / 8), v = Math.min(6, h / 8)
    path.moveTo(x + s, y)
    path.lineTo(x + w - s, y)
    path.lineTo(x + w - s, y + v)
    path.quadraticCurveTo(x + w, y + v, x + w, y + v + s)
    path.lineTo(x + w, y + h - v - s)
    path.quadraticCurveTo(x + w, y + h - v, x + w - s, y + h - v)
    path.lineTo(x + w - s, y + h)
    path.lineTo(x + s, y + h)
    path.lineTo(x + s, y + h - v)
    path.quadraticCurveTo(x, y + h - v, x, y + h - v - s)
    path.lineTo(x, y + v + s)
    path.quadraticCurveTo(x, y + v, x + s, y + v)
    path.closePath()
  },
  organic: (path, x, y, w, h) => {
    // Uneven, living sides. All control points stay inside the box, so the curves do too.
    path.moveTo(x + 12, y + 4)
    path.quadraticCurveTo(x + w * 0.25, y, x + w / 2, y)
    path.quadraticCurveTo(x + w * 0.8, y + 3, x + w - 9, y + 3)
    path.quadraticCurveTo(x + w - 2, y + 6, x + w - 5, y + h * 0.25)
    path.quadraticCurveTo(x + w - 8, y + h * 0.4, x + w, y + h / 2)
    path.quadraticCurveTo(x + w - 1, y + h * 0.8, x + w - 10, y + h - 3)
    path.quadraticCurveTo(x + w * 0.75, y + h, x + w / 2, y + h)
    path.quadraticCurveTo(x + w * 0.2, y + h - 2, x + 8, y + h - 5)
    path.quadraticCurveTo(x + 1, y + h * 0.7, x, y + h / 2)
    path.quadraticCurveTo(x + 5, y + h * 0.3, x + 3, y + 12)
    path.quadraticCurveTo(x + 4, y + 5, x + 12, y + 4)
    path.closePath()
  },
  wavy: (path, x, y, w, h) => {
    // Waves along the top and bottom: crests touch the box at the midpoints.
    const a = Math.min(6, h / 8), waves = Math.max(1, Math.round(w / 60)), half = w / (waves * 2)
    // With `waves` full periods centred on the midpoint, the ends sit on a crest or a trough.
    const edge = (from: number, dir: 1 | -1, base: number, out: 1 | -1) => {
      let px = from, py = base + (waves % 2 ? out * a : 0)
      for (let i = 0; i < waves * 2; i++) {
        const nx = px + dir * half, ny = py === base ? base + out * a : base
        path.bezierCurveTo(px + dir * half / 2, py, nx - dir * half / 2, ny, nx, ny)
        px = nx; py = ny
      }
      return py
    }
    const start = y + (waves % 2 ? a : 0)
    path.moveTo(x, start)
    edge(x, 1, y, 1)
    path.lineTo(x + w, y + h - (waves % 2 ? a : 0))
    edge(x + w, -1, y + h, -1)
    path.closePath()
  },
  ruler: (path, x, y, w, h) => {
    roundedBox(path, x, y, w, h, Math.min(3, h / 8))
    // Ruler marks along the bottom, longer every fifth mark, kept clear of the corners.
    const step = 12, short = Math.min(4, h / 12), long = Math.min(8, h / 7)
    for (let i = 1, mark = x + step; mark < x + w - 4; i++, mark += step) {
      path.moveTo(mark, y + h)
      path.lineTo(mark, y + h - (i % 5 ? short : long))
    }
  },
}

/** Traces the outline of `silhouette` inside the box (x, y, w, h), with its holes and marks. */
export function traceSilhouette(path: PathSink, silhouette: SilhouetteId, x: number, y: number, w: number, h: number) {
  TRACERS[silhouette](path, x, y, w, h)
}
