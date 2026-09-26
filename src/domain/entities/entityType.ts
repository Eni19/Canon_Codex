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

export const EntityTypeDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  pluralLabel: z.string().min(1),
  icon: z.string().min(1),
  color: z.string().optional(),
  properties: z.array(PropertyDefinitionSchema),
  layout: z.array(PageBlockIdSchema),
  showInSidebar: z.boolean(),
})
export type EntityTypeDefinition = z.infer<typeof EntityTypeDefinitionSchema>
