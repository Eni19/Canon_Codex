import { z } from 'zod'
import { GraphStylesSchema } from './graphStyles'
import { GraphFoldersSchema } from './graphFolders'

const Coordinate = z.number().finite().min(-1000000).max(1000000)
export const GraphPositionsSchema = z.record(z.uuid(), z.object({ x: Coordinate, y: Coordinate }).strict())
export const GraphPreferencesSchema = z.object({ type: z.string().max(200), relationType: z.string().max(200) }).strict()
export const FreeArrowSchema = z.object({
  id: z.uuid(),
  start: z.object({ x: Coordinate, y: Coordinate }).strict(),
  end: z.object({ x: Coordinate, y: Coordinate }).strict(),
  startCardId: z.uuid().optional(),
  endCardId: z.uuid().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  stroke: z.enum(['solid', 'dashed', 'dotted']),
}).strict()
export type FreeArrow = z.infer<typeof FreeArrowSchema>
export const GraphSettingsSchema = z.object({
  schemaVersion: z.literal(4),
  worldId: z.uuid(),
  revision: z.number().int().nonnegative(),
  positions: GraphPositionsSchema,
  preferences: GraphPreferencesSchema,
  styles: GraphStylesSchema,
  folders: GraphFoldersSchema,
  annotations: z.array(FreeArrowSchema).max(1000).superRefine((arrows, context) => {
    const ids = new Set<string>()
    arrows.forEach((arrow, index) => { if (ids.has(arrow.id)) context.addIssue({ code: 'custom', path: [index, 'id'], message: 'Anotação repetida.' }); ids.add(arrow.id) })
  }),
}).strict()
export type GraphSettings = z.infer<typeof GraphSettingsSchema>
const Version3GraphSettingsSchema = GraphSettingsSchema.omit({ folders: true }).extend({ schemaVersion: z.literal(3) })
const Version2GraphSettingsSchema = Version3GraphSettingsSchema.omit({ annotations: true }).extend({ schemaVersion: z.literal(2) })
const LegacyGraphSettingsSchema = Version2GraphSettingsSchema.omit({ styles: true }).extend({ schemaVersion: z.literal(1) })
export function parseGraphSettings(input: unknown): GraphSettings {
  const legacy = LegacyGraphSettingsSchema.safeParse(input)
  if (legacy.success) return { ...legacy.data, schemaVersion: 4, styles: [], annotations: [], folders: [] }
  const version2 = Version2GraphSettingsSchema.safeParse(input)
  if (version2.success) return { ...version2.data, schemaVersion: 4, annotations: [], folders: [] }
  const version3 = Version3GraphSettingsSchema.safeParse(input)
  return version3.success ? { ...version3.data, schemaVersion: 4, folders: [] } : GraphSettingsSchema.parse(input)
}
export const emptyGraphSettings = (worldId: string): GraphSettings => ({ schemaVersion: 4, worldId, revision: 0, positions: {}, preferences: { type: '', relationType: '' }, styles: [], annotations: [], folders: [] })
