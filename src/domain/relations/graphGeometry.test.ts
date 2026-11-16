import { describe, expect, it } from 'vitest'
import type { Relation } from './relation'
import { fitGraph, freeArrowPoints, initialGraphPosition, organizeGraph, relationshipLanes, relationshipPoints, resizeGraph, zoomGraph } from './graphGeometry'

const edge = (id: string, sourceId: string, targetId: string): Relation => ({ id, sourceId, targetId, type: 'tipo', directional: true })

describe('graph geometry', () => {
  it('attaches arrow heads at card edges, follows moved cards, and falls back for a missing card', () => {
    const start = { point: { x: 90, y: 35 }, cardId: 'a' }
    const end = { point: { x: 390, y: 35 }, cardId: 'b' }
    let x = 300
    const card = (id: string) => ({ x: id === 'a' ? 0 : x, y: 0 })
    expect(freeArrowPoints(start, end, card).slice(-2)).toEqual([300, 35])
    x = 500
    expect(freeArrowPoints(start, end, card).slice(-2)).toEqual([500, 35])
    expect(freeArrowPoints(start, end, () => undefined)).toEqual([90, 35, 390, 35])
    expect(freeArrowPoints(start, start, card)).toHaveLength(8)
  })
  it('separates parallel edges in either direction independently of input order', () => {
    const edges = [edge('1', 'a', 'b'), edge('2', 'a', 'b'), edge('3', 'b', 'a')]
    const lanes = relationshipLanes(edges)
    expect(relationshipLanes([...edges].reverse())).toEqual(lanes)
    const middle = edges.map((item) => relationshipPoints(item.sourceId === 'a' ? { x: 0, y: 0 } : { x: 300, y: 0 }, item.targetId === 'b' ? { x: 300, y: 0 } : { x: 0, y: 0 }, lanes.get(item.id)!, false)[3])
    expect(new Set(middle).size).toBe(3)
  })
  it('uses finite coordinates for overlapping cards and self loops', () => {
    expect(relationshipPoints({ x: 0, y: 0 }, { x: 0, y: 0 }, 15, false).every(Number.isFinite)).toBe(true)
  })
  it('fits the bounds and returns a safe default for an empty graph', () => {
    expect(fitGraph([], 800, 480)).toEqual({ x: 0, y: 0, scale: 1 })
    const fit = fitGraph([{ x: 0, y: 0 }, { x: 1000, y: 800 }], 800, 480)
    expect(fit.scale).toBeLessThan(1)
    expect(fit.x).toBeGreaterThanOrEqual(0)
    expect(fit.y).toBeGreaterThanOrEqual(0)
  })
  it('spreads a dense initial graph into a grid that fits the canvas', () => {
    const points = Array.from({ length: 500 }, (_, index) => initialGraphPosition(index, 500))
    const fit = fitGraph(points, 900, 480)
    expect(fit.scale).toBeGreaterThan(0.05)
    expect(Math.min(...points.map((point) => point.y)) * fit.scale + fit.y).toBeGreaterThanOrEqual(0)
    expect(Math.max(...points.map((point) => point.y + 70)) * fit.scale + fit.y).toBeLessThanOrEqual(480)
  })
  it('keeps the world point under the pointer through zoom and translated pinch at the scale limits', () => {
    const camera = { x: 120, y: -40, scale: 0.5 }
    const start = { x: 145, y: 190 }
    const end = { x: 130, y: 218 }
    const next = zoomGraph(camera, start, 25, end)
    expect(next.scale).toBe(3)
    expect((start.x - camera.x) / camera.scale).toBeCloseTo((end.x - next.x) / next.scale)
    expect((start.y - camera.y) / camera.scale).toBeCloseTo((end.y - next.y) / next.scale)
  })
  it('preserves world center and scale when the viewport changes orientation', () => {
    const original = { x: 1440, y: 900 }
    const rotated = { x: 390, y: 844 }
    const camera = { x: -120, y: 40, scale: 1.25 }
    const next = resizeGraph(camera, original, rotated)
    expect(next.scale).toBe(camera.scale)
    expect((original.x / 2 - camera.x) / camera.scale).toBe((rotated.x / 2 - next.x) / next.scale)
    expect((original.y / 2 - camera.y) / camera.scale).toBe((rotated.y / 2 - next.y) / next.scale)
  })
  it('places connected records together deterministically and avoids pinned cards', () => {
    const records = ['a', 'b', 'c', 'd', 'e']
    const relations = [edge('1', 'a', 'e'), edge('2', 'c', 'd')]
    const fixed = { b: { x: 275, y: 149 } }
    const layout = organizeGraph(records, relations, fixed)
    expect(organizeGraph([...records].reverse(), [...relations].reverse(), fixed)).toEqual(layout)
    expect(layout.b).toEqual(fixed.b)
    expect(Math.hypot(layout.a.x - layout.e.x, layout.a.y - layout.e.y)).toBeLessThanOrEqual(280)
    for (const id of records) for (const other of records) if (id !== other) {
      expect(Math.abs(layout[id].x - layout[other].x) >= 180 || Math.abs(layout[id].y - layout[other].y) >= 70).toBe(true)
    }
  })
})
