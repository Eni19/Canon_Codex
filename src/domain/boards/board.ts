import { z } from 'zod'

export const BOARD_SCHEMA_VERSION = 1

export const BoardDocumentSchema = z.object({
  schemaVersion: z.number().int(),
  id: z.uuid(),
  worldId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()),
  canvasSnapshot: z.unknown().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type BoardDocument = z.infer<typeof BoardDocumentSchema>
export type BoardSummary = Omit<BoardDocument, 'canvasSnapshot'>

export const CreateBoardInputSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  tags: z.array(z.string()).default([]),
})
export type CreateBoardInput = z.input<typeof CreateBoardInputSchema>
