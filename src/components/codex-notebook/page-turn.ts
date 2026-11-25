/**
 * Geometry of a turning leaf. The leaf is a chain of N strips hinged at the spine; each strip turns
 * a little less than the one before it, so the paper curves instead of swinging like a flat door.
 *
 * Progress `p` is the leaf's position: 0 lies flat on the right page, 1 lies flat on the left page.
 * Turning forward animates 0 → 1; turning back animates 1 → 0.
 */
export const STRIPS = 12
/** Peak curl at mid-turn, in radians. The leaf is flat at both ends. */
export const CURL = 0.62

export interface LeafPose {
  /** Rotation of the first strip at the spine, in degrees. */
  spine: number
  /** Rotation each next strip adds back, in degrees (positive unbends the curve). */
  step: number
  /** 0..1, how lifted the leaf is; drives the cast shadow on the pages beneath. */
  lift: number
  /** Per strip: light lost at its two edges (0 lit, ~0.6 in shadow), and how squarely it faces the light. */
  shading: { near: number; far: number; lit: number }[]
}

export function leafPose(p: number, strips = STRIPS, curl = CURL): LeafPose {
  const t = clamp(p, 0, 1)
  const swing = Math.PI * t
  const bend = curl * Math.sin(Math.PI * t)
  const spine = swing + bend
  const step = (2 * bend) / strips
  const shading = Array.from({ length: strips }, (_, index) => {
    const near = Math.abs(Math.cos(spine - index * step))
    const far = Math.abs(Math.cos(spine - (index + 1) * step))
    return { near: (1 - near) * 0.62, far: (1 - far) * 0.62, lit: near }
  })
  const degrees = 180 / Math.PI
  return { spine: spine * degrees, step: step * degrees, lift: Math.sin(Math.PI * t), shading }
}

/**
 * How far a drag has turned the leaf, from 0 (not at all) to 1 (all the way). Pulling the pointer
 * 80% of the book's width across turns the page completely, and the first part of the pull moves
 * the leaf less than the rest (an ease-in), so lifting a page takes a little effort, like paper.
 */
export function dragProgress(dx: number, bookWidth: number, direction: 'next' | 'prev'): number {
  const pulled = clamp((direction === 'next' ? -dx : dx) / (bookWidth * 0.8), 0, 1)
  return Math.pow(pulled, 1.35)
}

/**
 * Whether a released drag completes the turn: past 42% of the way, or thrown faster than `flick`
 * turns per second toward completion, even if it has barely moved.
 */
export function shouldComplete(turned: number, speed: number, threshold = 0.42, flick = 1.8): boolean {
  return turned > threshold || speed > flick
}

/**
 * Spring settings, critically damped so a page lands without bouncing. They are soft on purpose:
 * a page has weight, and a turn takes about half a second.
 */
export const COMMIT_SPRING = { stiffness: 95, damping: 19.5 }
export const CANCEL_SPRING = { stiffness: 85, damping: 18.5 }
/** How quickly a dragged leaf catches up with the pointer (per second); lower feels heavier. */
export const DRAG_FOLLOW = 11

/** One step of a damped spring toward `target`; returns the new position and velocity. */
export function springStep(position: number, velocity: number, target: number, dt: number, stiffness = 150, damping = 22) {
  const nextVelocity = velocity + (-stiffness * (position - target) - damping * velocity) * dt
  return { position: position + nextVelocity * dt, velocity: nextVelocity }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
