'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { WikiSidebarNav } from '@/components/wiki/wiki-sidebar-nav'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'

/** Small-viewport equivalent of WikiSidebar: a top bar + off-canvas drawer. Spec 17: sidebar deve se adaptar. */
export function MobileNav({
  worldName,
  entityTypes,
}: {
  worldName: string
  entityTypes: EntityTypeDefinition[]
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [lastPathname, setLastPathname] = useState(pathname)

  // Close the drawer after a navigation — adjusting state during render (not an effect) per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setOpen(false)
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar px-3 text-sidebar-foreground md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Menu className="size-5" />
        </Button>
        <span className="truncate font-serif text-lg font-medium">{worldName}</span>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="border-b border-sidebar-border">
            <SheetTitle className="text-sidebar-foreground">{worldName}</SheetTitle>
          </SheetHeader>
          <WikiSidebarNav entityTypes={entityTypes} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
