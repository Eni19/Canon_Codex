'use client'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { deletePlaylistAction } from '@/app/actions/playlists'

export function DeletePlaylistButton({ playlistId, title, redirectTo }: { playlistId: string; title: string; redirectTo?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
      aria-label={`Excluir ${title}`}
      title="Excluir playlist"
      onClick={() => {
        if (!window.confirm(`Mover a playlist “${title}” para a lixeira?`)) return
        startTransition(async () => {
          await deletePlaylistAction(playlistId)
          if (redirectTo) router.push(redirectTo)
        })
      }}
    >
      <Trash2 className="size-4" />
    </button>
  )
}
