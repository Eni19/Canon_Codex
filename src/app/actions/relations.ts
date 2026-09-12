'use server'

import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export async function addRelationAction(entityId: string, formData: FormData): Promise<void> {
  const world = await getCurrentWorld()
  const repo = getWorldRepository()
  const entity = await repo.getEntity(world.id, entityId)
  if (!entity) notFound()

  const targetId = String(formData.get('targetId') ?? '')
  const type = String(formData.get('type') ?? '').trim()
  const label = String(formData.get('label') ?? '').trim()
  if (!targetId || !type) return

  await repo.addRelation(world.id, entityId, {
    sourceId: entityId,
    targetId,
    type,
    label: label || undefined,
    directional: formData.get('directional') === 'on',
  })

  revalidatePath(`/entity/${entityId}`)
  revalidatePath(`/entity/${targetId}`)
}

export async function removeRelationAction(entityId: string, relationId: string): Promise<void> {
  const world = await getCurrentWorld()
  await getWorldRepository().removeRelation(world.id, entityId, relationId)
  revalidatePath(`/entity/${entityId}`)
}
