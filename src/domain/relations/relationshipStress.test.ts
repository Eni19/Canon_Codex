import { describe, expect, it } from 'vitest'
import { createRelationshipStressFixture } from '../../../scripts/relationship-stress-fixture'
import { buildRelationshipGraph, relationshipNeighborhood } from './relationshipGraph'
import { relationshipLanes, relationshipPoints } from './graphGeometry'

describe('synthetic dense relationship graph', () => {
  it('builds indexes and geometry for 500 records and 1,500 links', () => {
    const { entities } = createRelationshipStressFixture()
    const graph = buildRelationshipGraph(entities)
    expect(graph.entities).toHaveLength(500)
    expect(graph.relations).toHaveLength(1500)
    expect(graph.incoming.get(entities[0].id)).toHaveLength(3)
    expect(graph.outgoing.get(entities[0].id)).toHaveLength(3)
    expect(relationshipNeighborhood(graph, entities[0].id, 1).size).toBe(7)
    expect(relationshipNeighborhood(graph, entities[0].id, 500).size).toBe(500)
    expect(relationshipLanes(graph.relations).size).toBe(1500)
    for (const relation of graph.relations) {
      expect(relationshipPoints({ x: 0, y: 0 }, { x: 300, y: 170 }, 0, relation.sourceId === relation.targetId).every(Number.isFinite)).toBe(true)
    }
  })
})
