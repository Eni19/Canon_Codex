'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DeleteEntityButton({ action, label }: { action: () => void | Promise<void>; label: string }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Excluir "${label}"? O registro fica 7 dias na lixeira, onde pode ser restaurado, e depois é apagado de vez.`)) {
          event.preventDefault()
        }
      }}
    >
      <Button type="submit" variant="destructive" size="sm">
        <Trash2 className="size-4" />
        Excluir
      </Button>
    </form>
  )
}
