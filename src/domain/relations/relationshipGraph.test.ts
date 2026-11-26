import { describe, expect, it } from 'vitest'
import type { Entity } from '@/domain/entities/entity'
import type { Relation } from './relation'
import { buildRelationshipGraph, relationshipNeighborhood, relationshipNeighborhoodSlice } from './relationshipGraph'

const relation = (id: string, sourceId: string, targetId: string, directional = true): Relation => ({ id, sourceId, targetId, type: 'investiga', directional })
const entity = (id: string, relations: Relation[] = []): Entity => ({ id, worldId: 'synthetic', title: id, type: 'character', slug: id, aliases: [], tags: [], properties: {}, relations, schemaVersion: 4, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })

describe('relationship graph', () => {
  it('indexes active relations once and keeps parallel relationships distinct', () => {
    const one = relation('one', 'a', 'b')
    const two = relation('two', 'a', 'b', false)
    const graph = buildRelationshipGraph([entity('a', [one, one, two, relation('missing', 'a', 'trash')]), entity('b')])
    expect(graph.relations).toEqual([one, two])
    expect(graph.outgoing.get('a')).toEqual([one, two])
    expect(graph.incoming.get('b')).toEqual([one, two])
    expect(graph.entities).toEqual([{ id: 'a', type: 'character', title: 'a' }, { id: 'b', type: 'character', title: 'b' }])
  })

  it('preserves stored links while hiding unavailable targets, and restores them on return', () => {
    const source = entity('a', [relation('one', 'a', 'b')])
    expect(buildRelationshipGraph([source]).relations).toHaveLength(0)
    expect(source.relations).toHaveLength(1)
    expect(buildRelationshipGraph([source, entity('b')]).relations).toHaveLength(1)
  })

  it('expands incoming and outgoing links without looping', () => {
    const graph = buildRelationshipGraph([entity('a', [relation('1', 'a', 'b')]), entity('b', [relation('2', 'b', 'c')]), entity('c', [relation('3', 'c', 'a')]), entity('d')])
    expect([...relationshipNeighborhood(graph, 'b', 0)]).toEqual(['b'])
    expect(relationshipNeighborhood(graph, 'b', 1)).toEqual(new Set(['a', 'b', 'c']))
    expect(relationshipNeighborhood(graph, 'b', 5)).toEqual(new Set(['a', 'b', 'c']))
    expect(relationshipNeighborhood(graph, 'absent', 1).size).toBe(0)
  })

  it('excludes reverse arrows even when both cards are visible and keeps undirected links in either mode', () => {
    const graph = buildRelationshipGraph([
      entity('a', [relation('out', 'a', 'b'), relation('loop', 'a', 'a')]),
      entity('b', [relation('in', 'b', 'a'), relation('step', 'b', 'd')]),
      entity('c', [relation('neutral', 'c', 'a', false)]), entity('d'),
    ])
    expect(relationshipNeighborhoodSlice(graph, 'a', 1, 'outgoing').relationIds).toEqual(new Set(['out', 'loop', 'neutral']))
    expect(relationshipNeighborhoodSlice(graph, 'a', 1, 'incoming').relationIds).toEqual(new Set(['in', 'loop', 'neutral']))
    expect(relationshipNeighborhoodSlice(graph, 'a', 1, 'both').relationIds).toEqual(new Set(['out', 'in', 'loop', 'neutral']))
    expect(relationshipNeighborhoodSlice(graph, 'a', 2, 'outgoing').entityIds).toContain('d')
    expect(relationshipNeighborhoodSlice(graph, 'a', 2, 'incoming').entityIds).not.toContain('d')
  })

  it('includes a two-way relation from either card in both one-way filters', () => {
    const graph = buildRelationshipGraph([entity('a', [{ ...relation('two-way', 'a', 'b'), bidirectional: true }]), entity('b')])
    for (const card of ['a', 'b']) for (const direction of ['incoming', 'outgoing'] as const) {
      expect([...relationshipNeighborhoodSlice(graph, card, 1, direction).relationIds]).toEqual(['two-way'])
    }
  })
})
