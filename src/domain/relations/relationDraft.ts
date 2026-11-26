import { relationDirection, type Relation, type RelationDirection } from './relation'
import type { GraphEntity } from './relationshipGraph'

type Draft = { sourceId: string; targetId: string; type: string; direction: RelationDirection }

/**
 * Vínculo existente equivalente ao rascunho: mesmo tipo entre as mesmas pontas. Sem sentido
 * ("none") ou com ida e volta ("both"), a ordem das pontas não muda o significado.
 */
export function findEquivalentRelation(relations: Relation[], draft: Draft): Relation | undefined {
  const type = draft.type.trim().toLocaleLowerCase('pt-BR')
  if (!type || !draft.sourceId || !draft.targetId) return undefined
  return relations.find((relation) => {
    if (relation.type.trim().toLocaleLowerCase('pt-BR') !== type) return false
    if (relation.sourceId === draft.sourceId && relation.targetId === draft.targetId) return true
    const symmetric = draft.direction !== 'forward' && relationDirection(relation) !== 'forward'
    return symmetric && relation.sourceId === draft.targetId && relation.targetId === draft.sourceId
  })
}

/**
 * Tipos de vínculo em ordem de sugestão para um par de registros: primeiro os mais usados entre
 * os mesmos tipos de registro (por exemplo, personagem → facção), depois os mais usados no mundo,
 * depois os tipos do catálogo ainda sem uso.
 */
export function suggestRelationTypes(relations: Relation[], entities: GraphEntity[], catalog: string[], sourceId: string, targetId: string): string[] {
  const typeOf = new Map(entities.map((entity) => [entity.id, entity.type]))
  const sourceType = typeOf.get(sourceId), targetType = typeOf.get(targetId)
  const pair = new Map<string, number>(), overall = new Map<string, number>()
  for (const relation of relations) {
    overall.set(relation.type, (overall.get(relation.type) ?? 0) + 1)
    const a = typeOf.get(relation.sourceId), b = typeOf.get(relation.targetId)
    const sameDirection = a === sourceType && b === targetType
    const reversed = relationDirection(relation) !== 'forward' && a === targetType && b === sourceType
    if (sourceType && targetType && (sameDirection || reversed)) pair.set(relation.type, (pair.get(relation.type) ?? 0) + 1)
  }
  const order = [...new Set([...overall.keys(), ...catalog])]
  return order.sort((a, b) => (pair.get(b) ?? 0) - (pair.get(a) ?? 0) || (overall.get(b) ?? 0) - (overall.get(a) ?? 0) || a.localeCompare(b, 'pt-BR'))
}
