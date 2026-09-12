'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAssetStore, getSceneRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

const tags = (v: FormDataEntryValue | null) => typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : []
export async function createSceneAction(formData: FormData) {
  const world = await getCurrentWorld(), assetId = String(formData.get('assetId') ?? '')
  const asset = await getAssetStore().getAsset(world.id, assetId)
  if (!asset?.width || !asset.height) throw new Error('A imagem escolhida não possui dimensões válidas')
  const scene = await getSceneRepository().createScene(world.id, { title: String(formData.get('title') ?? ''), description: String(formData.get('description') ?? ''), tags: tags(formData.get('tags')), locationId: String(formData.get('locationId') ?? ''), assetId, width: asset.width, height: asset.height })
  revalidatePath('/scenes'); redirect(`/scenes/${scene.id}`)
}
export async function duplicateSceneAction(sceneId: string) { const world = await getCurrentWorld(); const copy = await getSceneRepository().duplicateScene(world.id, sceneId); revalidatePath('/scenes'); redirect(`/scenes/${copy.id}`) }
export async function deleteSceneAction(sceneId: string) { const world = await getCurrentWorld(); await getSceneRepository().deleteScene(world.id, sceneId); revalidatePath('/scenes') }
