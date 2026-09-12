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

  return <>
    <div className="flex h-full flex-1 flex-col md:flex-row">
      <WikiSidebar worldName={worldName} entityTypes={entityTypes}/>
      <MobileNav worldName={worldName} entityTypes={entityTypes}/>
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
    <CommandPalette/>
  </>
}
