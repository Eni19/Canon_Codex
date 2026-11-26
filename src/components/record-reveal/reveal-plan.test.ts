import { describe, expect, it } from 'vitest'
import { findWindow, fitSize, REVEAL, revealFrame, zoomFor } from './reveal-plan'

/** A bitmap with a thin bar on the left and a thick bar on the right. */
function bars(w: number, h: number) {
  const inside = new Uint8Array(w * h)
  for (let y = 10; y < h - 10; y += 1) {
    for (let x = 10; x < 14; x += 1) inside[y * w + x] = 1
    for (let x = 40; x < 60; x += 1) inside[y * w + x] = 1
  }
  return inside
}

describe('findWindow', () => {
  it('picks the middle of the thickest stroke', () => {
    const found = findWindow(bars(80, 60), 80, 60)
    expect(found).not.toBeNull()
    expect(found!.x).toBeGreaterThanOrEqual(48)
    expect(found!.x).toBeLessThanOrEqual(51)
    expect(found!.radius).toBeGreaterThan(8)
  })

  it('returns null when there is no letter at all', () => {
    expect(findWindow(new Uint8Array(100), 10, 10)).toBeNull()
  })
})

describe('zoomFor', () => {
  it('grows until the stroke reaches the farthest corner', () => {
    const scale = zoomFor({ x: 500, y: 400, radius: 10 }, 1000, 800)
    expect(scale * 10).toBeGreaterThan(Math.hypot(500, 400))
  })
})

describe('fitSize', () => {
  it('fits the width, but never taller than about half the screen', () => {
    expect(fitSize(300, 1000, 2000)).toBeCloseTo(286.7, 0)
    expect(fitSize(30, 1000, 800)).toBeCloseTo(368)
  })
})

describe('revealFrame', () => {
  it('holds the solid name while the page loads', () => {
    const frame = revealFrame(2000, null, 50)
    expect(frame).toMatchObject({ backdrop: 1, rise: 0, fill: 1, wipe: 0, open: false, zoom: 1, done: false })
  })

  it('opens the letters under their paper, then dissolves it while the dive begins', () => {
    const arrived = 100
    const opening = revealFrame(REVEAL.hold + 1, arrived, 50)
    expect(opening.open).toBe(true)
    expect(opening.wipe).toBeLessThan(0.01)
    const wiped = revealFrame(REVEAL.hold + REVEAL.wipe, arrived, 50)
    expect(wiped.wipe).toBeCloseTo(1)
    expect(wiped.zoom).toBeGreaterThan(1)
    const end = revealFrame(REVEAL.hold + REVEAL.wipe * REVEAL.diveFrom + REVEAL.dive, arrived, 50)
    expect(end.zoom).toBeCloseTo(50)
    expect(end.done).toBe(true)
  })

  it('gives up and fades away when the page never arrives', () => {
    expect(revealFrame(REVEAL.giveUp + 400, null, 50).done).toBe(true)
  })
})

