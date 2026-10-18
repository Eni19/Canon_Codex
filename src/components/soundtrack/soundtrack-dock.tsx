'use client'

import Link from 'next/link'
import { Cast, ListMusic, Loader2, Music, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, TriangleAlert, Volume2, VolumeX, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSoundtrack, useSoundtrackHost } from './soundtrack-provider'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const ICON_BUTTON = 'grid size-8 shrink-0 place-items-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-40'

/**
 * Player controls shown at the bottom of the sidebar. The YouTube video stays visible (small) while
 * playing; the collapsed sidebar shrinks it further instead of hiding it.
 */
export function SoundtrackDock({ collapsed }: { collapsed: boolean }) {
  const sound = useSoundtrack()
  const registerHost = useSoundtrackHost()
  const track = sound.tracks.find((item) => item.id === sound.currentTrackId)
  const active = sound.status !== 'idle' && Boolean(track)
  const busy = sound.status === 'loading'
  const playing = sound.status === 'playing' || busy

  const playPause = (
    <button type="button" className={cn(ICON_BUTTON, 'bg-sidebar-accent')} onClick={sound.toggle} disabled={!active} aria-label={playing ? 'Pausar' : 'Tocar'} title={playing ? 'Pausar' : 'Tocar'}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : playing ? <Pause className="size-4" /> : <Play className="size-4" />}
    </button>
  )

  return (
    <div className={cn('shrink-0 border-t border-sidebar-border', collapsed ? 'px-2 py-2' : 'p-3')}>
      <div ref={registerHost} className={cn('relative aspect-video overflow-hidden bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:size-full', !active && 'hidden')} />

      {!active && (
        <Link href="/soundtrack" title="Trilha sonora" className={cn('flex items-center gap-2 rounded-md text-xs text-muted-foreground hover:text-sidebar-foreground', collapsed ? 'justify-center py-1' : 'px-2 py-1.5')}>
          <Music className="size-4 shrink-0" />
          {!collapsed && <span>Nada tocando · abrir trilha sonora</span>}
        </Link>
      )}
      {!active && !collapsed && (
        <button type="button" onClick={sound.openBrowser} className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"><ListMusic className="size-4 shrink-0" />Escolher playlist ou faixa</button>
      )}

      {active && collapsed && (
        <div className="mt-1.5 flex flex-col items-center gap-1">
          {playPause}
          <button type="button" className={ICON_BUTTON} onClick={sound.next} aria-label="Próxima faixa" title="Próxima faixa"><SkipForward className="size-4" /></button>
        </div>
      )}

      {active && !collapsed && track && (
        <div className="mt-2 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium" title={track.title}>{track.title}</p>
              {sound.source && <Link href={`/soundtrack/${sound.source.playlistId}`} className="block truncate text-[0.65rem] text-muted-foreground hover:text-primary">{sound.source.playlistTitle}</Link>}
            </div>
            <button type="button" className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:text-sidebar-foreground" onClick={sound.stop} aria-label="Parar e limpar a fila" title="Parar"><X className="size-3.5" /></button>
          </div>

          {sound.projectionAudio.connected && (
            <div className="space-y-1.5 rounded-md bg-sidebar-accent/40 p-2 text-[0.65rem]">
              <p className="flex items-center gap-1.5 text-primary"><Cast className="size-3.5 shrink-0" />Tocando pela projeção</p>
              <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground"><input type="checkbox" checked={sound.projectionAudio.showPlayer} onChange={(event) => sound.projectionAudio.setShowPlayer(event.target.checked)} className="accent-primary" />Mostrar o player na projeção</label>
              {sound.projectionAudio.blocked && <p className="flex items-start gap-1.5 text-warning"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" />O navegador bloqueou o áudio na projeção. Clique na janela dela uma vez.</p>}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button type="button" className={cn(ICON_BUTTON, sound.shuffle && 'text-primary')} onClick={sound.toggleShuffle} aria-pressed={sound.shuffle} aria-label="Aleatório" title="Aleatório"><Shuffle className="size-4" /></button>
            <button type="button" className={ICON_BUTTON} onClick={sound.previous} aria-label="Faixa anterior" title="Faixa anterior"><SkipBack className="size-4" /></button>
            {playPause}
            <button type="button" className={ICON_BUTTON} onClick={sound.next} aria-label="Próxima faixa" title="Próxima faixa"><SkipForward className="size-4" /></button>
            <button type="button" className={cn(ICON_BUTTON, sound.repeat !== 'off' && 'text-primary')} onClick={sound.cycleRepeat} aria-label={`Repetir: ${sound.repeat === 'off' ? 'desligado' : sound.repeat === 'all' ? 'playlist' : 'faixa'}`} title="Repetir">
              {sound.repeat === 'one' ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
            </button>
          </div>

          <div>
            <input type="range" min={0} max={Math.max(sound.duration, 1)} step={1} value={Math.min(sound.position, Math.max(sound.duration, 1))} onChange={(event) => sound.seek(Number(event.target.value))} disabled={sound.duration === 0} aria-label="Posição na faixa" className="h-1 w-full cursor-pointer accent-primary" />
            <div className="mt-0.5 flex justify-between text-[0.6rem] text-muted-foreground"><span>{formatTime(sound.position)}</span><span>{formatTime(sound.duration)}</span></div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" className="text-muted-foreground hover:text-sidebar-foreground" onClick={() => sound.setVolume(sound.volume === 0 ? 70 : 0)} aria-label={sound.volume === 0 ? 'Ativar som' : 'Silenciar'}>
              {sound.volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <input type="range" min={0} max={100} step={1} value={sound.volume} onChange={(event) => sound.setVolume(Number(event.target.value))} aria-label="Volume" className="h-1 w-full cursor-pointer accent-primary" />
          </div>

          <button type="button" onClick={sound.openBrowser} className="flex w-full items-center justify-center gap-2 rounded-md border border-sidebar-border px-2 py-1.5 text-xs hover:border-primary hover:text-primary"><ListMusic className="size-3.5" />Playlists e faixas</button>

        </div>
      )}
    </div>
  )
}
