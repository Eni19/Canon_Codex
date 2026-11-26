import { leafPose } from './page-turn'

/**
 * World layout of the 3D notebook (metres-ish units). The spine runs along the z axis at x = 0; the
 * left page spans x ∈ [-PAGE_WIDTH, 0] and the right page x ∈ [0, PAGE_WIDTH]; z runs from the top
 * of the page (-PAGE_DEPTH / 2) to the bottom (+PAGE_DEPTH / 2); y is up from the desk.
 */
export const PAGE_WIDTH = 0.6
export const PAGE_DEPTH = 0.82
export const BOARD = 0.008
export const BLOCK = 0.03
/** Columns the turning page is split into; enough for a smooth curl. */
export const BEND_SEGMENTS = 32

/**
 * Cross-section of the turning page: points from the spine to the free edge, in the x–y plane.
 * It follows the same curl as the 2D leaf (`leafPose`), so a drag feels the same: progress 0 lies
 * flat on the right page, 1 flat on the left. The spine lifts from `rightY` to `leftY` as it turns,
 * because the two page blocks differ in height.
 */
export function bendProfile(progress: number, rightY: number, leftY: number, segments = BEND_SEGMENTS): { x: number; y: number }[] {
  const pose = leafPose(progress, segments)
  const toRadians = Math.PI / 180
  const spine = pose.spine * toRadians
  const step = pose.step * toRadians
  const length = PAGE_WIDTH / segments
  const points = [{ x: 0, y: rightY + (leftY - rightY) * progress }]
  for (let i = 0; i < segments; i += 1) {
    const angle = spine - (i + 0.5) * step
    const last = points[points.length - 1]
    points.push({ x: last.x + Math.cos(angle) * length, y: last.y + Math.sin(angle) * length })
  }
  return points
}

/**
 * Thickness of each page block: half the pages on each side, always. Letting the read pages pile up
 * on the left moved the page surfaces after every turn, and the pages visibly re-settled each time.
 */
export function blockHeights(): { left: number; right: number } {
  return { left: BLOCK / 2, right: BLOCK / 2 }
}
