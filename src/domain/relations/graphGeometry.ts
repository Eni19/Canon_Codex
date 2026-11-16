import type { Relation } from './relation'

type Point = { x: number; y: number }
const CARD_WIDTH = 180
const CARD_HEIGHT = 70

/** Spread large worlds across a wider grid while keeping small worlds familiar. */
export function initialGraphPosition(index: number, count: number): Point {
  const columns = Math.max(4, Math.ceil(Math.sqrt(count * 1.4)))
  return { x: 45 + (index % columns) * 300, y: 45 + Math.floor(index / columns) * 170 }
}

/** Stable lanes for all edges sharing an unordered pair, including reverse directions. */
export function relationshipLanes(relations: Relation[]): Map<string, number> {
  const pairs = new Map<string, Relation[]>()
  for (const relation of relations) {
    const key = JSON.stringify([relation.sourceId, relation.targetId].sort())
    const group = pairs.get(key) ?? []
    group.push(relation)
    pairs.set(key, group)
  }
  const lanes = new Map<string, number>()
  for (const group of pairs.values()) {
    group.sort((a, b) => a.id.localeCompare(b.id))
    group.forEach((edge, index) => lanes.set(edge.id, (index - (group.length - 1) / 2) * 30 * (edge.sourceId <= edge.targetId ? 1 : -1)))
  }
  return lanes
}

/** Return points from the card boundary to the other boundary, even for loops. */
export function relationshipPoints(source: Point, target: Point, lane: number, self: boolean): number[] {
  if (self || (source.x === target.x && source.y === target.y)) {
    const height = 55 + Math.abs(lane)
    return [source.x + 140, source.y, source.x + 190 + lane, source.y - height, source.x + 75 + lane, source.y - height - 10, source.x + 35, source.y]
  }
  const dx = target.x - source.x; const dy = target.y - source.y
  const distance = Math.hypot(dx, dy)
  const factor = Math.min(dx ? CARD_WIDTH / 2 / Math.abs(dx) : Infinity, dy ? CARD_HEIGHT / 2 / Math.abs(dy) : Infinity)
  return [source.x + CARD_WIDTH / 2 + dx * factor, source.y + CARD_HEIGHT / 2 + dy * factor,
    (source.x + target.x) / 2 + CARD_WIDTH / 2 - dy / distance * lane,
    (source.y + target.y) / 2 + CARD_HEIGHT / 2 + dx / distance * lane,
    target.x + CARD_WIDTH / 2 - dx * factor, target.y + CARD_HEIGHT / 2 - dy * factor]
}

export function fitGraph(points: Point[], width: number, height: number) {
  if (!points.length || width <= 0 || height <= 0) return { x: 0, y: 0, scale: 1 }
  const left = Math.min(...points.map((point) => point.x))
  const top = Math.min(...points.map((point) => point.y))
  const right = Math.max(...points.map((point) => point.x + CARD_WIDTH))
  const bottom = Math.max(...points.map((point) => point.y + CARD_HEIGHT))
  const scale = Math.min(1.5, Math.max(0.05, Math.min((width - 32) / (right - left), (height - 32) / (bottom - top))))
  return { x: (width - (right - left) * scale) / 2 - left * scale, y: (height - (bottom - top) * scale) / 2 - top * scale, scale }
}
