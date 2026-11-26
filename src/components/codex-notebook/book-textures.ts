import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace } from 'three'

/**
 * Canvas-painted textures for the 3D notebook (cover, endpapers, page edges). Colours come
 * from the --nb-* tokens in globals.css (ADR-005); tokens are oklch, so each one is painted on a
 * 1×1 canvas and read back as sRGB.
 */
const TOKENS = ['desk', 'desk-deep', 'felt', 'felt-deep', 'pen', 'lamp', 'fill', 'paper', 'paper-shade', 'paper-aged', 'card', 'ink', 'cover', 'cover-deep', 'brass', 'red'] as const
export type NotebookToken = (typeof TOKENS)[number]

export interface NotebookPalette {
  css: Record<NotebookToken, string>
  color: Record<NotebookToken, Color>
}

export function readNotebookPalette(host: HTMLElement): NotebookPalette {
  const probe = document.createElement('canvas')
  probe.width = probe.height = 1
  const context = probe.getContext('2d', { willReadFrequently: true })
  const style = getComputedStyle(host)
  const toCss = (token: string) => {
    const value = style.getPropertyValue(`--nb-${token}`).trim()
    if (!context || !value) return 'rgb(128, 128, 128)'
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = value
    context.fillRect(0, 0, 1, 1)
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    return `rgb(${r}, ${g}, ${b})`
  }
  const css = Object.fromEntries(TOKENS.map((token) => [token, toCss(token)])) as Record<NotebookToken, string>
  const color = Object.fromEntries(TOKENS.map((token) => [token, new Color().setStyle(css[token], SRGBColorSpace)])) as Record<NotebookToken, Color>
  return { css, color }
}

