import type { ProjectionAudioState } from '@/domain/projection/projection'

export interface AudioPlayerSnapshot {
  /** Video currently loaded in the projection's player, if any. */
  videoId: string | null
  state: 'playing' | 'paused' | 'buffering' | 'unstarted' | 'ended'
  position: number
}

export type AudioAction =
  | { type: 'load'; videoId: string; start: number; play: boolean }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'seek'; to: number }
  | { type: 'stop' }

/** Seconds of drift tolerated before the projection jumps to the GM's position. */
export const DRIFT_TOLERANCE = 2.5

/** Where the track should be right now according to the GM's last message. */
export function expectedPosition(desired: ProjectionAudioState, now: number): number {
  return desired.position + (desired.playing ? Math.max(0, (now - desired.sentAt) / 1000) : 0)
}

/** Decides what the projection's player has to do to match what the GM is playing. Pure, so it is easy to test. */
export function planAudioSync(desired: ProjectionAudioState, current: AudioPlayerSnapshot, now: number): AudioAction[] {
  if (!desired.videoId) return current.videoId ? [{ type: 'stop' }] : []
  const expected = expectedPosition(desired, now)
  if (current.videoId !== desired.videoId) return [{ type: 'load', videoId: desired.videoId, start: Math.max(0, expected), play: desired.playing }]

  const actions: AudioAction[] = []
  const running = current.state === 'playing' || current.state === 'buffering'
  if (desired.playing && !running) actions.push({ type: 'play' })
  if (!desired.playing && running) actions.push({ type: 'pause' })
  if (Math.abs(current.position - expected) > DRIFT_TOLERANCE) actions.push({ type: 'seek', to: Math.max(0, expected) })
  return actions
}
