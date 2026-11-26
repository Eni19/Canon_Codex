import { describe, expect, it } from 'vitest'
import { bendProfile, blockHeights, BLOCK, PAGE_WIDTH } from './book-geometry'

describe('bendProfile', () => {
  it('lies flat on the right page at the start and on the left page at the end', () => {
    const start = bendProfile(0, 0.03, 0.01)
    expect(start[0]).toEqual({ x: 0, y: 0.03 })
    expect(start.at(-1)!.x).toBeCloseTo(PAGE_WIDTH)
    expect(start.at(-1)!.y).toBeCloseTo(0.03)

    const end = bendProfile(1, 0.03, 0.01)
    expect(end[0].y).toBeCloseTo(0.01)
    expect(end.at(-1)!.x).toBeCloseTo(-PAGE_WIDTH)
  })

  it('stands up and curls mid-turn, keeping the paper length', () => {
    const middle = bendProfile(0.5, 0.02, 0.02)
    expect(Math.max(...middle.map((point) => point.y))).toBeGreaterThan(0.3)
    let length = 0
    for (let i = 1; i < middle.length; i += 1) length += Math.hypot(middle[i].x - middle[i - 1].x, middle[i].y - middle[i - 1].y)
    expect(length).toBeCloseTo(PAGE_WIDTH)
  })
})

describe('blockHeights', () => {
  it('keeps half the pages on each side, so the page surfaces never move between turns', () => {
    const { left, right } = blockHeights()
    expect(left).toBe(right)
    expect(left + right).toBeCloseTo(BLOCK)
  })
})
