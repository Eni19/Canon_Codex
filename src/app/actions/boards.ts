'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getBoardRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

function parseTags(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string') return []
  return value.split(',').map((tag) => tag.trim()).filter(Boolean)
}

export async function createBoardAction(formData: FormData): Promise<void> {
  const world = await getCurrentWorld()
  const board = await getBoardRepository().createBoard(world.id, {
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    tags: parseTags(formData.get('tags')),
  })
  revalidatePath('/boards')
  redirect(`/boards/${board.id}`)
}

export async function deleteBoardAction(boardId: string): Promise<void> {
  const world = await getCurrentWorld()
  await getBoardRepository().deleteBoard(world.id, boardId)
  revalidatePath('/boards')
}
