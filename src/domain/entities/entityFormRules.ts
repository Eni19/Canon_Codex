import type { EntityTypeDefinition } from '@/domain/entities/entityType'

/**
 * Per-type rules of the entity form, shared by the create/edit UI and the server actions so both
 * sides agree on which fields exist. Before this module the conditions were repeated inline.
 */
type TypeRef = Pick<EntityTypeDefinition, 'id' | 'layout'>

const THEMED_TYPES = new Set(['location', 'creature', 'cosmology', 'tale'])
const THEME_LABELS: Record<string, string> = {
  location: 'Cor do local',
  creature: 'Cor da criatura',
  cosmology: 'Paleta da entidade',
  tale: 'Cor editorial',
}

export function supportsTheme(type: TypeRef): boolean {
  return type.layout.includes('portraitHero') || THEMED_TYPES.has(type.id)
}

export function themeLabel(type: TypeRef): string {
  return THEME_LABELS[type.id] ?? 'Cor do personagem'
}

export function supportsCover(type: TypeRef): boolean {
  return type.id !== 'concept'
}

export function coverLabel(type: TypeRef): string {
  if (type.id === 'tale') return 'Imagem de capa'
  if (type.id === 'cosmology') return 'Arte principal'
  return 'Imagem principal'
}

/** Portrait pages (characters) and creatures let the person reposition and zoom the cover. */
export function supportsCoverFraming(type: TypeRef): boolean {
  return type.layout.includes('portraitHero') || type.id === 'creature'
}

export function supportsSymbol(type: TypeRef): boolean {
  return type.id === 'cosmology'
}

export function supportsAliases(type: TypeRef): boolean {
  return type.id !== 'evidence'
}

export function supportsStatus(type: TypeRef): boolean {
  return type.id !== 'evidence'
}

export function contentRules(type: TypeRef): { label: string; maxPages: number; pageNoun: 'página' | 'capítulo' } {
  if (type.id === 'tale') return { label: 'Capítulos', maxPages: 50, pageNoun: 'capítulo' }
  if (type.id === 'concept') return { label: 'Texto base', maxPages: 1, pageNoun: 'página' }
  return { label: 'Conteúdo', maxPages: 5, pageNoun: 'página' }
}
