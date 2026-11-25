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
  /** Per strip, how much light its two edges lose (0 lit, ~0.6 in shadow). */
  shading: { near: number; far: number }[]
}

export function leafPose(p: number, strips = STRIPS, curl = CURL): LeafPose {
  const t = clamp(p, 0, 1)
  const swing = Math.PI * t
  const bend = curl * Math.sin(Math.PI * t)
  const spine = swing + bend
  const step = (2 * bend) / strips
  const shading = Array.from({ length: strips }, (_, index) => ({
    near: (1 - Math.abs(Math.cos(spine - index * step))) * 0.6,
    far: (1 - Math.abs(Math.cos(spine - (index + 1) * step))) * 0.6,
  }))
  const degrees = 180 / Math.PI
  return { spine: spine * degrees, step: step * degrees, lift: Math.sin(Math.PI * t), shading }
}

/**
 * Where the leaf should be for a pointer at `x`: its free edge follows the pointer, so the pointer's
 * distance from the spine, as a fraction of the page width, is the cosine of the leaf's angle.
 */
export function progressFromPointer(x: number, spineX: number, pageWidth: number): number {
  const reach = clamp((x - spineX) / pageWidth, -1, 1)
  return Math.acos(reach) / Math.PI
}

/**
 * Where a released leaf settles. A quick flick wins over position, so a short fast throw still turns
 * the page. Otherwise the turn completes once the leaf has travelled `commit` of the way in the
 * direction it was dragged; a halfway rule makes ordinary drags spring back, which reads as a bug.
 */
export function settleTarget(p: number, velocity: number, direction: 'next' | 'prev', commit = 0.35, flick = 1.2): 0 | 1 {
  if (velocity > flick) return 1
  if (velocity < -flick) return 0
  if (direction === 'next') return p >= commit ? 1 : 0
  return p <= 1 - commit ? 0 : 1
}

/** One step of a damped spring toward `target`; returns the new position and velocity. */
export function springStep(position: number, velocity: number, target: number, dt: number, stiffness = 150, damping = 22) {
  const nextVelocity = velocity + (-stiffness * (position - target) - damping * velocity) * dt
  return { position: position + nextVelocity * dt, velocity: nextVelocity }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
