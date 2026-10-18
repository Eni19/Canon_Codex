'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { toast } from 'sonner'
import { projectionSession, useProjectionSession } from '@/lib/projection/projection-session'
import { loadYouTubeApi, YT_STATE, type YTPlayer } from '@/lib/youtube/iframeApi'
import { SoundtrackBrowser } from './soundtrack-browser'

export interface QueueTrack { id: string; videoId: string; title: string; author?: string }
export interface QueueSource { playlistId: string; playlistTitle: string }
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused'
export type RepeatMode = 'off' | 'all' | 'one'

interface SoundtrackContextValue {
  source: QueueSource | null
  tracks: QueueTrack[]
  currentTrackId: string | null
  status: PlaybackStatus
  position: number
  duration: number
  volume: number
  shuffle: boolean
  repeat: RepeatMode
  playFrom: (source: QueueSource, tracks: QueueTrack[], startIndex?: number) => void
  toggle: () => void
  next: () => void
  previous: () => void
  seek: (seconds: number) => void
  setVolume: (volume: number) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  stop: () => void
  openBrowser: () => void
  /** The projection window plays the music (so a shared window carries it); this window stays silent. */
  projectionAudio: { connected: boolean; blocked: boolean; showPlayer: boolean; setShowPlayer: (show: boolean) => void }
}

const SoundtrackContext = createContext<SoundtrackContextValue | null>(null)
const SoundtrackHostContext = createContext<((element: HTMLElement | null) => void) | null>(null)

const VOLUME_KEY = 'canon-codex:soundtrack-volume'
const VOLUME_EVENT = 'canon-codex:soundtrack-volume-changed'
const DEFAULT_VOLUME = 70

function subscribeToVolume(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(VOLUME_EVENT, callback)
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(VOLUME_EVENT, callback) }
}

function volumeSnapshot(): number {
  const raw = window.localStorage.getItem(VOLUME_KEY)
  const value = raw === null ? Number.NaN : Number(raw)
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : DEFAULT_VOLUME
}

const SHOW_PLAYER_KEY = 'canon-codex:projection-show-player'
const SHOW_PLAYER_EVENT = 'canon-codex:projection-show-player-changed'

function subscribeToShowPlayer(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(SHOW_PLAYER_EVENT, callback)
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(SHOW_PLAYER_EVENT, callback) }
}

function showPlayerSnapshot(): boolean { return window.localStorage.getItem(SHOW_PLAYER_KEY) !== 'false' }

function buildOrder(count: number, shuffle: boolean, first: number): number[] {
  const indices = Array.from({ length: count }, (_, index) => index)
  if (!shuffle) return indices
  const rest = indices.filter((index) => index !== first)
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return [first, ...rest]
}

interface Core {
  source: QueueSource | null
  tracks: QueueTrack[]
  order: number[]
  pos: number
  shuffle: boolean
  repeat: RepeatMode
  status: PlaybackStatus
  failures: number
}

const INITIAL_CORE: Core = { source: null, tracks: [], order: [], pos: -1, shuffle: false, repeat: 'off', status: 'idle', failures: 0 }

/**
 * Owns the single YouTube player of the app. It lives in the wiki layout so the music keeps
 * playing while you move between pages, boards and scenes. The queue is kept in a ref (read by the
 * player callbacks) and mirrored into state for rendering.
 */
