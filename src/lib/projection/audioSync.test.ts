import { describe, expect, it } from 'vitest'
import type { ProjectionAudioState } from '@/domain/projection/projection'
import { expectedPosition, planAudioSync } from './audioSync'

const base: ProjectionAudioState = { videoId: 'abcdefghijk', playing: true, position: 30, volume: 60, showPlayer: true, sentAt: 1_000_000 }

describe('planAudioSync', () => {
  it('loads a new track at the position the GM has reached, compensating the message delay', () => {
    expect(planAudioSync(base, { videoId: null, state: 'unstarted', position: 0 }, 1_002_000)).toEqual([{ type: 'load', videoId: 'abcdefghijk', start: 32, play: true }])
    expect(planAudioSync(base, { videoId: 'otherVideo1', state: 'playing', position: 5 }, 1_000_000)).toEqual([{ type: 'load', videoId: 'abcdefghijk', start: 30, play: true }])
  })

  it('does nothing while the projection is in sync', () => {
    expect(planAudioSync(base, { videoId: 'abcdefghijk', state: 'playing', position: 31 }, 1_001_000)).toEqual([])
  })

  it('follows play and pause', () => {
    expect(planAudioSync(base, { videoId: 'abcdefghijk', state: 'paused', position: 30 }, 1_000_000)).toEqual([{ type: 'play' }])
    expect(planAudioSync({ ...base, playing: false }, { videoId: 'abcdefghijk', state: 'playing', position: 30 }, 1_000_000)).toEqual([{ type: 'pause' }])
  })

  it('jumps only when the drift is larger than the tolerance', () => {
    expect(planAudioSync(base, { videoId: 'abcdefghijk', state: 'playing', position: 45 }, 1_000_000)).toEqual([{ type: 'seek', to: 30 }])
    expect(planAudioSync(base, { videoId: 'abcdefghijk', state: 'playing', position: 32 }, 1_000_000)).toEqual([])
  })

  it('stops when the GM stops the queue', () => {
    expect(planAudioSync({ ...base, videoId: null, playing: false }, { videoId: 'abcdefghijk', state: 'playing', position: 30 }, 1_000_000)).toEqual([{ type: 'stop' }])
    expect(planAudioSync({ ...base, videoId: null, playing: false }, { videoId: null, state: 'unstarted', position: 0 }, 1_000_000)).toEqual([])
  })

  it('does not advance the expected position while paused', () => {
    expect(expectedPosition({ ...base, playing: false }, 1_010_000)).toBe(30)
    expect(expectedPosition(base, 1_010_000)).toBe(40)
  })
})
