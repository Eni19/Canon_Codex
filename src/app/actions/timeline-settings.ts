'use server'

import { revalidatePath } from 'next/cache'
import { TimelineScaleSchema } from '@/domain/timelines/timelineScale'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export type TimelineSettingsState = { saved?: boolean; error?: string }

export async function updateTimelineScaleDefaultsAction(_: TimelineSettingsState, formData: FormData): Promise<TimelineSettingsState> {
  try {
    const world = await getCurrentWorld()
    if (formData.get('worldId') !== world.id) return { error: 'O mundo ativo mudou. Reabra a linha.' }
    const defaults = Object.fromEntries(world.entityTypes.map((type) => [type.id, TimelineScaleSchema.parse(formData.get(`scale:${type.id}`))]))
    await getWorldRepository().updateTimelineScaleDefaults(world.id, defaults)
    revalidatePath('/', 'layout')
    return { saved: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível salvar as escalas.' }
  }
}
