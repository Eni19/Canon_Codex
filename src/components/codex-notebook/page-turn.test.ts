import { describe, expect, it } from 'vitest'
import { COMMIT_SPRING, dragProgress, leafPose, shouldComplete, springStep } from './page-turn'

describe('leafPose', () => {
  it('lies flat at both ends of the turn', () => {
    expect(leafPose(0)).toMatchObject({ spine: 0, step: 0, lift: 0 })
    const done = leafPose(1)
    expect(done.spine).toBeCloseTo(180)
    expect(done.step).toBeCloseTo(0)
    expect(done.lift).toBeCloseTo(0)
  })

  it('curls most in the middle of the turn, with the spine ahead of the free edge', () => {
    const middle = leafPose(0.5)
    expect(middle.spine).toBeGreaterThan(90)
    expect(middle.step).toBeGreaterThan(0)
    expect(middle.lift).toBeCloseTo(1)
    expect(leafPose(0.25).step).toBeLessThan(middle.step)
  })

  it('shades a strip more as it turns edge-on to the viewer', () => {
    const flat = leafPose(0).shading[0]
    // Mid-turn the curve passes edge-on somewhere along the leaf, so its darkest strip is near the cap.
    const darkest = Math.max(...leafPose(0.5).shading.map((strip) => strip.near))
    expect(flat.near).toBeCloseTo(0)
    expect(darkest).toBeGreaterThan(0.5)
  })
})

describe('dragProgress', () => {
  it('turns the leaf linearly with the pull, in the direction of the turn', () => {
    expect(dragProgress(-310, 1000, 'next')).toBeCloseTo(0.5)
    expect(dragProgress(310, 1000, 'prev')).toBeCloseTo(0.5)
    expect(dragProgress(200, 1000, 'next')).toBe(0)
    expect(dragProgress(-2000, 1000, 'next')).toBe(1)
  })
})

describe('shouldComplete', () => {
  it('completes past 42% of the way or on a quick throw', () => {
    expect(shouldComplete(0.5, 0)).toBe(true)
    expect(shouldComplete(0.3, 0)).toBe(false)
    expect(shouldComplete(0.1, 1.5)).toBe(true)
  })
})

describe('springStep', () => {
  it('converges on the target', () => {
    let state = { position: 0, velocity: 0 }
    for (let frame = 0; frame < 240; frame += 1) state = springStep(state.position, state.velocity, 1, 1 / 60)
    expect(state.position).toBeCloseTo(1, 2)
  })

  it('lands a completing turn without overshooting', () => {
    let state = { position: 0, velocity: 0 }
    let peak = 0
    for (let frame = 0; frame < 240; frame += 1) {
      state = springStep(state.position, state.velocity, 1, 1 / 60, COMMIT_SPRING.stiffness, COMMIT_SPRING.damping)
      peak = Math.max(peak, state.position)
    }
    expect(peak).toBeLessThan(1.005)
  })
})
