'use server'

import { revalidatePath } from 'next/cache'
import { notFound, redirect, RedirectType } from 'next/navigation'
import { supportsTheme } from '@/domain/entities/entityFormRules'
import { getAssetStore, getWorldRepository } from '@/repositories'
import { isAssetReferenced } from '@/services/assets/isAssetReferenced'
import { EntityFormError, parseEntityForm } from '@/services/entities/parseEntityForm'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

/** Returned only on failure; success redirects. Errors stay on screen with what was typed. */
export type EntityFormState = { error?: string }

function formError(error: unknown): EntityFormState {
  if (error instanceof EntityFormError) return { error: error.message }
  // Repository rules (origin event, schema validation) also explain themselves in Portuguese.
  return { error: error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.' }
}

function revalidateEntityViews(typeId: string, entityId?: string) {
  revalidatePath(`/${typeId}`)
  if (entityId) revalidatePath(`/entity/${entityId}`)
  if (typeId === 'event') revalidatePath('/calendar')
  revalidatePath('/boards', 'layout')
  revalidatePath('/scenes', 'layout')
}

async function removeAssetsWhenUnused(worldId: string, assetIds: (string | undefined)[]) {
  const candidates = assetIds.filter((id): id is string => Boolean(id))
  if (candidates.length === 0) return
  const entities = await getWorldRepository().listEntities(worldId)
  for (const assetId of candidates) {
    if (!isAssetReferenced(entities, assetId)) await getAssetStore().removeAsset(worldId, assetId)
  }
}

/** Creates the record with everything filled in the single form (images, content, editors). */
export async function createEntityAction(formData: FormData): Promise<EntityFormState> {
  const world = await getCurrentWorld()
  const typeId = String(formData.get('type') ?? '')
  const entityType = world.entityTypes.find((type) => type.id === typeId)
  if (!entityType) notFound()

  let entityId: string
  try {
    const form = parseEntityForm(entityType, formData, world.calendar)
    const input = {
      type: entityType.id,
      title: form.title,
      aliases: form.aliases,
      tags: form.tags,
      ...(form.status ? { status: form.status } : {}),
      ...(supportsTheme(entityType) ? { theme: form.theme ?? 'amber' } : {}),
      ...(form.coverAssetId ? { coverAssetId: form.coverAssetId } : {}),
      properties: form.symbolAssetId ? { ...form.properties, symbolAssetId: form.symbolAssetId } : form.properties,
    }
    const repo = getWorldRepository()
    const entity = entityType.id === 'event' && formData.get('isOrigin') === 'yes'
      ? await repo.createOriginEvent(world.id, input)
      : await repo.createEntity(world.id, input)
    if (form.content) await repo.saveContent(world.id, entity.id, form.content)
    entityId = entity.id
  } catch (error) {
    return formError(error)
  }

  revalidateEntityViews(entityType.id)
  redirect(`/entity/${entityId}`, RedirectType.replace)
}

export async function updateEntityAction(entityId: string, formData: FormData): Promise<EntityFormState> {
  const world = await getCurrentWorld()
  const repo = getWorldRepository()
  const entity = await repo.getEntity(world.id, entityId)
  if (!entity) notFound()
  const entityType = world.entityTypes.find((type) => type.id === entity.type)
  if (!entityType) notFound()

  const previousSymbol = typeof entity.properties.symbolAssetId === 'string' ? entity.properties.symbolAssetId : undefined
  let replacedAssets: (string | undefined)[] = []
  try {
    const form = parseEntityForm(entityType, formData, world.calendar)
    const properties = { ...form.properties }
    // `undefined` keeps the stored symbol; `null` clears it.
    const symbol = form.symbolAssetId === undefined ? previousSymbol : form.symbolAssetId ?? undefined
    if (symbol) properties.symbolAssetId = symbol

    await repo.updateEntity(world.id, entityId, {
      title: form.title,
      aliases: form.aliases,
      tags: form.tags,
      status: form.status ?? '',
      ...(form.theme ? { theme: form.theme } : {}),
      ...(form.coverAssetId !== undefined ? { coverAssetId: form.coverAssetId } : {}),
      properties,
    })
    if (form.content) await repo.saveContent(world.id, entityId, form.content)

    replacedAssets = [
      form.coverAssetId !== undefined && form.coverAssetId !== entity.coverAssetId ? entity.coverAssetId : undefined,
      symbol !== previousSymbol ? previousSymbol : undefined,
    ]
  } catch (error) {
    return formError(error)
  }

  await removeAssetsWhenUnused(world.id, replacedAssets)
  revalidateEntityViews(entityType.id, entityId)
  redirect(`/entity/${entityId}`, RedirectType.replace)
}

export async function deleteEntityAction(entityId: string, entityTypeId: string): Promise<void> {
  const world = await getCurrentWorld()
  await getWorldRepository().deleteEntity(world.id, entityId)
  revalidatePath(`/${entityTypeId}`)
  revalidatePath('/boards', 'layout')
  revalidatePath('/scenes', 'layout')
  redirect(`/${entityTypeId}`, RedirectType.replace)
}
