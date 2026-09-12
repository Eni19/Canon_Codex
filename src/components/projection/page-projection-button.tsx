'use client'

import { Cast } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PageProjectionButton({ entityId }: { entityId: string }) {
  const openProjection = () => {
    const projection = window.open(
      `/display/entity/${entityId}`,
      'canon-codex-projection',
      'popup=yes,width=1280,height=800',
    )
    projection?.focus()
  }

  return (
    <Button
      type="button"
      onClick={openProjection}
      className="fixed right-5 bottom-5 z-50 gap-2 border border-primary/30 bg-background/90 text-primary shadow-2xl shadow-black/40 backdrop-blur-md hover:bg-primary hover:text-primary-foreground"
      variant="outline"
      aria-label="Projetar esta página"
    >
      <Cast className="size-4" />
      Projetar
    </Button>
  )
}
