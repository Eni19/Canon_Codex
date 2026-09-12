'use client'

import { Trash2 } from 'lucide-react'
import { useTransition } from 'react'
import { deleteBoardAction } from '@/app/actions/boards'

export function DeleteBoardButton({ boardId, title }: { boardId: string; title: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
      aria-label={`Excluir ${title}`}
      onClick={() => {
        if (!window.confirm(`Mover o quadro “${title}” para a lixeira?`)) return
        startTransition(() => void deleteBoardAction(boardId))
      }}
    >
      <Trash2 className="size-4" />
    </button>
  )
}
