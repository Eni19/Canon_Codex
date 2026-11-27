'use server'

import { revalidatePath } from 'next/cache'
import { TrashItemKindSchema, type TrashItemKind } from '@/domain/trash/trash'
import { getTrashRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export type TrashActionResult = { error?: string }

function trashRepository() {
  const trash = getTrashRepository()
  if (!trash) throw new Error('A lixeira com restauração exige o armazenamento SQLite.')
  return trash
}

async function run(operation: () => Promise<unknown>, fallback: string): Promise<TrashActionResult> {
  try {
    await operation()
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : fallback }
  }
}

/** Um item restaurado volta aos catálogos, então todas as rotas do mundo são revalidadas. */
function revalidateWorld() {
  revalidatePath('/', 'layout')
}

export async function restoreTrashItemAction(worldId: string, kind: TrashItemKind, id: string): Promise<TrashActionResult> {
  const result = await run(async () => {
    const world = await getCurrentWorld()
    if (world.id !== worldId) throw new Error('O Codex ativo mudou. Recarregue a lixeira.')
    await trashRepository().restoreItem(world.id, TrashItemKindSchema.parse(kind), id)
  }, 'Não foi possível restaurar o item.')
  revalidateWorld()
  return result
}

export async function discardTrashItemAction(worldId: string, kind: TrashItemKind, id: string): Promise<TrashActionResult> {
  const result = await run(async () => {
    const world = await getCurrentWorld()
    if (world.id !== worldId) throw new Error('O Codex ativo mudou. Recarregue a lixeira.')
    await trashRepository().discardItem(world.id, TrashItemKindSchema.parse(kind), id)
  }, 'Não foi possível apagar o item.')
  revalidateWorld()
  return result
}

export async function restoreWorldAction(worldId: string): Promise<TrashActionResult> {
  const result = await run(() => trashRepository().restoreWorld(worldId), 'Não foi possível restaurar o Codex.')
  revalidateWorld()
  return result
}

export async function discardWorldAction(worldId: string): Promise<TrashActionResult> {
  const result = await run(() => trashRepository().discardWorld(worldId), 'Não foi possível apagar o Codex.')
  revalidateWorld()
  return result
}
