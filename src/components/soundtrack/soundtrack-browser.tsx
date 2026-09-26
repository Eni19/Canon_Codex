'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, AudioLines, ExternalLink, Loader2, Music, Pause, Play, Search, Shuffle, SkipBack, SkipForward, X } from 'lucide-react'
import type { Playlist, PlaylistSummary } from '@/domain/playlists/playlist'
import { youtubeThumbnailUrl } from '@/lib/youtube/parseYoutubeUrl'
import { cn } from '@/lib/utils'
import { useSoundtrack, type QueueTrack } from './soundtrack-provider'

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Modal to browse the world's playlists and start any of them (or a single track) without leaving the page. */
export function SoundtrackBrowser({ onClose }: { onClose: () => void }) {
  const sound = useSoundtrack()
  const [summaries, setSummaries] = useState<PlaylistSummary[] | null>(null)
  const [selected, setSelected] = useState<Playlist | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/playlists', { cache: 'no-store' })
      .then((response) => { if (!response.ok) throw new Error('bad response'); return response.json() as Promise<PlaylistSummary[]> })
      .then((data) => { if (!cancelled) setSummaries(data) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])

  const openPlaylist = async (id: string) => {
    setOpening(id)
    try {
      const response = await fetch(`/api/playlists/${id}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('bad response')
      setSelected(await response.json() as Playlist)
      setQuery('')
    } catch {
      setFailed(true)
    } finally {
      setOpening(null)
    }
  }

  const term = normalize(query.trim())
  const visiblePlaylists = useMemo(() => (summaries ?? []).filter((item) => !term || normalize(`${item.title} ${item.tags.join(' ')}`).includes(term)), [summaries, term])
  const queue: QueueTrack[] = useMemo(() => (selected?.tracks ?? []).map((track) => ({ id: track.id, videoId: track.externalId, title: track.title, author: track.author })), [selected])
  const visibleTracks = useMemo(() => (selected?.tracks ?? []).map((track, index) => ({ track, index })).filter(({ track }) => !term || normalize(`${track.title} ${track.author ?? ''}`).includes(term)), [selected, term])
  const source = selected ? { playlistId: selected.id, playlistTitle: selected.title } : null
  const nowPlaying = sound.tracks.find((track) => track.id === sound.currentTrackId)
  const playing = sound.status === 'playing' || sound.status === 'loading'

  return createPortal(
    <div className="fixed inset-0 z-[2100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={onClose} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
      <div role="dialog" aria-modal="true" aria-label="Trilha sonora" onMouseDown={(event) => event.stopPropagation()} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col border border-primary/40 bg-popover text-popover-foreground shadow-2xl">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          {selected && <button type="button" onClick={() => { setSelected(null); setQuery('') }} aria-label="Voltar às playlists" className="grid size-9 shrink-0 place-items-center text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /></button>}
          <span className="hidden max-w-56 truncate text-[.65rem] font-extrabold tracking-[.16em] whitespace-nowrap text-primary uppercase sm:block">{selected ? selected.title : 'Trilha sonora'}</span>
          <label className="flex h-10 flex-1 items-center gap-2 border bg-card px-3"><Search className="size-4 text-muted-foreground" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={selected ? 'Buscar faixa por título ou autor' : 'Buscar playlist por nome ou etiqueta'} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-10 place-items-center text-muted-foreground hover:text-primary"><X className="size-4" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {failed && <p className="py-10 text-center text-sm text-destructive">Não foi possível carregar as playlists.</p>}
          {!failed && !selected && summaries === null && <p className="grid place-items-center py-10 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></p>}

          {!failed && !selected && summaries && (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]">
              {visiblePlaylists.map((playlist) => (
                <button key={playlist.id} type="button" onClick={() => void openPlaylist(playlist.id)} className={cn('group relative aspect-square overflow-hidden border bg-card text-left transition hover:-translate-y-0.5 hover:border-primary', sound.source?.playlistId === playlist.id && 'border-primary ring-1 ring-primary')}>
                  {playlist.previewExternalIds.length > 0
                    ? <span className="absolute inset-0 grid grid-cols-2 grid-rows-2">{playlist.previewExternalIds.slice(0, 4).map((videoId) => <Image key={videoId} src={youtubeThumbnailUrl(videoId)} alt="" width={160} height={90} unoptimized loading="lazy" className="size-full object-cover" />)}</span>
                    : <span className="absolute inset-0 grid place-items-center text-primary/50"><Music className="size-10" /></span>}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 grid gap-0.5 p-3">
                    <small className="text-[.52rem] tracking-[.16em] text-primary uppercase">{playlist.trackCount} {playlist.trackCount === 1 ? 'faixa' : 'faixas'}</small>
                    <strong className="font-serif text-base leading-tight text-white">{playlist.title}</strong>
                    {playlist.description && <em className="line-clamp-2 text-[.62rem] text-white/70 not-italic">{playlist.description}</em>}
                  </span>
                  {opening === playlist.id && <span className="absolute inset-0 grid place-items-center bg-black/50"><Loader2 className="size-6 animate-spin text-white" /></span>}
                </button>
              ))}
              {visiblePlaylists.length === 0 && (
                <div className="col-span-full py-10 text-center text-sm text-muted-foreground">
                  {summaries.length === 0 ? <>Nenhuma playlist ainda. <Link href="/soundtrack" onClick={onClose} className="text-primary underline">Crie a primeira na trilha sonora.</Link></> : 'Nenhuma playlist encontrada.'}
                </div>
              )}
            </div>
          )}

          {!failed && selected && source && (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button type="button" disabled={queue.length === 0} onClick={() => sound.playFrom(source, queue, 0)} className="inline-flex items-center gap-1.5 bg-primary px-3 py-2 text-xs font-bold text-primary-foreground uppercase hover:opacity-90 disabled:opacity-40"><Play className="size-3.5" />Tocar tudo</button>
                <button type="button" disabled={queue.length === 0} onClick={() => { if (!sound.shuffle) sound.toggleShuffle(); sound.playFrom(source, queue, Math.floor(Math.random() * queue.length)) }} className="inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-bold uppercase hover:border-primary hover:text-primary disabled:opacity-40"><Shuffle className="size-3.5" />Aleatório</button>
                <Link href={`/soundtrack/${selected.id}`} onClick={onClose} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">Gerenciar playlist<ExternalLink className="size-3" /></Link>
              </div>
              {queue.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Esta playlist ainda não tem faixas.</p> : (
                <ol className="divide-y divide-border border">
                  {visibleTracks.map(({ track, index }) => {
                    const current = sound.source?.playlistId === selected.id && sound.currentTrackId === track.id
                    return (
                      <li key={track.id}>
                        <button type="button" onClick={() => sound.playFrom(source, queue, index)} className={cn('flex w-full items-center gap-3 p-2 pr-3 text-left transition-colors hover:bg-card', current && 'bg-primary/10')}>
                          <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">{current && sound.status === 'playing' ? <AudioLines className="mx-auto size-4 text-primary" /> : index + 1}</span>
                          <Image src={youtubeThumbnailUrl(track.externalId)} alt="" width={80} height={45} unoptimized loading="lazy" className="aspect-video w-20 shrink-0 bg-black object-cover" />
                          <span className="min-w-0"><span className={cn('block truncate text-sm font-medium', current && 'text-primary')}>{track.title}</span>{track.author && <span className="block truncate text-xs text-muted-foreground">{track.author}</span>}</span>
                        </button>
                      </li>
                    )
                  })}
                  {visibleTracks.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Nenhuma faixa encontrada.</li>}
                </ol>
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{nowPlaying ? nowPlaying.title : 'Nada tocando'}</p>
            <p className="truncate text-xs text-muted-foreground">{nowPlaying && sound.source ? sound.source.playlistTitle : 'Escolha uma playlist ou faixa acima.'}</p>
          </div>
          <button type="button" onClick={sound.previous} disabled={!nowPlaying} aria-label="Faixa anterior" className="grid size-9 place-items-center hover:text-primary disabled:opacity-40"><SkipBack className="size-4" /></button>
          <button type="button" onClick={sound.toggle} disabled={!nowPlaying} aria-label={playing ? 'Pausar' : 'Tocar'} className="grid size-9 place-items-center bg-primary text-primary-foreground disabled:opacity-40">{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</button>
          <button type="button" onClick={sound.next} disabled={!nowPlaying} aria-label="Próxima faixa" className="grid size-9 place-items-center hover:text-primary disabled:opacity-40"><SkipForward className="size-4" /></button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
