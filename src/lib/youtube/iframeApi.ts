/** Minimal typings for the parts of the YouTube IFrame Player API this app uses. */
export interface YTPlayer {
  loadVideoById(videoId: string | { videoId: string; startSeconds?: number }): void
  cueVideoById(videoId: string | { videoId: string; startSeconds?: number }): void
  mute(): void
  unMute(): void
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  setVolume(volume: number): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  getPlaylist(): string[] | null
  destroy(): void
}

export interface YTPlayerEvent { target: YTPlayer; data: number }

export interface YTPlayerOptions {
  width?: number | string
  height?: number | string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (event: YTPlayerEvent) => void
    onStateChange?: (event: YTPlayerEvent) => void
    onError?: (event: YTPlayerEvent) => void
  }
}

export interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer
}

export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YTNamespace> | null = null

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('YouTube API needs a browser'))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error('YouTube API did not initialise'))
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => { apiPromise = null; reject(new Error('Não foi possível carregar o player do YouTube. Verifique a conexão.')) }
    document.head.appendChild(script)
  })
  return apiPromise
}

/**
 * Reads the video ids of a public/unlisted playlist by cueing it in a throw-away player, which
 * needs no API key. The player is destroyed right after and never plays anything.
 */
export async function listPlaylistVideoIds(playlistId: string): Promise<string[]> {
  const YT = await loadYouTubeApi()
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:200px;height:200px;pointer-events:none'
  const target = document.createElement('div')
  host.appendChild(target)
  document.body.appendChild(host)

  let player: YTPlayer | undefined
  try {
    let failed = false
    await new Promise<void>((resolve) => {
      player = new YT.Player(target, {
        width: 200,
        height: 200,
        playerVars: { listType: 'playlist', list: playlistId, origin: window.location.origin },
        events: { onReady: () => resolve(), onError: () => { failed = true; resolve() } },
      })
    })
    const deadline = Date.now() + 8000
    let ids: string[] = []
    while (!failed && Date.now() < deadline) {
      ids = player?.getPlaylist() ?? []
      if (ids.length > 0) break
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    if (ids.length === 0) throw new Error('Não foi possível ler a playlist. Ela precisa ser pública ou não listada.')
    return ids
  } finally {
    try { player?.destroy() } catch { /* already gone */ }
    host.remove()
  }
}
