import { z } from 'zod'

export const ConceptBlockTypeSchema = z.enum([
  'overview',
  'operation',
  'structure',
  'rules',
  'examples',
  'limitations',
  'terminology',
  'diagram',
  'notes',
])
export type ConceptBlockType = z.infer<typeof ConceptBlockTypeSchema>

export const ConceptBlockSchema = z.object({
  id: z.string().min(1),
  type: ConceptBlockTypeSchema,
  title: z.string().max(100).default(''),
  body: z.string().max(8000).default(''),
})

export const ConceptBlocksSchema = z.array(ConceptBlockSchema).max(40)
export type ConceptBlock = z.infer<typeof ConceptBlockSchema>