export function SoundtrackProvider({ children }: { children: ReactNode }) {
  const core = useRef<Core>({ ...INITIAL_CORE })
  const playerRef = useRef<YTPlayer | null>(null)
  const readyRef = useRef(false)
  const pendingRef = useRef<(() => void) | null>(null)
  const [hostElement, setHostElement] = useState<HTMLElement | null>(null)
  const [view, setView] = useState<Core>(INITIAL_CORE)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const volume = useSyncExternalStore(subscribeToVolume, volumeSnapshot, () => DEFAULT_VOLUME)
  const volumeRef = useRef(volume)
  const showPlayer = useSyncExternalStore(subscribeToShowPlayer, showPlayerSnapshot, () => true)
  const showPlayerRef = useRef(showPlayer)
  const { connected: projectionConnected } = useProjectionSession()
  const remoteRef = useRef(projectionConnected)
  const startPendingRef = useRef(false)
  const [remoteBlocked, setRemoteBlocked] = useState(false)
  const [browserOpen, setBrowserOpen] = useState(false)

  const publish = useCallback(() => setView({ ...core.current }), [])
  const setStatus = useCallback((status: PlaybackStatus) => { core.current.status = status; publish() }, [publish])

  const loadCurrent = useCallback(() => {
    const c = core.current
    const track = c.tracks[c.order[c.pos]]
    if (!track) return
    const run = () => { c.status = 'loading'; startPendingRef.current = true; publish(); setPosition(0); setDuration(0); playerRef.current?.loadVideoById(track.videoId) }
    if (readyRef.current) run()
    else { pendingRef.current = run; c.status = 'loading'; publish() }
  }, [publish])

  const publishAudio = useCallback(() => {
    if (!projectionSession.isActive()) return
    const c = core.current
    const track = c.pos >= 0 ? c.tracks[c.order[c.pos]] : undefined
    const active = Boolean(track) && c.status !== 'idle'
    const player = playerRef.current
    projectionSession.publish({
      type: 'AUDIO_STATE',
      audio: {
        videoId: active && track ? track.videoId : null,
        playing: c.status === 'playing' || c.status === 'loading',
        position: startPendingRef.current || !player || !readyRef.current ? 0 : player.getCurrentTime() || 0,
        volume: volumeRef.current,
        showPlayer: showPlayerRef.current,
        title: track?.title,
        sentAt: Date.now(),
      },
    })
  }, [])

  const step = useCallback((direction: 1 | -1, auto: boolean) => {
    const c = core.current
    if (c.order.length === 0) return
    let target = c.pos + direction
    if (target >= c.order.length) {
      if (c.repeat === 'all') target = 0
      else { if (auto) setStatus('paused'); return }
    }
    if (target < 0) target = 0
    c.pos = target
    loadCurrent()
  }, [loadCurrent, setStatus])

  const handleFailure = useCallback(() => {
    const c = core.current
    const track = c.tracks[c.order[c.pos]]
    c.failures += 1
    toast.error(track ? `“${track.title}” não pode ser tocada aqui (privada, removida ou sem incorporação).` : 'Faixa indisponível.')
    if (c.failures >= c.tracks.length) { c.failures = 0; setStatus('paused') }
    else step(1, true)
  }, [setStatus, step])

  useEffect(() => {
    if (!hostElement) return
    const c = core.current
    let cancelled = false
    const target = document.createElement('div')
    hostElement.appendChild(target)

    loadYouTubeApi().then((YT) => {
      if (cancelled) return
      const player = new YT.Player(target, {
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, origin: window.location.origin },
        events: {
          onReady: () => {
            playerRef.current = player
            readyRef.current = true
            player.setVolume(volumeRef.current)
            if (remoteRef.current) player.mute()
            const pending = pendingRef.current
            pendingRef.current = null
            pending?.()
          },
          onStateChange: (event) => {
            const c = core.current
            if (event.data === YT_STATE.PLAYING) { c.failures = 0; startPendingRef.current = false; setStatus('playing') }
            else if (event.data === YT_STATE.PAUSED) setStatus('paused')
            else if (event.data === YT_STATE.BUFFERING) setStatus('loading')
            else if (event.data === YT_STATE.ENDED) {
              if (c.repeat === 'one') { player.seekTo(0, true); player.playVideo() }
              else step(1, true)
            }
          },
          onError: () => handleFailure(),
        },
      })
    }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar o player.'))

    return () => {
      cancelled = true
      try { playerRef.current?.destroy() } catch { /* already gone */ }
      playerRef.current = null
      readyRef.current = false
      target.remove()
      if (c.status !== 'idle') setStatus('paused')
    }
  }, [hostElement, setStatus, step, handleFailure])

  useEffect(() => {
    volumeRef.current = volume
    if (readyRef.current) playerRef.current?.setVolume(volume)
  }, [volume])

  // While the projection window is alive it is the one that makes sound; this window keeps playing
  // (it owns the queue and the track timing) but muted, so nothing is heard twice.
  useEffect(() => {
    remoteRef.current = projectionConnected
    const player = playerRef.current
    if (!readyRef.current || !player) return
    if (projectionConnected) player.mute()
    else player.unMute()
  }, [projectionConnected])

  useEffect(() => {
    showPlayerRef.current = showPlayer
  }, [showPlayer])

  useEffect(() => {
    publishAudio()
  }, [view.status, view.tracks, view.pos, volume, showPlayer, projectionConnected, publishAudio])

  useEffect(() => projectionSession.subscribe((message) => {
    if (message.type === 'PROJECTION_READY') publishAudio()
    else if (message.type === 'AUDIO_STATUS') setRemoteBlocked(message.status.blocked)
  }), [publishAudio])

  useEffect(() => {
    if (view.status !== 'playing') return
    const timer = window.setInterval(publishAudio, 4000)
    return () => window.clearInterval(timer)
  }, [view.status, publishAudio])

  // Some videos never start and never report an error; give up on them after a while.
  const loadingTrackId = view.status === 'loading' && view.pos >= 0 ? view.tracks[view.order[view.pos]]?.id : undefined
  useEffect(() => {
    if (!loadingTrackId) return
    const timer = window.setTimeout(() => { if (core.current.status === 'loading') handleFailure() }, 12000)
    return () => window.clearTimeout(timer)
  }, [loadingTrackId, handleFailure])

  useEffect(() => {
    if (view.status !== 'playing') return
    const timer = window.setInterval(() => {
      const player = playerRef.current
      if (!player || !readyRef.current) return
      setPosition(player.getCurrentTime() || 0)
      setDuration(player.getDuration() || 0)
    }, 500)
    return () => window.clearInterval(timer)
  }, [view.status])

  const playFrom = useCallback((source: QueueSource, tracks: QueueTrack[], startIndex = 0) => {
    if (tracks.length === 0) return
    const c = core.current
    const first = Math.min(Math.max(startIndex, 0), tracks.length - 1)
    c.source = source
    c.tracks = tracks
    c.order = buildOrder(tracks.length, c.shuffle, first)
    c.pos = c.shuffle ? 0 : first
    c.failures = 0
    loadCurrent()
  }, [loadCurrent])

  const toggle = useCallback(() => {
    const player = playerRef.current
    const c = core.current
    if (!player || !readyRef.current || c.pos < 0) return
    if (c.status === 'playing' || c.status === 'loading') player.pauseVideo()
    else player.playVideo()
  }, [])

  const next = useCallback(() => step(1, false), [step])
  const previous = useCallback(() => {
    const player = playerRef.current
    if (player && readyRef.current && player.getCurrentTime() > 3) { player.seekTo(0, true); setPosition(0); return }
    step(-1, false)
  }, [step])

  const seek = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true)
    setPosition(seconds)
    publishAudio()
  }, [publishAudio])

  const setVolume = useCallback((next: number) => {
    window.localStorage.setItem(VOLUME_KEY, String(Math.round(next)))
    window.dispatchEvent(new Event(VOLUME_EVENT))
  }, [])

  const toggleShuffle = useCallback(() => {
    const c = core.current
    c.shuffle = !c.shuffle
    if (c.tracks.length > 0 && c.pos >= 0) {
      const currentIndex = c.order[c.pos]
      c.order = buildOrder(c.tracks.length, c.shuffle, currentIndex)
      c.pos = c.shuffle ? 0 : currentIndex
    }
    publish()
  }, [publish])

  const cycleRepeat = useCallback(() => {
    const c = core.current
    c.repeat = c.repeat === 'off' ? 'all' : c.repeat === 'all' ? 'one' : 'off'
    publish()
  }, [publish])

  const setShowPlayer = useCallback((show: boolean) => {
    window.localStorage.setItem(SHOW_PLAYER_KEY, String(show))
    window.dispatchEvent(new Event(SHOW_PLAYER_EVENT))
  }, [])

  const openBrowser = useCallback(() => setBrowserOpen(true), [])

  const stop = useCallback(() => {
    const c = core.current
    try { playerRef.current?.stopVideo() } catch { /* player not ready */ }
    pendingRef.current = null
    Object.assign(c, { source: null, tracks: [], order: [], pos: -1, status: 'idle', failures: 0 })
    setPosition(0)
    setDuration(0)
    publish()
  }, [publish])

  const currentTrackId = view.pos >= 0 ? view.tracks[view.order[view.pos]]?.id ?? null : null

  const value = useMemo<SoundtrackContextValue>(() => ({
    source: view.source,
    tracks: view.tracks,
    currentTrackId,
    status: view.status,
    position,
    duration,
    volume,
    shuffle: view.shuffle,
    repeat: view.repeat,
    playFrom,
    toggle,
    next,
    previous,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    stop,
    openBrowser,
    projectionAudio: { connected: projectionConnected, blocked: remoteBlocked && projectionConnected, showPlayer, setShowPlayer },
  }), [view, currentTrackId, position, duration, volume, playFrom, toggle, next, previous, seek, setVolume, toggleShuffle, cycleRepeat, stop, openBrowser, projectionConnected, remoteBlocked, showPlayer, setShowPlayer])

  return <SoundtrackHostContext.Provider value={setHostElement}><SoundtrackContext.Provider value={value}>{children}{browserOpen && <SoundtrackBrowser onClose={() => setBrowserOpen(false)} />}</SoundtrackContext.Provider></SoundtrackHostContext.Provider>
}

export function useSoundtrack(): SoundtrackContextValue {
  const context = useContext(SoundtrackContext)
  if (!context) throw new Error('useSoundtrack must be used inside SoundtrackProvider')
  return context
}

/** Ref callback for the element that will hold the YouTube iframe (one dock at a time). */
export function useSoundtrackHost(): (element: HTMLElement | null) => void {
  const register = useContext(SoundtrackHostContext)
  if (!register) throw new Error('useSoundtrackHost must be used inside SoundtrackProvider')
  return register
}
