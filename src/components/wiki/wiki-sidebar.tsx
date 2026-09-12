'use client'

import { useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WikiSidebarNav } from '@/components/wiki/wiki-sidebar-nav'
import { cn } from '@/lib/utils'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'

/** Desktop-only chrome (see MobileNav for the small-viewport equivalent) — spec 17: desktop-first. */
export function WikiSidebar({
  worldName,
  entityTypes,
}: {
  worldName: string
  entityTypes: EntityTypeDefinition[]
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        // `self-stretch` (not `h-full`): a flex item's `height:100%` needs its container to have
        // a "definite" height for the percentage to resolve, which is fragile through nested flex
        // wrappers; `align-self:stretch` fills the row's cross size directly, no percentage math.
        'hidden shrink-0 flex-col self-stretch border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out md:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-3">
        {!collapsed && <span className="truncate font-serif text-lg font-medium">{worldName}</span>}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => setCollapsed((current) => !current)}
          aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>

      <WikiSidebarNav entityTypes={entityTypes} collapsed={collapsed} />
    </aside>
  )
}
