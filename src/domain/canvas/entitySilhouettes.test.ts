import { describe, expect, it } from 'vitest'
import { ENTITY_SILHOUETTES, type SilhouetteId } from '@/domain/entities/entityVisual'
import { traceSilhouette, type PathSink } from './entitySilhouettes'

type Pt = [number, number]
type Subpath = { points: Pt[]; closed: boolean }

/** Records a traced path as polylines, sampling each curve. */
function record(silhouette: SilhouetteId, x: number, y: number, w: number, h: number) {
  const subpaths: Subpath[] = []
  let current: Subpath | null = null
  const last = () => current!.points[current!.points.length - 1]
  const sample = (at: (t: number) => Pt) => { for (let i = 1; i <= 24; i++) current!.points.push(at(i / 24)) }
  const sink: PathSink = {
    moveTo(px, py) { current = { points: [[px, py]], closed: false }; subpaths.push(current) },
    lineTo(px, py) { current!.points.push([px, py]) },
    quadraticCurveTo(cx, cy, px, py) {
      const [ax, ay] = last()
      sample((t) => [(1 - t) ** 2 * ax + 2 * (1 - t) * t * cx + t ** 2 * px, (1 - t) ** 2 * ay + 2 * (1 - t) * t * cy + t ** 2 * py])
    },
    bezierCurveTo(c1x, c1y, c2x, c2y, px, py) {
      const [ax, ay] = last()
      const b = (a: number, b1: number, b2: number, c: number, t: number) =>
        (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b1 + 3 * (1 - t) * t ** 2 * b2 + t ** 3 * c
      sample((t) => [b(ax, c1x, c2x, px, t), b(ay, c1y, c2y, py, t)])
    },
    closePath() { current!.closed = true },
  }
  traceSilhouette(sink, silhouette, x, y, w, h)
  return subpaths
}

const area = (points: Pt[]) => {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length]
    sum += ax * by - bx * ay
  }
  return sum / 2
}
const distanceToOutline = (points: Pt[], [px, py]: Pt) => {
  let best = Infinity
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length]
    const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy
    const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy))
  }
  return best
}

// The graph card, a small board card and a wide board card.
const boxes = [[0, 0, 180, 70], [40, -25, 120, 48], [-300, 120, 320, 140]] as const

describe.each(ENTITY_SILHOUETTES)('traceSilhouette(%s)', (silhouette) => {
  it.each(boxes)('stays inside the box (%d, %d, %d×%d)', (x, y, w, h) => {
    for (const { points } of record(silhouette, x, y, w, h)) for (const [px, py] of points) {
      expect(px).toBeGreaterThanOrEqual(x - 1e-9)
      expect(px).toBeLessThanOrEqual(x + w + 1e-9)
      expect(py).toBeGreaterThanOrEqual(y - 1e-9)
      expect(py).toBeLessThanOrEqual(y + h + 1e-9)
    }
  })

  it.each(boxes)('touches the midpoint of every side (%d, %d, %d×%d)', (x, y, w, h) => {
    const [outline] = record(silhouette, x, y, w, h)
    for (const midpoint of [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]] as Pt[]) {
      expect(distanceToOutline(outline.points, midpoint), `${midpoint}`).toBeLessThan(0.05)
    }
  })

  it('starts with one closed, clockwise outline that keeps most of the box', () => {
    const [outline, ...rest] = record(silhouette, 0, 0, 180, 70)
    expect(outline.closed).toBe(true)
    expect(area(outline.points)).toBeGreaterThan(180 * 70 * 0.85)
    // Extra closed subpaths are holes (counterclockwise); open ones are marks that add no area.
    for (const extra of rest) if (extra.closed) expect(area(extra.points)).toBeLessThan(0)
  })
})

describe('silhouette catalog', () => {
  it('draws a different outline for every silhouette', () => {
    const signatures = ENTITY_SILHOUETTES.map((silhouette) =>
      JSON.stringify(record(silhouette, 0, 0, 180, 70).map(({ points }) => points.map(([px, py]) => [px.toFixed(1), py.toFixed(1)]))))
    expect(new Set(signatures).size).toBe(ENTITY_SILHOUETTES.length)
  })

  it('keeps the neutral card equal to the rounded box drawn before #72', () => {
    const [outline] = record('rounded', 0, 0, 180, 70)
    expect(outline.points[0]).toEqual([8, 0])
    expect(distanceToOutline(outline.points, [0, 0])).toBeCloseTo(8 * (Math.SQRT2 - 1), 0)
  })

  it('punches the hole of the tag and leaves it empty', () => {
    const [, holePath] = record('tag', 0, 0, 180, 70)
    expect(holePath.closed).toBe(true)
    expect(area(holePath.points)).toBeLessThan(0)
  })
})
