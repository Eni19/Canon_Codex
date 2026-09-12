'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getWorldRepository } from '@/repositories'
import { createWorld, deleteWorld, importWorldsFromFolder, renameWorld, WorldImportError } from '@/services/worlds/worldLibrary'

const ACTIVE_WORLD_COOKIE = 'canon-codex-world'

async function selectWorld(worldId: string) {
  const worlds = await getWorldRepository().listWorlds()
  if (!worlds.some((world) => world.id === worldId)) throw new Error('Codex não encontrado.')
  const store = await cookies()
  store.set(ACTIVE_WORLD_COOKIE, worldId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 })
}

export async function openWorldAction(formData: FormData): Promise<void> {
  await selectWorld(String(formData.get('worldId') ?? ''))
  redirect('/codex')
}

export type WorldLibraryActionState = { error?: string }

export async function createWorldAction(_: WorldLibraryActionState, formData: FormData): Promise<WorldLibraryActionState> {
  try {
    const world = await createWorld(String(formData.get('name') ?? ''), String(formData.get('description') ?? ''))
    await selectWorld(world.id)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível criar o Codex.' }
  }
  redirect('/codex')
}

export async function importWorldAction(_: WorldLibraryActionState, formData: FormData): Promise<WorldLibraryActionState> {
  try {
    const imported = await importWorldsFromFolder(String(formData.get('folderPath') ?? ''))
    await selectWorld(imported[0].id)
  } catch (error) {
    return { error: error instanceof WorldImportError || error instanceof Error ? error.message : 'Não foi possível carregar a pasta.' }
  }
  redirect('/codex')
}

export async function manageWorldAction(_: WorldLibraryActionState, formData: FormData): Promise<WorldLibraryActionState> {
  const worldId = String(formData.get('worldId') ?? '')
  const intent = String(formData.get('intent') ?? '')
  try {
    if (intent === 'rename') {
      await renameWorld(worldId, String(formData.get('name') ?? ''))
    } else if (intent === 'delete') {
      const nextWorld = await deleteWorld(worldId)
      const store = await cookies()
      if (store.get(ACTIVE_WORLD_COOKIE)?.value === worldId) {
        if (nextWorld) store.set(ACTIVE_WORLD_COOKIE, nextWorld.id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 })
        else store.delete(ACTIVE_WORLD_COOKIE)
      }
    } else {
      throw new Error('Ação inválida.')
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível alterar o Codex.' }
  }
  redirect('/')
}
