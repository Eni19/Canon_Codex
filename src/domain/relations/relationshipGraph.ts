import type { Entity } from '@/domain/entities/entity'
import type { Relation } from './relation'

export type GraphEntity = Pick<Entity, 'id' | 'type' | 'title'>
export type RelationshipGraph = {
  entities: GraphEntity[]
  relations: Relation[]
  incoming: Map<string, Relation[]>
  outgoing: Map<string, Relation[]>
}

/** Build from active entities only. Backlinks are derived and must not be added as edges. */
export function buildRelationshipGraph(entities: Entity[]): RelationshipGraph {
  const nodes = entities.map(({ id, type, title }) => ({ id, type, title }))
  const ids = new Set(nodes.map((entity) => entity.id))
  const incoming = new Map(nodes.map((entity) => [entity.id, [] as Relation[]]))
  const outgoing = new Map(nodes.map((entity) => [entity.id, [] as Relation[]]))
  const relations: Relation[] = []
  const seen = new Set<string>()

  for (const entity of entities) {
    for (const relation of entity.relations) {
      if (seen.has(relation.id) || relation.sourceId !== entity.id || !ids.has(relation.targetId)) continue
      seen.add(relation.id)
      relations.push(relation)
      outgoing.get(relation.sourceId)?.push(relation)
      incoming.get(relation.targetId)?.push(relation)
    }
  }
  return { entities: nodes, relations, incoming, outgoing }
}

/** Follow either end of a relation when exploring a record's neighborhood. */
export function relationshipNeighborhood(graph: RelationshipGraph, entityId: string, depth: number): Set<string> {
  const visited = new Set<string>()
  if (!graph.incoming.has(entityId)) return visited
  visited.add(entityId)
  let frontier = [entityId]
  for (let step = 0; step < Math.max(0, Math.floor(depth)); step++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const relation of [...(graph.incoming.get(id) ?? []), ...(graph.outgoing.get(id) ?? [])]) {
        const neighbor = relation.sourceId === id ? relation.targetId : relation.sourceId
        if (!visited.has(neighbor)) { visited.add(neighbor); next.push(neighbor) }
      }
    }
    frontier = next
    if (!frontier.length) break
  }
  return visited
}