function paint(width: number, height: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context) draw(context, width, height)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function seeded(seed: number) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function speckle(c: CanvasRenderingContext2D, w: number, h: number, count: number, seed: number, alpha = 0.05) {
  const next = seeded(seed)
  for (let i = 0; i < count; i += 1) {
    c.fillStyle = next() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha * 1.4})`
    c.fillRect(next() * w, next() * h, 1 + next() * 2.5, 1 + next() * 2.5)
  }
}

/**
 * Irregular blotches: random values on a coarse grid, scaled up smoothly, so they spread into soft
 * stains. Raising the values to a power keeps most of the surface clean and the stains in patches.
 */
function blotches(c: CanvasRenderingContext2D, w: number, h: number, cells: number, seed: number, rgb: [number, number, number], strength: number, sparsity = 3) {
  const grid = document.createElement('canvas')
  grid.width = cells
  grid.height = Math.max(1, Math.round((cells * h) / w))
  const context = grid.getContext('2d')
  if (!context) return
  const next = seeded(seed)
  const image = context.createImageData(grid.width, grid.height)
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = rgb[0]
    image.data[i + 1] = rgb[1]
    image.data[i + 2] = rgb[2]
    image.data[i + 3] = Math.round(Math.pow(next(), sparsity) * 255 * strength)
  }
  context.putImageData(image, 0, 0)
  c.save()
  c.imageSmoothingEnabled = true
  c.imageSmoothingQuality = 'high'
  c.drawImage(grid, 0, 0, w, h)
  c.restore()
}

const rgbOf = (css: string): [number, number, number] => {
  const [r, g, b] = (css.match(/\d+/g) ?? ['0', '0', '0']).map(Number)
  return [r, g, b]
}

/** Worn leather, after a well-used notebook cover: stains in three sizes, rubbed edges and grain. */
function paintWornLeather(c: CanvasRenderingContext2D, w: number, h: number, css: NotebookPalette['css'], seed: number) {
  const gradient = c.createLinearGradient(0, 0, w, h)
  gradient.addColorStop(0, css.cover)
  gradient.addColorStop(1, css['cover-deep'])
  c.fillStyle = gradient
  c.fillRect(0, 0, w, h)
  const deep = rgbOf(css['cover-deep'])
  const dark: [number, number, number] = [Math.round(deep[0] * 0.6), Math.round(deep[1] * 0.6), Math.round(deep[2] * 0.6)]
  blotches(c, w, h, 14, seed, dark, 0.55, 2.2)
  blotches(c, w, h, 46, seed + 1, dark, 0.6, 3)
  blotches(c, w, h, 160, seed + 2, dark, 0.5, 4)
  blotches(c, w, h, 30, seed + 3, rgbOf(css.cover), 0.35, 2.5)
  // Rubbed edges, lighter where hands hold the book.
  for (const [x0, y0, x1, y1] of [[0, 0, 60, 0], [w, 0, w - 60, 0], [0, 0, 0, 60], [0, h, 0, h - 60]] as const) {
    const edge = c.createLinearGradient(x0, y0, x1, y1)
    edge.addColorStop(0, 'rgba(255,220,190,0.14)')
    edge.addColorStop(1, 'rgba(255,220,190,0)')
    c.fillStyle = edge
    c.fillRect(0, 0, w, h)
  }
  speckle(c, w, h, 30000, seed + 4, 0.05)
}

/** Back cover and spine: the same worn leather, without the label. */
export function paintLeather({ css }: NotebookPalette) {
  return paint(600, 820, (c, w, h) => paintWornLeather(c, w, h, css, 31))
}

/** The leather front cover: worn leather, a gilt line by the spine, brass corners, the band and a label. */
export function paintCover({ css }: NotebookPalette, worldName: string, recordLine: string, serif: string, type: string) {
  return paint(1200, 1640, (c, w, h) => {
    paintWornLeather(c, w, h, css, 7)
    // A gilt line running down by the spine, worn in places.
    c.save()
    c.globalAlpha = 0.55
    c.fillStyle = css.brass
    c.fillRect(46, 0, 10, h)
    c.restore()
    blotches(c, w, h, 160, 17, rgbOf(css['cover-deep']), 0.9, 3)
    // Brass corners.
    c.fillStyle = css.brass
    for (const [x, y, dx, dy] of [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]]) {
      c.beginPath()
      c.moveTo(x, y)
      c.lineTo(x + dx * 108, y)
      c.lineTo(x, y + dy * 108)
      c.closePath()
      c.fill()
    }
    // Elastic band.
    c.fillStyle = css['desk-deep']
    c.fillRect(w - 150, 0, 28, h)
    // Pasted label.
    c.save()
    c.translate(180, 250)
    c.rotate(-0.026)
    c.shadowColor = 'rgba(0,0,0,0.35)'
    c.shadowBlur = 18
    c.shadowOffsetY = 10
    c.fillStyle = css.paper
    c.fillRect(0, 0, 740, 300)
    c.shadowColor = 'transparent'
    c.fillStyle = css.red
    c.font = `26px ${type}`
    c.fillText('C A N O N   C O D E X', 48, 72)
    c.fillStyle = css.ink
    let size = 84
    do {
      c.font = `600 ${size}px ${serif}`
      size -= 4
    } while (c.measureText(worldName).width > 650 && size > 36)
    c.fillText(worldName, 46, 176)
    c.fillStyle = css['paper-aged']
    c.fillRect(46, 206, 640, 3)
    c.fillStyle = css.ink
    c.globalAlpha = 0.7
    c.font = `30px ${type}`
    c.fillText(recordLine, 48, 258)
    c.restore()
  })
}

/** Inside of the cover: a marbled endpaper in the cover's colours. */
export function paintEndpaper({ css }: NotebookPalette) {
  return paint(600, 820, (c, w, h) => {
    c.fillStyle = css['cover-deep']
    c.fillRect(0, 0, w, h)
    const next = seeded(19)
    c.globalAlpha = 0.16
    for (let i = 0; i < 90; i += 1) {
      c.strokeStyle = next() > 0.5 ? css.brass : css.cover
      c.lineWidth = 2 + next() * 6
      c.beginPath()
      const y = next() * h
      c.moveTo(0, y)
      c.bezierCurveTo(w * 0.3, y + (next() - 0.5) * 120, w * 0.7, y + (next() - 0.5) * 120, w, y + (next() - 0.5) * 60)
      c.stroke()
    }
  })
}

/** Size of the desk top, in scene units; its picture covers it once, without repeating seams. */
export const DESK_SIZE = { width: 4.4, depth: 3 }

/**
 * Dark walnut, close-grained: long fine grain lines in two tones, a few broad darker streaks of
 * figure, and faint joints between wide boards. Low in contrast, so it stays in the background.
 */
export function paintDesk({ css }: NotebookPalette) {
  return paint(2048, Math.round((2048 * DESK_SIZE.depth) / DESK_SIZE.width), (c, w, h) => {
    c.fillStyle = css.desk
    c.fillRect(0, 0, w, h)
    const deep = rgbOf(css['desk-deep'])
    blotches(c, w, h, 9, 41, deep, 0.55, 1.6)
    const next = seeded(23)
    // Broad streaks of figure, running with the grain.
    for (let i = 0; i < 14; i += 1) {
      const y = next() * h
      const band = c.createLinearGradient(0, y - 40, 0, y + 40)
      band.addColorStop(0, 'rgba(0,0,0,0)')
      band.addColorStop(0.5, `rgba(${deep.join(',')},${0.18 + next() * 0.2})`)
      band.addColorStop(1, 'rgba(0,0,0,0)')
      c.fillStyle = band
      c.fillRect(0, y - 40, w, 80)
    }
    // Fine grain: many thin, gently wavy lines, darker and lighter.
    for (let i = 0; i < 900; i += 1) {
      const y = next() * h
      const amplitude = 1 + next() * 5
      const phase = next() * Math.PI * 2
      const wave = 180 + next() * 320
      const start = next() * w * 0.6 - w * 0.1
      const length = w * (0.3 + next() * 0.8)
      c.strokeStyle = next() > 0.3 ? `rgba(0,0,0,${0.04 + next() * 0.06})` : `rgba(255,226,190,${0.02 + next() * 0.025})`
      c.lineWidth = 0.6 + next() * 1.4
      c.beginPath()
      for (let x = start; x <= start + length; x += 24) {
        const yy = y + Math.sin(x / wave + phase) * amplitude
        if (x === start) c.moveTo(x, yy)
        else c.lineTo(x, yy)
      }
      c.stroke()
    }
    // Pores: tiny dashes along the grain.
    for (let i = 0; i < 9000; i += 1) {
      c.fillStyle = `rgba(0,0,0,${0.08 + next() * 0.1})`
      c.fillRect(next() * w, next() * h, 2 + next() * 6, 1)
    }
    // Faint joints between three wide boards.
    for (const at of [0.18, 0.5, 0.82]) {
      c.fillStyle = 'rgba(0,0,0,0.35)'
      c.fillRect(0, at * h, w, 2)
      c.fillStyle = 'rgba(255,226,190,0.04)'
      c.fillRect(0, at * h + 2, w, 1)
    }
  })
}

/** Size of the felt pad under the notebook, in scene units, and the x of its centre. */
export const PAD = { width: 1.92, depth: 1.04, x: 0.2 }

/** Green felt desk pad: fine fibres, soft mottling, a darker border band with a sewn stitch. */
export function paintPad({ css }: NotebookPalette) {
  const scale = 1100
  return paint(Math.round(PAD.width * scale), Math.round(PAD.depth * scale), (c, w, h) => {
    c.fillStyle = css.felt
    c.fillRect(0, 0, w, h)
    const deep = rgbOf(css['felt-deep'])
    blotches(c, w, h, 12, 61, deep, 0.45, 2)
    blotches(c, w, h, 60, 62, deep, 0.35, 3)
    speckle(c, w, h, 60000, 63, 0.05)
    // A darker band around the edge.
    const band = 34
    c.fillStyle = css['felt-deep']
    c.globalAlpha = 0.75
    c.fillRect(0, 0, w, band)
    c.fillRect(0, h - band, w, band)
    c.fillRect(0, 0, band, h)
    c.fillRect(w - band, 0, band, h)
    c.globalAlpha = 1
    // Stitching: short dashes of pale thread, slightly uneven.
    const next = seeded(64)
    const inset = band - 12
    c.strokeStyle = 'rgba(232,214,180,0.42)'
    c.lineWidth = 2.4
    c.lineCap = 'round'
    const stitch = (x0: number, y0: number, x1: number, y1: number) => {
      const length = Math.hypot(x1 - x0, y1 - y0)
      const count = Math.floor(length / 16)
      for (let i = 0; i < count; i += 1) {
        const t0 = i / count
        const t1 = t0 + 9 / length
        const jitter = (next() - 0.5) * 1.2
        c.beginPath()
        c.moveTo(x0 + (x1 - x0) * t0 + jitter, y0 + (y1 - y0) * t0 + jitter)
        c.lineTo(x0 + (x1 - x0) * t1 + jitter, y0 + (y1 - y0) * t1 + jitter)
        c.stroke()
      }
    }
    stitch(inset, inset, w - inset, inset)
    stitch(w - inset, inset, w - inset, h - inset)
    stitch(w - inset, h - inset, inset, h - inset)
    stitch(inset, h - inset, inset, inset)
    // Worn, darker rim at the very edge.
    c.strokeStyle = 'rgba(0,0,0,0.35)'
    c.lineWidth = 6
    c.strokeRect(3, 3, w - 6, h - 6)
  })
}

/** Page edges seen on the side of the page block: fine horizontal lines of paper. */
export function paintPageEdges({ css }: NotebookPalette) {
  const texture = paint(64, 256, (c, w, h) => {
    c.fillStyle = css.paper
    c.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 3) {
      c.fillStyle = y % 6 ? css['paper-shade'] : css['paper-aged']
      c.fillRect(0, y, w, 1)
    }
  })
  texture.wrapS = texture.wrapT = RepeatWrapping
  return texture
}
