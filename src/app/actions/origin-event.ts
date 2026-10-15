'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export async function replaceOriginEventAction(formData: FormData): Promise<void> {
  const world = await getCurrentWorld()
  const worldId = formData.get('worldId')
  const eventId = formData.get('eventId')
  const fingerprint = formData.get('fingerprint')
  if (worldId !== world.id || typeof eventId !== 'string' || typeof fingerprint !== 'string' || formData.get('confirm') !== 'yes') {
    throw new Error('Confirme a prévia da origem neste mundo.')
  }
  await getWorldRepository().replaceOriginEvent(world.id, eventId, fingerprint)
  revalidatePath('/calendar')
  revalidatePath('/', 'layout')
  redirect('/calendar/origin?updated=yes')
}
