import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getWorldRepository, LegacyMigrationRequiredError } from '@/repositories'
import type { World } from '@/domain/worlds/world'

/** Memoized per request, so the layout and the page read the worlds once. */
export const getCurrentWorld = cache(async (): Promise<World> => {
  const selectedId = (await cookies()).get('canon-codex-world')?.value
  const worlds = await listWorldsOrRedirect()
  const world = worlds.find((candidate) => candidate.id === selectedId) ?? worlds[0]
  if (!world) redirect('/')
  return world
})

async function listWorldsOrRedirect() {
  try {
    return await getWorldRepository().listWorlds()
  } catch (error) {
    if (error instanceof LegacyMigrationRequiredError) redirect('/')
    throw error
  }
}
