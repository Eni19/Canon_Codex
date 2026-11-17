'use server'

import { GraphSettingsSchema, type GraphSettings } from '@/domain/relations/graphSettings'
import { InvalidFolderMemberError } from '@/domain/relations/graphFolders'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export async function saveGraphSettingsAction(input: GraphSettings): Promise<{ settings: GraphSettings } | { error: string }> {
  try {
    const parsed = GraphSettingsSchema.parse(input)
    const world = await getCurrentWorld()
    if (parsed.worldId !== world.id) return { error: 'O mundo ativo mudou. Reabra o grafo.' }
    return { settings: await getWorldRepository().saveGraphSettings(world.id, parsed) }
  } catch (error) {
    if (error instanceof InvalidFolderMemberError) return { error: error.message }
    return { error: error instanceof Error && error.message.includes('outra aba') ? error.message : 'Não foi possível salvar. Tente novamente.' }
  }
}
