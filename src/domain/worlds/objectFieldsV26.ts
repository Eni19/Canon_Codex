import type { EntityTypeDefinition } from '@/domain/entities/entityType'

/**
 * Mundo v26: a ficha de Objeto deixa de pedir número de registro e materiais. Só as definições
 * saem do tipo `artifact`; valores já preenchidos continuam guardados nos registros.
 */
export const REMOVED_OBJECT_FIELDS = ['registrationNumber', 'materials'] as const

export function removeObjectFields(type: EntityTypeDefinition): EntityTypeDefinition {
  if (type.id !== 'artifact') return type
  return { ...type, properties: type.properties.filter((property) => !(REMOVED_OBJECT_FIELDS as readonly string[]).includes(property.key)) }
}
