import { z } from 'zod'

export const PropertyKindSchema = z.enum([
  'text',
  'textarea',
  'number',
  'date',
  'boolean',
  'enum',
  'tags',
  'reference',
  'referenceList',
  'image',
  'gallery',
])
export type PropertyKind = z.infer<typeof PropertyKindSchema>

export const PropertyDefinitionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  kind: PropertyKindSchema,
  refType: z.string().optional(),
  options: z.array(z.string()).optional(),
  /** For referenceList: offer only items currently selected in the sibling property with this key. */
  optionsFrom: z.string().optional(),
})
export type PropertyDefinition = z.infer<typeof PropertyDefinitionSchema>

export const PageBlockIdSchema = z.enum([
  'header',
  'hero',
  'portraitHero',
  'properties',
  'content',
  'gallery',
  'relations',
  'backlinks',
])
export type PageBlockId = z.infer<typeof PageBlockIdSchema>

/**
 * Default icons that have since changed for built-in types. A world keeps its types' icons in its
 * own data, so one created earlier still says the old default; it is read as the new one (and saved
 * so on the next write). An icon other than the old default was chosen on purpose and is kept.
 */
export const RETIRED_DEFAULT_ICONS: Readonly<Record<string, { from: string; to: string }>> = {
  artifact: { from: 'Gem', to: 'KeyRound' },
  cosmology: { from: 'Orbit', to: 'Eclipse' },
}

export function withCurrentDefaultIcon<T extends { id: string; icon: string }>(type: T): T {
  const change = RETIRED_DEFAULT_ICONS[type.id]
  return change && type.icon === change.from ? { ...type, icon: change.to } : type
}

export const EntityTypeDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  pluralLabel: z.string().min(1),
  icon: z.string().min(1),
  color: z.string().optional(),
  properties: z.array(PropertyDefinitionSchema),
  layout: z.array(PageBlockIdSchema),
  showInSidebar: z.boolean(),
}).transform(withCurrentDefaultIcon)
export type EntityTypeDefinition = z.infer<typeof EntityTypeDefinitionSchema>
