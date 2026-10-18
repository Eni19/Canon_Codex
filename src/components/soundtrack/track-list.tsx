'use client'

import Image from 'next/image'
import { useTransition } from 'react'
import { AudioLines, Music, Play, Shuffle, X } from 'lucide-react'
import { removeTrackAction } from '@/app/actions/playlists'
import { Button } from '@/components/ui/button'
import type { Track } from '@/domain/playlists/playlist'
import { youtubeThumbnailUrl } from '@/lib/youtube/parseYoutubeUrl'
import { cn } from '@/lib/utils'
import { useSoundtrack, type QueueTrack } from './soundtrack-provider'

export function TrackList({ playlistId, playlistTitle, tracks }: { playlistId: string; playlistTitle: string; tracks: Track[] }) {
  const sound = useSoundtrack()
  const [pending, startTransition] = useTransition()
  const queue: QueueTrack[] = tracks.map((track) => ({ id: track.id, videoId: track.externalId, title: track.title, author: track.author }))
  const source = { playlistId, playlistTitle }
  const playingHere = sound.source?.playlistId === playlistId

  if (tracks.length === 0) {
    return (
      <div className="grid min-h-48 place-items-center border border-dashed border-border bg-card/25 p-8 text-center">
        <div><Music className="mx-auto mb-3 size-9 text-primary/60" /><h2 className="font-serif text-xl">Playlist vazia</h2><p className="mt-1 text-sm text-muted-foreground">Cole links do YouTube acima para montar a trilha.</p></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => sound.playFrom(source, queue, 0)}><Play className="size-4" />Tocar tudo</Button>
        <Button type="button" variant="outline" onClick={() => { if (!sound.shuffle) sound.toggleShuffle(); sound.playFrom(source, queue, Math.floor(Math.random() * queue.length)) }}><Shuffle className="size-4" />Aleatório</Button>
        <span className="ml-auto text-xs text-muted-foreground">{tracks.length} faixa(s)</span>
      </div>
      <ol className="divide-y divide-border border border-border bg-card/30">
        {tracks.map((track, index) => {
          const current = playingHere && sound.currentTrackId === track.id
          return (
            <li key={track.id} className={cn('group flex items-center gap-3 p-2 pr-3 transition-colors hover:bg-card', current && 'bg-primary/10')}>
              <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => sound.playFrom(source, queue, index)} aria-label={`Tocar ${track.title}`}>
                <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">{current && sound.status === 'playing' ? <AudioLines className="mx-auto size-4 text-primary" /> : index + 1}</span>
                <Image src={youtubeThumbnailUrl(track.externalId)} alt="" width={96} height={54} unoptimized loading="lazy" className="aspect-video w-24 shrink-0 bg-black object-cover" />
                <span className="min-w-0">
                  <span className={cn('block truncate text-sm font-medium', current && 'text-primary')}>{track.title}</span>
                  {track.author && <span className="block truncate text-xs text-muted-foreground">{track.author}</span>}
                </span>
              </button>
              <button type="button" disabled={pending} onClick={() => startTransition(() => void removeTrackAction(playlistId, track.id))} className="rounded-md p-2 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 disabled:opacity-40 group-hover:opacity-100" aria-label={`Remover ${track.title}`} title="Remover da playlist"><X className="size-4" /></button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
