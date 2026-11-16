import { z } from 'zod'
import { GraphStylesSchema } from './graphStyles'

const Coordinate = z.number().finite().min(-1000000).max(1000000)
export const GraphPositionsSchema = z.record(z.uuid(), z.object({ x: Coordinate, y: Coordinate }).strict())
export const GraphPreferencesSchema = z.object({ type: z.string().max(200), relationType: z.string().max(200) }).strict()
export const FreeArrowSchema = z.object({ id: z.uuid(), start: z.object({ x: Coordinate, y: Coordinate }).strict(), end: z.object({ x: Coordinate, y: Coordinate }).strict(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), stroke: z.enum(['solid', 'dashed', 'dotted']) }).strict()
export type FreeArrow = z.infer<typeof FreeArrowSchema>
export const GraphSettingsSchema = z.object({
  schemaVersion: z.literal(3),
  worldId: z.uuid(),
  revision: z.number().int().nonnegative(),
  positions: GraphPositionsSchema,
  preferences: GraphPreferencesSchema,
  styles: GraphStylesSchema,
  annotations: z.array(FreeArrowSchema).max(1000).superRefine((arrows, context) => {
    const ids = new Set<string>()
    arrows.forEach((arrow, index) => { if (ids.has(arrow.id)) context.addIssue({ code: 'custom', path: [index, 'id'], message: 'Anotação repetida.' }); ids.add(arrow.id) })
  }),
}).strict()
export type GraphSettings = z.infer<typeof GraphSettingsSchema>
const LegacyGraphSettingsSchema = GraphSettingsSchema.omit({ styles: true, annotations: true, schemaVersion: true }).extend({ schemaVersion: z.literal(1) }).strict()
const Version2GraphSettingsSchema = GraphSettingsSchema.omit({ annotations: true, schemaVersion: true }).extend({ schemaVersion: z.literal(2) }).strict()
export function parseGraphSettings(input: unknown): GraphSettings {
  const legacy = LegacyGraphSettingsSchema.safeParse(input)
  if (legacy.success) return { ...legacy.data, schemaVersion: 3, styles: [], annotations: [] }
  const version2 = Version2GraphSettingsSchema.safeParse(input)
  return version2.success ? { ...version2.data, schemaVersion: 3, annotations: [] } : GraphSettingsSchema.parse(input)
}
export const emptyGraphSettings = (worldId: string): GraphSettings => ({ schemaVersion: 3, worldId, revision: 0, positions: {}, preferences: { type: '', relationType: '' }, styles: [], annotations: [] })
