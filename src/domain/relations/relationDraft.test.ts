import { describe, expect, it } from 'vitest'
import type { Relation } from './relation'
import { findEquivalentRelation, suggestRelationTypes } from './relationDraft'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const rel = (n: number, sourceId: string, targetId: string, type: string, directional = true, bidirectional = false): Relation =>
  ({ id: id(100 + n), sourceId, targetId, type, directional, bidirectional })
const [ana, bia, guilda, porto] = [id(1), id(2), id(3), id(4)]
const entities = [
  { id: ana, type: 'character', title: 'Ana' }, { id: bia, type: 'character', title: 'Bia' },
  { id: guilda, type: 'organization', title: 'Guilda' }, { id: porto, type: 'location', title: 'Porto' },
]

describe('findEquivalentRelation', () => {
  const relations = [rel(1, ana, guilda, 'membro de'), rel(2, ana, bia, 'aliada de', false)]
  it('acha o mesmo tipo entre as mesmas pontas, ignorando maiúsculas e espaços', () => {
    expect(findEquivalentRelation(relations, { sourceId: ana, targetId: guilda, type: ' Membro de ', direction: 'forward' })?.id).toBe(id(101))
  })
  it('não trata o sentido inverso de um vínculo com seta como duplicado', () => {
    expect(findEquivalentRelation(relations, { sourceId: guilda, targetId: ana, type: 'membro de', direction: 'forward' })).toBeUndefined()
  })
  it('trata pontas trocadas como duplicado quando os dois vínculos não têm sentido único', () => {
    expect(findEquivalentRelation(relations, { sourceId: bia, targetId: ana, type: 'aliada de', direction: 'none' })?.id).toBe(id(102))
    expect(findEquivalentRelation(relations, { sourceId: bia, targetId: ana, type: 'aliada de', direction: 'forward' })).toBeUndefined()
  })
  it('ignora rascunhos incompletos', () => {
    expect(findEquivalentRelation(relations, { sourceId: ana, targetId: '', type: 'membro de', direction: 'forward' })).toBeUndefined()
  })
})

describe('suggestRelationTypes', () => {
  const relations = [
    rel(1, ana, guilda, 'membro de'), rel(2, bia, guilda, 'membro de'), rel(3, ana, porto, 'vive em'),
    rel(4, ana, bia, 'rival de'), rel(5, bia, ana, 'rival de'), rel(6, bia, porto, 'vive em'), rel(7, ana, porto, 'nasceu em'),
  ]
  it('prioriza os tipos usados entre os mesmos tipos de registro', () => {
    expect(suggestRelationTypes(relations, entities, [], ana, guilda)[0]).toBe('membro de')
    expect(suggestRelationTypes(relations, entities, [], bia, porto).slice(0, 2)).toEqual(['vive em', 'nasceu em'])
  })
  it('inclui tipos do catálogo sem uso ao final', () => {
    expect(suggestRelationTypes(relations, entities, ['governa'], ana, guilda).at(-1)).toBe('governa')
  })
  it('considera vínculos sem sentido único nos dois sentidos do par', () => {
    const symmetric = [rel(1, guilda, ana, 'apoia', false)]
    expect(suggestRelationTypes(symmetric, entities, ['outro'], ana, guilda)[0]).toBe('apoia')
  })
})
