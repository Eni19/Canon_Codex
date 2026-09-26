'use client'

import { useEffect, useRef, useState } from 'react'
import type { ProjectionAudioState, ProjectionAudioStatus } from '@/domain/projection/projection'
import { planAudioSync, type AudioPlayerSnapshot } from '@/lib/projection/audioSync'
import { loadYouTubeApi, YT_STATE, type YTPlayer } from '@/lib/youtube/iframeApi'
import styles from './projection-audio.module.css'

function toSnapshotState(state: number): AudioPlayerSnapshot['state'] {
  if (state === YT_STATE.PLAYING) return 'playing'
  if (state === YT_STATE.PAUSED) return 'paused'
  if (state === YT_STATE.BUFFERING) return 'buffering'
  if (state === YT_STATE.ENDED) return 'ended'
  return 'unstarted'
}

/**
 * Plays the GM's soundtrack inside the projection window, so that sharing this window (or tab) with
 * audio carries the music. It only mirrors what the GM's player says; it has no queue of its own.
 */
export function ProjectionAudio({ audio, publishStatus }: { audio: ProjectionAudioState | null; publishStatus: (status: ProjectionAudioStatus) => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const readyRef = useRef(false)
  const loadedVideoRef = useRef<string | null>(null)
  const stateRef = useRef<number>(-1)
  const audioRef = useRef<ProjectionAudioState | null>(audio)
  const blockedRef = useRef(false)
  const blockTimer = useRef<number | null>(null)
  const [blocked, setBlocked] = useState(false)

  const markBlocked = (value: boolean) => {
    if (blockedRef.current === value) return
    blockedRef.current = value
    setBlocked(value)
    publishStatus({ ready: readyRef.current, blocked: value })
  }

  const apply = (desired: ProjectionAudioState | null) => {
    const player = playerRef.current
    if (!player || !readyRef.current || !desired) return
    const snapshot: AudioPlayerSnapshot = { videoId: loadedVideoRef.current, state: toSnapshotState(stateRef.current), position: player.getCurrentTime() || 0 }
    for (const action of planAudioSync(desired, snapshot, Date.now())) {
      if (action.type === 'load') {
        loadedVideoRef.current = action.videoId
        if (action.play) player.loadVideoById({ videoId: action.videoId, startSeconds: action.start })
        else player.cueVideoById({ videoId: action.videoId, startSeconds: action.start })
      } else if (action.type === 'play') player.playVideo()
      else if (action.type === 'pause') player.pauseVideo()
      else if (action.type === 'seek') player.seekTo(action.to, true)
      else if (action.type === 'stop') { player.stopVideo(); loadedVideoRef.current = null }
    }
    player.setVolume(desired.volume)
    if (blockTimer.current !== null) window.clearTimeout(blockTimer.current)
    blockTimer.current = null
    if (desired.videoId && desired.playing) {
      // Browsers may refuse to start sound in a window nobody clicked; ask for one click if that happens.
      blockTimer.current = window.setTimeout(() => {
        const wanted = audioRef.current
        if (wanted?.videoId && wanted.playing && stateRef.current !== YT_STATE.PLAYING && stateRef.current !== YT_STATE.BUFFERING) markBlocked(true)
      }, 3500)
    } else markBlocked(false)
  }

  useEffect(() => {
    let cancelled = false
    const host = hostRef.current
    if (!host) return
    const target = document.createElement('div')
    host.appendChild(target)
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
            publishStatus({ ready: true, blocked: false })
            apply(audioRef.current)
          },
          onStateChange: (event) => {
            stateRef.current = event.data
            if (event.data === YT_STATE.PLAYING) markBlocked(false)
          },
        },
      })
    }).catch(() => undefined)
    return () => {
      cancelled = true
      if (blockTimer.current !== null) window.clearTimeout(blockTimer.current)
      try { playerRef.current?.destroy() } catch { /* already gone */ }
      playerRef.current = null
      readyRef.current = false
      target.remove()
    }
    // The player is created once; `apply`/`publishStatus` are read through refs and stable closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    audioRef.current = audio
    apply(audio)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio])

  const visible = Boolean(audio?.videoId && audio.showPlayer)
  return (
    <>
      <div className={`${styles.widget} ${visible ? '' : styles.widgetHidden}`}>
        <div className={styles.video} ref={hostRef} />
        {visible && audio?.title && <span className={styles.caption}>{audio.title}</span>}
      </div>
      {blocked && <button type="button" className={styles.activate} onClick={() => { playerRef.current?.playVideo(); markBlocked(false) }}>Clique para ativar o áudio da trilha</button>}
    </>
  )
}
