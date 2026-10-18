import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { getWorldRepository } from '@/repositories'
import type { World } from '@/domain/worlds/world'

/** Memoized per request, so the layout and the page read the worlds once. */
export const getCurrentWorld = cache(async (): Promise<World> => {
  const worlds = await getWorldRepository().listWorlds()
  const selectedId = (await cookies()).get('canon-codex-world')?.value
  const world = worlds.find((candidate) => candidate.id === selectedId) ?? worlds[0]
  if (!world) throw new Error('No world found in workspace')
  return world
})
