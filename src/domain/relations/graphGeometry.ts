import type { Relation } from './relation'

export type Point = { x: number; y: number }
export type ArrowEndpoint = { point: Point; cardId?: string }
export type Camera = Point & { scale: number }
export const CARD_WIDTH = 180
export const CARD_HEIGHT = 70

export function zoomGraph(camera: Camera, anchor: Point, scale: number, destination = anchor): Camera {
  const next = Math.min(3, Math.max(0.025, scale))
  return { x: destination.x - (anchor.x - camera.x) * next / camera.scale,
    y: destination.y - (anchor.y - camera.y) * next / camera.scale, scale: next }
}

export function resizeGraph(camera: Camera, before: Point, after: Point): Camera {
  return { ...camera, x: camera.x + (after.x - before.x) / 2, y: camera.y + (after.y - before.y) / 2 }
}

/** Stable component order, breadth-first within each component, and room around fixed cards. */
export function organizeGraph(ids: string[], relations: Relation[], fixed: Record<string, Point> = {}): Record<string, Point> {
  const ordered = [...ids].sort()
  const links = new Map(ordered.map((id) => [id, new Set<string>()]))
  for (const { sourceId, targetId } of relations) {
    if (!links.has(sourceId) || !links.has(targetId)) continue
    links.get(sourceId)?.add(targetId); links.get(targetId)?.add(sourceId)
  }
  const placed: Record<string, Point> = {}
  const buckets = new Map<string, Point[]>()
  const cell = ({ x, y }: Point) => [Math.floor(x / 280), Math.floor(y / 155)]
  const place = (id: string, point: Point) => {
    placed[id] = point
    const key = cell(point).join('/')
    const bucket = buckets.get(key)
    if (bucket) bucket.push(point)
    else buckets.set(key, [point])
  }
  for (const id of ordered) if (fixed[id]) place(id, fixed[id])
  const occupied = (point: Point) => {
    const [x, y] = cell(point)
    for (let row = y - 1; row <= y + 1; row++) for (let col = x - 1; col <= x + 1; col++) {
      if (buckets.get(col + '/' + row)?.some((p) => Math.abs(p.x - point.x) < CARD_WIDTH + 32 && Math.abs(p.y - point.y) < CARD_HEIGHT + 32)) return true
    }
    return false
  }
  const seen = new Set<string>()
  const columns = Math.max(2, Math.ceil(Math.sqrt(ids.length * 1.4)))
  let slot = 0
  for (const root of ordered) {
    if (seen.has(root)) continue
    const component = [root]; seen.add(root)
    for (let index = 0; index < component.length; index++) {
      for (const neighbor of [...(links.get(component[index]) ?? [])].sort()) {
        if (!seen.has(neighbor)) { seen.add(neighbor); component.push(neighbor) }
      }
    }
    const column = slot % columns
    if (component.length > 1 && column > 0) {
      slot += column + 1 + component.length > columns ? columns - column : 1
    }
    for (const id of component) {
      if (placed[id]) continue
      let point: Point
      do { point = { x: slot % columns * 280, y: Math.floor(slot / columns) * 155 }; slot++ } while (occupied(point))
      place(id, point)
    }
  }
  return placed
}

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
    const height = 65 + Math.abs(lane) * 1.5
    return [source.x + 140, source.y, source.x + 175 + lane, source.y - height, source.x + 25 + lane, source.y - height, source.x + 35, source.y]
  }
  const dx = target.x - source.x; const dy = target.y - source.y
  const distance = Math.hypot(dx, dy)
  const factor = Math.min(dx ? CARD_WIDTH / 2 / Math.abs(dx) : Infinity, dy ? CARD_HEIGHT / 2 / Math.abs(dy) : Infinity)
  const sx = source.x + CARD_WIDTH / 2 + dx * factor
  const sy = source.y + CARD_HEIGHT / 2 + dy * factor
  const tx = target.x + CARD_WIDTH / 2 - dx * factor
  const ty = target.y + CARD_HEIGHT / 2 - dy * factor
  return [sx, sy, (2 * sx + tx) / 3 - dy / distance * lane, (2 * sy + ty) / 3 + dx / distance * lane,
    (sx + 2 * tx) / 3 - dy / distance * lane, (sy + 2 * ty) / 3 + dx / distance * lane, tx, ty]
}

export const cardCenter = (point: Point): Point => ({ x: point.x + CARD_WIDTH / 2, y: point.y + CARD_HEIGHT / 2 })

/** Attach to the perimeter while the card is present; retain the saved point as a fallback. */
export function freeArrowPoints(start: ArrowEndpoint, end: ArrowEndpoint, position: (id: string) => Point | undefined): number[] {
  const source = start.cardId && position(start.cardId)
  const target = end.cardId && position(end.cardId)
  if (source && target) return relationshipPoints(source, target, 34, start.cardId === end.cardId)
  function boundary(card: Point, toward: Point) {
    const center = cardCenter(card)
    const dx = toward.x - center.x, dy = toward.y - center.y
    if (!dx && !dy) return { x: center.x, y: card.y }
    const factor = Math.min(CARD_WIDTH / 2 / Math.abs(dx), CARD_HEIGHT / 2 / Math.abs(dy))
    return { x: center.x + dx * factor, y: center.y + dy * factor }
  }
  const a = source ? boundary(source, end.point) : start.point
  const b = target ? boundary(target, start.point) : end.point
  return [a.x, a.y, b.x, b.y]
}

export function fitGraph(points: Point[], width: number, height: number, inset = 72) {
  if (!points.length || width <= 0 || height <= 0) return { x: 0, y: 0, scale: 1 }
  const left = Math.min(...points.map((point) => point.x))
  const top = Math.min(...points.map((point) => point.y))
  const right = Math.max(...points.map((point) => point.x + CARD_WIDTH))
  const bottom = Math.max(...points.map((point) => point.y + CARD_HEIGHT))
  const scale = Math.min(1.25, Math.max(0.025, Math.min((width - inset) / (right - left), (height - inset) / (bottom - top))))
  return { x: (width - (right - left) * scale) / 2 - left * scale, y: (height - (bottom - top) * scale) / 2 - top * scale, scale }
}
