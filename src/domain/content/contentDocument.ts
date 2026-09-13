import { z } from 'zod'

export const CONTENT_SCHEMA_VERSION = 2

export const ContentPageSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(40),
  body: z.unknown(),
})
export type ContentPage = z.infer<typeof ContentPageSchema>

/**
 * `body` is the raw Tiptap `JSONContent` tree. The domain layer treats it as opaque —
 * only the editor layer (src/components/editor) knows its shape. See ADR-004.
 */
export const ContentDocumentSchema = z.object({
  format: z.literal('tiptap-json'),
  schemaVersion: z.number().int(),
  pages: ContentPageSchema.array().min(1).max(50),
})
export type ContentDocument = z.infer<typeof ContentDocumentSchema>

export function emptyContentDocument(): ContentDocument {
  return {
    format: 'tiptap-json',
    schemaVersion: CONTENT_SCHEMA_VERSION,
    pages: [{ id: 'principal', title: 'Principal', body: { type: 'doc', content: [{ type: 'paragraph' }] } }],
  }
}
