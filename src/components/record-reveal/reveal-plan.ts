/**
 * The "text mask" transition from a record in the notebook to its page: the record's name, in huge
 * letters, darkens the screen; the letters then become windows onto the new page, and the view dives
 * into one of them until the page fills the screen. This module holds the pure parts: where to dive
 * (the thickest stroke near the middle), how far, and what every element looks like at a time.
 */

export interface RevealWindow {
  /** Point inside a letter, in screen pixels: the zoom is centred on it. */
  x: number
  y: number
  /** Distance from that point to the letter's edge, in screen pixels. */
  radius: number
}

/**
 * Finds the point deepest inside the letters, slightly preferring the middle of the word, so the dive
 * lands in a thick stroke and the page is revealed without the letter's edges sweeping across.
 * `inside` is a w × h bitmap (1 inside a letter); distances are chamfer (3-4) approximations.
 */
export function findWindow(inside: Uint8Array, w: number, h: number): RevealWindow | null {
  const far = 1e9
  const d = new Float32Array(w * h)
  for (let i = 0; i < d.length; i += 1) d[i] = inside[i] ? far : 0
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x])
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x
      if (d[i] === 0) continue
      d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4)
    }
  }
  for (let y = h - 1; y >= 0; y -= 1) {
    for (let x = w - 1; x >= 0; x -= 1) {
      const i = y * w + x
      if (d[i] === 0) continue
      d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4)
    }
  }
  let best: RevealWindow | null = null
  let bestScore = 0
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const radius = d[y * w + x] / 3
      if (radius <= 0) continue
      const score = radius * (1 - (0.35 * Math.abs(x - w / 2)) / (w / 2))
      if (score > bestScore) {
        bestScore = score
        best = { x, y, radius }
      }
    }
  }
  return best
}

/** How much the letters must grow, around `window`, before the letter covers the whole screen. */
export function zoomFor(window: RevealWindow, width: number, height: number): number {
  const corners = [[0, 0], [width, 0], [0, height], [width, height]]
  const reach = Math.max(...corners.map(([cx, cy]) => Math.hypot(cx - window.x, cy - window.y)))
  return Math.min(600, Math.max(1, (reach / Math.max(1, window.radius)) * 1.08))
}

/** Font size that sets the word across most of the screen, without growing taller than half of it. */
export function fitSize(widthAt100: number, width: number, height: number): number {
  return Math.min((width * 0.86 * 100) / Math.max(1, widthAt100), height * 0.46)
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** Timings, in milliseconds. */
export const REVEAL = {
  /** The screen darkens. */
  darken: 280,
  /** The name rises into place. */
  riseFrom: 60,
  riseFor: 520,
  /** The name stays at least this long, even when the page is ready sooner. */
  hold: 700,
  /** The paper inside the letters dissolves, from the bottom up, onto the new page. */
  wipe: 650,
  /** The dive starts this far into the wipe, so the two run together instead of in steps. */
  diveFrom: 0.55,
  /** The dive into the letter. */
  dive: 900,
  /** Without a new page by then, the transition gives up and fades away. */
  giveUp: 10000,
} as const

/** Height of the wipe's soft edge, as a fraction of the word's height. */
export const WIPE_FEATHER = 0.45

export interface RevealFrame {
  /** Opacity of the dark screen around the letters. */
  backdrop: number
  /** How far below its place the name is (pixels). */
  rise: number
  /** Opacity of the paper filling the letters. */
  fill: number
  /**
   * How far the paper has dissolved, from the bottom of the word up (0: whole, 1: gone; the soft
   * edge, `WIPE_FEATHER` high, travels past the top before it is quite gone).
   */
  wipe: number
  /** Whether the letters are windows onto the page (under the paper, until it dissolves). */
  open: boolean
  /** Scale of the letters around the window point. */
  zoom: number
  done: boolean
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const smooth = (t: number) => t * t * (3 - 2 * t)
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * What the transition looks like `t` ms after it started. `arrived` is when the new page was shown
 * (ms after the start), or null while it is still loading; `zoom` is the dive's final scale.
 *
 * The letters open onto the page in one step, hidden under their paper, and only the paper then
 * dissolves: fading the paper and opening the dark mask at once dimmed the letters for a moment,
 * which read as an abrupt swap.
 */
export function revealFrame(t: number, arrived: number | null, zoom: number): RevealFrame {
  const shown = clamp(t / REVEAL.darken)
  const rise = 46 * (1 - easeOut(clamp((t - REVEAL.riseFrom) / REVEAL.riseFor)))
  // The letters fade in as they rise, a beat after the screen starts to darken.
  const appear = clamp((t - REVEAL.riseFrom) / (REVEAL.riseFor * 0.6))
  if (arrived === null) {
    if (t > REVEAL.giveUp) {
      const out = clamp((t - REVEAL.giveUp) / 300)
      return { backdrop: 1 - out, rise, fill: 1 - out, wipe: 0, open: false, zoom: 1, done: out >= 1 }
    }
    return { backdrop: shown, rise, fill: appear, wipe: 0, open: false, zoom: 1, done: false }
  }
  const start = Math.max(arrived, REVEAL.hold)
  const wiping = clamp((t - start) / REVEAL.wipe)
  const diving = clamp((t - start - REVEAL.wipe * REVEAL.diveFrom) / REVEAL.dive)
  // The scale grows exponentially, so the dive feels like a steady push forward rather than a jump.
  const scale = Math.exp(Math.log(zoom) * smooth(diving) * smooth(diving))
  const fadeOut = clamp((diving - 0.75) / 0.25)
  return {
    backdrop: shown * (1 - fadeOut),
    rise,
    // A light fade on top of the wipe, ending fully transparent: nothing of the paper is left.
    fill: appear * (1 - smooth(wiping)),
    wipe: easeInOut(wiping),
    open: t >= start,
    zoom: scale,
    done: diving >= 1 && wiping >= 1,
  }
}
