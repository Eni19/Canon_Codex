import { domToCanvas } from 'modern-screenshot'
import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'

/**
 * Pictures of the notebook's HTML pages, for the 3D book. While a page lies still, the real HTML is
 * shown on top of it (sharp and clickable); while it moves, the 3D page wears its picture. Pictures
 * are taken from an off-screen copy of each page and kept by key (`<spread id>:<side>`).
 *
 * They are taken at the size the page has on screen and drawn without mipmaps, so the picture and
 * the HTML look the same: a larger picture, scaled down through mipmaps, read as blurrier, and
 * costs memory that, page after page, ended in a lost WebGL context (a black book).
 */
/**
 * Whether a picture actually shows the page. The whole picture is shrunk to 32 × 32 and its colours
 * counted: a real page always carries its ruling, text and page number, so it has several; a failed
 * snapshot is one flat colour (the paper background, or transparent). Sampling a few points was not
 * enough: on sparse pages they all landed on plain paper, and good pictures were thrown away.
 */
function hasContent(canvas: HTMLCanvasElement): boolean {
  if (canvas.width < 8 || canvas.height < 8) return false
  const probe = document.createElement('canvas')
  probe.width = probe.height = 32
  const context = probe.getContext('2d', { willReadFrequently: true })
  if (!context) return true
  context.drawImage(canvas, 0, 0, 32, 32)
  const pixels = context.getImageData(0, 0, 32, 32).data
  const colours = new Set<number>()
  let opaque = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] > 200) opaque += 1
    colours.add(((pixels[i] >> 3) << 10) | ((pixels[i + 1] >> 3) << 5) | (pixels[i + 2] >> 3))
  }
  return opaque > 900 && colours.size >= 4
}

export class PageTextures {
  private readonly pending = new Map<string, Promise<CanvasTexture | null>>()
  private readonly ready = new Map<string, CanvasTexture>()
  /** One ticket per capture, so a picture finished after its key was released is thrown away. */
  private readonly tickets = new Map<string, symbol>()

  get(key: string): CanvasTexture | null {
    return this.ready.get(key) ?? null
  }

  has(key: string): boolean {
    return this.pending.has(key)
  }

  /**
   * `scale` is device pixels per CSS pixel of the page's HTML, as it is shown on screen; `paper` is
   * the colour drawn behind the page, so a picture never has transparent (black-looking) areas.
   */
  capture(key: string, element: HTMLElement, scale: number, paper: string): Promise<CanvasTexture | null> {
    const existing = this.pending.get(key)
    if (existing) return existing
    // A copy that has left the page cannot be pictured (it measures 0 × 0); the caller retries with
    // the copy that replaced it.
    if (!element.isConnected) return Promise.resolve(null)
    const ticket = Symbol(key)
    this.tickets.set(key, ticket)
    const job = (async () => {
      await document.fonts.ready
      await Promise.all([...element.querySelectorAll('img')].map((image) => image.complete ? null : new Promise((done) => {
        image.addEventListener('load', done, { once: true })
        image.addEventListener('error', done, { once: true })
      })))
      try {
        // Firefox (and Zen) sometimes paints the page's SVG snapshot before it has decoded, giving an
        // empty picture: on a page it looked black. Such pictures are retaken, a little later each time.
        let canvas: HTMLCanvasElement | null = null
        for (let attempt = 0; attempt < 4 && !canvas && element.isConnected; attempt += 1) {
          if (attempt > 0) await new Promise((done) => window.setTimeout(done, 120 * attempt))
          const shot = await domToCanvas(element, { scale, width: element.offsetWidth, height: element.offsetHeight, backgroundColor: paper })
          if (hasContent(shot)) canvas = shot
        }
        // The key may have been released while the picture was being taken.
        if (!canvas || this.tickets.get(key) !== ticket) {
          if (!canvas) this.pending.delete(key)
          return null
        }
        const texture = new CanvasTexture(canvas)
        texture.colorSpace = SRGBColorSpace
        texture.generateMipmaps = false
        texture.minFilter = LinearFilter
        texture.magFilter = LinearFilter
        this.ready.set(key, texture)
        return texture
      } catch {
        // A failed picture only costs the moving page its print; the page itself still works.
        this.pending.delete(key)
        return null
      }
    })()
    this.pending.set(key, job)
    return job
  }

  /** Frees every picture whose key is not in `keep`; returns the keys it released. */
  retain(keep: Set<string>): string[] {
    const released: string[] = []
    for (const key of [...this.pending.keys()]) {
      if (keep.has(key)) continue
      this.ready.get(key)?.dispose()
      this.ready.delete(key)
      this.pending.delete(key)
      this.tickets.delete(key)
      released.push(key)
    }
    return released
  }

  /** Drops every picture, e.g. when the pages' content changes. */
  clear() {
    for (const texture of this.ready.values()) texture.dispose()
    this.ready.clear()
    this.pending.clear()
    this.tickets.clear()
  }
}
