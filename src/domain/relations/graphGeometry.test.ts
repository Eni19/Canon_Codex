import { describe, expect, it } from 'vitest'
import type { Relation } from './relation'
import { fitGraph, initialGraphPosition, relationshipLanes, relationshipPoints } from './graphGeometry'

const edge = (id: string, sourceId: string, targetId: string): Relation => ({ id, sourceId, targetId, type: 'tipo', directional: true })

describe('graph geometry', () => {
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
})
