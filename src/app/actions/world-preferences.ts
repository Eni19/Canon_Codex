'use server'

import { revalidatePath } from 'next/cache'
import { WorldPreferencesSchema, type WorldPreferences } from '@/domain/worlds/worldPreferences'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export type WorldPreferencesResult = { ok: true; preferences: WorldPreferences } | { ok: false; error: string }

/**
 * Grava as preferências do Codex ativo (o que aparece na barra lateral e quais páginas usam a
 * interface interativa). Recusa se o mundo ativo mudou desde que a janela foi aberta.
 */
export async function updateWorldPreferencesAction(worldId: string, input: WorldPreferences): Promise<WorldPreferencesResult> {
  const parsed = WorldPreferencesSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Preferências inválidas.' }
  try {
    const world = await getCurrentWorld()
    if (world.id !== worldId) return { ok: false, error: 'O Codex ativo mudou. Reabra as configurações.' }
    const updated = await getWorldRepository().updateWorldPreferences(world.id, parsed.data)
    revalidatePath('/', 'layout')
    return { ok: true, preferences: updated.preferences }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Não foi possível salvar as configurações.' }
  }
}
