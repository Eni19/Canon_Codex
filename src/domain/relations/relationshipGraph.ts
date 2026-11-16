import type { Entity } from '@/domain/entities/entity'
import { relationDirection, type Relation } from './relation'

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

export type NeighborhoodDirection = 'outgoing' | 'incoming' | 'both'

/** Select the records and links reached from the focus in the chosen direction. */
export function relationshipNeighborhoodSlice(graph: RelationshipGraph, entityId: string, depth: number, direction: NeighborhoodDirection) {
  const entityIds = new Set<string>()
  const relationIds = new Set<string>()
  if (!graph.incoming.has(entityId)) return { entityIds, relationIds }
  entityIds.add(entityId)
  let frontier = [entityId]
  for (let step = 0; step < Math.max(0, Math.floor(depth)); step++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const relation of [...(graph.incoming.get(id) ?? []), ...(graph.outgoing.get(id) ?? [])]) {
        if (relationDirection(relation) === 'forward' && direction === 'outgoing' && relation.sourceId !== id) continue
        if (relationDirection(relation) === 'forward' && direction === 'incoming' && relation.targetId !== id) continue
        relationIds.add(relation.id)
        const neighbor = relation.sourceId === id ? relation.targetId : relation.sourceId
        if (!entityIds.has(neighbor)) { entityIds.add(neighbor); next.push(neighbor) }
      }
    }
    frontier = next
    if (!frontier.length) break
  }
  return { entityIds, relationIds }
}

export function relationshipNeighborhood(graph: RelationshipGraph, entityId: string, depth: number): Set<string> {
  return relationshipNeighborhoodSlice(graph, entityId, depth, 'both').entityIds
}
