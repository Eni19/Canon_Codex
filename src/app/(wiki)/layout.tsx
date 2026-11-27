import type { ReactNode } from 'react'
import { SoundtrackProvider } from '@/components/soundtrack/soundtrack-provider'
import { CommandPaletteProvider } from '@/components/wiki/command-palette-provider'
import { WikiShell } from '@/components/wiki/wiki-shell'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export default async function WikiLayout({ children }: { children: ReactNode }) {
  const world = await getCurrentWorld()
  return <CommandPaletteProvider><SoundtrackProvider><WikiShell worldId={world.id} worldName={world.name} entityTypes={world.entityTypes} preferences={world.preferences}>{children}</WikiShell></SoundtrackProvider></CommandPaletteProvider>
}
