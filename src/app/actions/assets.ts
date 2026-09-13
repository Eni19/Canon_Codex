'use server'

import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { isSupportedImageMimeType } from '@/domain/assets/mimeType'
import { getAssetStore, getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'
import { isAssetReferenced } from '@/services/assets/isAssetReferenced'

export async function importCoverImageAction(entityId: string, formData: FormData): Promise<void> {
  const world = await getCurrentWorld()
  const repo = getWorldRepository()
  const entity = await repo.getEntity(world.id, entityId)
  if (!entity) notFound()

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return
  if (!isSupportedImageMimeType(file.type)) {
    throw new Error(`Tipo de imagem não suportado: ${file.type}`)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const assetStore = getAssetStore()
  const asset = await assetStore.importFromBuffer(world.id, buffer, file.name, file.type)

  try {
    await repo.updateEntity(world.id, entityId, { coverAssetId: asset.id })
  } catch (error) {
    await assetStore.removeAsset(world.id, asset.id)
    throw error
  }

  if (entity.coverAssetId && entity.coverAssetId !== asset.id) {
    const entities = await repo.listEntities(world.id)
    if (!isAssetReferenced(entities, entity.coverAssetId)) {
      await assetStore.removeAsset(world.id, entity.coverAssetId)
    }
  }

  revalidatePath(`/entity/${entityId}`)
  revalidatePath(`/entity/${entityId}/edit`)
}

export async function importCosmologySymbolAction(entityId: string, formData: FormData): Promise<void> {
  const world = await getCurrentWorld()
  const repo = getWorldRepository()
  const entity = await repo.getEntity(world.id, entityId)
  if (!entity || entity.type !== 'cosmology') notFound()

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return
  if (!isSupportedImageMimeType(file.type)) {
    throw new Error('Tipo de imagem não suportado: ' + file.type)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const assetStore = getAssetStore()
  const asset = await assetStore.importFromBuffer(world.id, buffer, file.name, file.type)
  const previousAssetId = typeof entity.properties.symbolAssetId === 'string' ? entity.properties.symbolAssetId : undefined

  try {
    await repo.updateEntity(world.id, entityId, { properties: { ...entity.properties, symbolAssetId: asset.id } })
  } catch (error) {
    await assetStore.removeAsset(world.id, asset.id)
    throw error
  }

  if (previousAssetId && previousAssetId !== asset.id) {
    const entities = await repo.listEntities(world.id)
    if (!isAssetReferenced(entities, previousAssetId)) await assetStore.removeAsset(world.id, previousAssetId)
  }

  revalidatePath('/entity/' + entityId)
  revalidatePath('/entity/' + entityId + '/edit')
}
async function removeAssetWhenUnused(worldId: string, assetId: string) {
  const entities = await getWorldRepository().listEntities(worldId)
  if (!isAssetReferenced(entities, assetId)) await getAssetStore().removeAsset(worldId, assetId)
}

export async function removeCoverImageAction(entityId: string): Promise<void> {
  const world = await getCurrentWorld()
  const repo = getWorldRepository()
  const entity = await repo.getEntity(world.id, entityId)
  if (!entity) notFound()
  if (!entity.coverAssetId) return

  const previousAssetId = entity.coverAssetId
  await repo.updateEntity(world.id, entityId, { coverAssetId: null })
  await removeAssetWhenUnused(world.id, previousAssetId)
  revalidatePath('/' + entity.type)
  revalidatePath('/entity/' + entityId)
  revalidatePath('/entity/' + entityId + '/edit')
}
