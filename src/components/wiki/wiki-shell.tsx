'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { CommandPalette } from '@/components/wiki/command-palette'
import { MobileNav } from '@/components/wiki/mobile-nav'
import { WikiSidebar } from '@/components/wiki/wiki-sidebar'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'

export function WikiShell({ children, worldName, entityTypes }: { children: ReactNode; worldName: string; entityTypes: EntityTypeDefinition[] }) {
  const pathname = usePathname()
  if (pathname === '/') return <>{children}</>
  const relationships = pathname === '/relationships'
  // Full-height canvases (relationship graph, Codex notebook) fill the viewport instead of scrolling.
  const surface = relationships || pathname === '/codex'

  return <>
    <div data-relationship-shell={relationships || undefined} className={surface ? 'flex h-dvh min-h-0 shrink-0 flex-col overflow-hidden md:flex-row' : 'flex h-full flex-1 flex-col md:flex-row'}>
      <WikiSidebar worldName={worldName} entityTypes={entityTypes}/>
      <MobileNav worldName={worldName} entityTypes={entityTypes}/>
      <main className={surface ? 'relative min-h-0 min-w-0 flex-1 overflow-hidden' : 'min-w-0 flex-1 overflow-y-auto'}>{children}</main>
    </div>
    <CommandPalette/>
  </>
}
