'use client'

import { useState, useTransition } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { TrashActionResult } from '@/app/actions/trash'
import { Button } from '@/components/ui/button'

/** Restaurar e Apagar agora de um item da lixeira; Apagar agora pede confirmação. */
export function TrashItemActions({ title, restore, discard }: {
  title: string
  restore: () => Promise<TrashActionResult>
  discard: () => Promise<TrashActionResult>
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  function perform(operation: () => Promise<TrashActionResult>, success: string) {
    setError(undefined)
    startTransition(async () => {
      const result = await operation()
      if (result.error) setError(result.error)
      else toast.success(success)
    })
  }

  return <div className="flex flex-col items-end gap-1">
    <div className="flex shrink-0 gap-2">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => perform(restore, `“${title}” foi restaurado.`)} aria-label={`Restaurar ${title}`}>
        <RotateCcw/>Restaurar
      </Button>
      <Button
        type="button" variant="ghost" size="sm" disabled={pending} aria-label={`Apagar ${title} agora`}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => {
          if (!window.confirm(`Apagar “${title}” de vez? Isso não pode ser desfeito.`)) return
          perform(discard, `“${title}” foi apagado.`)
        }}
      >
        <Trash2/>Apagar agora
      </Button>
    </div>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
}
