import type { EntityTypeDefinition, PropertyDefinition } from '@/domain/entities/entityType'

const additions: Partial<Record<string, PropertyDefinition>> = {
  character: { key: 'currentGoal', label: 'Objetivo atual', kind: 'text' },
  case: { key: 'centralQuestion', label: 'Pergunta central', kind: 'text' },
  clue: { key: 'associatedEvidence', label: 'Evidências associadas', kind: 'referenceList', refType: 'evidence' },
  creature: { key: 'typicalBehavior', label: 'Comportamento típico', kind: 'text' },
  event: { key: 'consequences', label: 'Consequências', kind: 'text' },
  phenomenon: { key: 'manifestationConditions', label: 'Condições de manifestação', kind: 'text' },
  artifact: { key: 'knownEffect', label: 'Efeito conhecido', kind: 'text' },
}

export function addWorldV24Fields(type: EntityTypeDefinition): EntityTypeDefinition {
  const field = additions[type.id]
  if (!field || type.properties.some((property) => property.key === field.key)) return type
  return { ...type, properties: [...type.properties, field] }
}
