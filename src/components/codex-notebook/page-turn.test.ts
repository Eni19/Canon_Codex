import { describe, expect, it } from 'vitest'
import { leafPose, progressFromPointer, settleTarget, springStep } from './page-turn'

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

describe('progressFromPointer', () => {
  it('keeps the free edge under the pointer', () => {
    expect(progressFromPointer(500, 100, 400)).toBeCloseTo(0)
    expect(progressFromPointer(100, 100, 400)).toBeCloseTo(0.5)
    expect(progressFromPointer(-300, 100, 400)).toBeCloseTo(1)
    expect(progressFromPointer(-900, 100, 400)).toBeCloseTo(1)
  })
})

describe('settleTarget', () => {
  it('follows a fast flick even when the leaf has barely moved', () => {
    expect(settleTarget(0.1, 2)).toBe(1)
    expect(settleTarget(0.9, -2)).toBe(0)
  })

  it('otherwise settles on the nearer side', () => {
    expect(settleTarget(0.6, 0)).toBe(1)
    expect(settleTarget(0.4, 0.3)).toBe(0)
  })
})

describe('springStep', () => {
  it('converges on the target', () => {
    let state = { position: 0, velocity: 0 }
    for (let frame = 0; frame < 240; frame += 1) state = springStep(state.position, state.velocity, 1, 1 / 60)
    expect(state.position).toBeCloseTo(1, 2)
  })
})
