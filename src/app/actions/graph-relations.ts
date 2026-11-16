'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { NewRelationInputSchema, RelationSchema, type Relation } from '@/domain/relations/relation'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

const CreateSchema = z.object({ worldId: z.uuid(), requestId: z.uuid(), relation: NewRelationInputSchema.strict() }).strict()
const ChangeSchema = RelationSchema.pick({ type: true, label: true, directional: true }).strict()
const EditSchema = z.object({ worldId: z.uuid(), expected: RelationSchema, changes: ChangeSchema }).strict()
const RemoveSchema = z.object({ worldId: z.uuid(), expected: RelationSchema }).strict()
type Result = { relation: Relation } | { error: string }

function message(error: unknown) {
  if (error instanceof Error && (error.message.includes('outra aba') || error.message.includes('não está mais disponível') || error.message.includes('já foi usada'))) return error.message
  return 'Não foi possível salvar a relação. Verifique se os registros continuam disponíveis e tente novamente.'
}
function refresh(relation: Relation) {
  revalidatePath('/relationships')
  revalidatePath(`/entity/${relation.sourceId}`)
  revalidatePath(`/entity/${relation.targetId}`)
}

export async function createGraphRelationAction(input: z.infer<typeof CreateSchema>): Promise<Result> {
  try {
    const parsed = CreateSchema.parse(input); const world = await getCurrentWorld()
    if (world.id !== parsed.worldId) return { error: 'O mundo ativo mudou. Reabra o grafo.' }
    const relation = await getWorldRepository().addRelation(world.id, parsed.relation.sourceId, parsed.relation, parsed.requestId)
    refresh(relation); return { relation }
  } catch (error) { return { error: message(error) } }
}

export async function editGraphRelationAction(input: z.infer<typeof EditSchema>): Promise<Result> {
  try {
    const parsed = EditSchema.parse(input); const world = await getCurrentWorld()
    if (world.id !== parsed.worldId) return { error: 'O mundo ativo mudou. Reabra o grafo.' }
    const relation = await getWorldRepository().updateRelation(world.id, parsed.expected, parsed.changes)
    refresh(relation); return { relation }
  } catch (error) { return { error: message(error) } }
}

export async function removeGraphRelationAction(input: z.infer<typeof RemoveSchema>): Promise<{ ok: true } | { error: string }> {
  try {
    const parsed = RemoveSchema.parse(input); const world = await getCurrentWorld()
    if (world.id !== parsed.worldId) return { error: 'O mundo ativo mudou. Reabra o grafo.' }
    await getWorldRepository().removeRelation(world.id, parsed.expected.sourceId, parsed.expected.id, parsed.expected)
    refresh(parsed.expected); return { ok: true }
  } catch (error) { return { error: message(error) } }
}
