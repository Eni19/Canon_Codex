import type { EntityTypeDefinition } from '@/domain/entities/entityType'

/**
 * Mundo v25: o tipo `artifact` passa a se chamar "Objeto" / "Objetos". Só os nomes que ainda são o
 * padrão antigo mudam; um nome personalizado pelo usuário fica como está. O ID do tipo continua
 * `artifact`, então registros, links e rotas não mudam.
 */
export const LEGACY_OBJECT_LABELS = { label: 'Objeto / Artefato', pluralLabel: 'Objetos / Artefatos' } as const
export const OBJECT_LABELS = { label: 'Objeto', pluralLabel: 'Objetos' } as const

export function renameObjectType(type: EntityTypeDefinition): EntityTypeDefinition {
  if (type.id !== 'artifact') return type
  return {
    ...type,
    label: type.label === LEGACY_OBJECT_LABELS.label ? OBJECT_LABELS.label : type.label,
    pluralLabel: type.pluralLabel === LEGACY_OBJECT_LABELS.pluralLabel ? OBJECT_LABELS.pluralLabel : type.pluralLabel,
  }
}
