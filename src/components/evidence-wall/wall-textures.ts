import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'
import type { ContentTextBlock } from '@/components/editor/content-text'
import { hash, seeded } from '@/lib/canvas/seeded'

/**
 * Texturas da parede de evidências, todas desenhadas em código (nada é baixado): parede de reboco,
 * polaroides, notas adesivas, folhas datilografadas e a sombra de folhagem que a luz projeta.
 */
export type WallFonts = { hand: string; type: string }

export { hash, seeded }

export function canvas(width: number, height: number) {
  const element = document.createElement('canvas')
  element.width = width
  element.height = height
  return { element, c: element.getContext('2d')! }
}
export function texture(element: HTMLCanvasElement, anisotropy = 4): Texture {
  const t = new CanvasTexture(element)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = anisotropy
  return t
}

export function grain(c: CanvasRenderingContext2D, w: number, h: number, count: number, seed: number, alpha: number) {
  const random = seeded(seed)
  for (let i = 0; i < count; i++) {
    const v = random() < 0.5 ? 0 : 255
    c.fillStyle = `rgba(${v},${v},${v},${alpha * random()})`
    c.fillRect(random() * w, random() * h, 1 + random() * 2, 1 + random() * 2)
  }
}
export function stains(c: CanvasRenderingContext2D, w: number, h: number, count: number, seed: number, rgb: string, alpha: number, size: number) {
  const random = seeded(seed)
  for (let i = 0; i < count; i++) {
    const x = random() * w, y = random() * h, r = size * (0.4 + random())
    const g = c.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${rgb},${alpha * random()})`)
    g.addColorStop(1, `rgba(${rgb},0)`)
    c.fillStyle = g
    c.fillRect(x - r, y - r, r * 2, r * 2)
  }
}

/** Reboco cinza-quente, com manchas, poeira e algumas rachaduras finas. */
export function paintWall(width = 2048, height = 1164): Texture {
  const { element, c } = canvas(width, height)
  c.fillStyle = '#8a8378'
  c.fillRect(0, 0, width, height)
  stains(c, width, height, 140, 7, '60,54,46', 0.22, 160)
  stains(c, width, height, 90, 11, '170,162,150', 0.18, 120)
  grain(c, width, height, 60000, 3, 0.18)
  const random = seeded(19)
  c.strokeStyle = 'rgba(40,34,28,0.35)'
  c.lineWidth = 1.2
  for (let k = 0; k < 7; k++) {
    let x = random() * width, y = random() * height
    c.beginPath(); c.moveTo(x, y)
    for (let s = 0; s < 14; s++) { x += (random() - 0.5) * 60; y += random() * 28; c.lineTo(x, y) }
    c.stroke()
  }
  // Furos antigos de alfinete.
  for (let k = 0; k < 120; k++) { c.fillStyle = 'rgba(30,26,22,0.5)'; c.beginPath(); c.arc(random() * width, random() * height, 1.4, 0, Math.PI * 2); c.fill() }
  return texture(element, 8)
}

/** Sombra de galhos e folhas para a luz projetar na parede (branco passa luz, escuro faz sombra). */
export function paintLeafGobo(size = 1024): Texture {
  const { element, c } = canvas(size, size)
  c.fillStyle = '#fff'
  c.fillRect(0, 0, size, size)
  c.filter = 'blur(10px)'
  const random = seeded(41)
  c.fillStyle = '#111'
  c.strokeStyle = '#111'
  for (let b = 0; b < 5; b++) {
    let x = size * (0.15 + random() * 0.7), y = -20, angle = Math.PI / 2 + (random() - 0.5) * 0.8
    c.lineWidth = 6 + random() * 6
    for (let s = 0; s < 26; s++) {
      const nx = x + Math.cos(angle) * 30, ny = y + Math.sin(angle) * 30
      c.beginPath(); c.moveTo(x, y); c.lineTo(nx, ny); c.stroke()
      x = nx; y = ny; angle += (random() - 0.5) * 0.35
      for (let l = 0; l < 3; l++) {
        const lx = x + (random() - 0.5) * 90, ly = y + (random() - 0.5) * 90
        c.save(); c.translate(lx, ly); c.rotate(random() * Math.PI); c.beginPath(); c.ellipse(0, 0, 26 + random() * 18, 11 + random() * 7, 0, 0, Math.PI * 2); c.fill(); c.restore()
      }
    }
  }
  c.filter = 'none'
  const t = new CanvasTexture(element)
  return t
}

export function wrap(c: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word
      if (line && c.measureText(candidate).width > width) { lines.push(line); line = word } else line = candidate
    }
    lines.push(line)
  }
  return lines
}

/** Escreve linhas até o espaço acabar; a última que não cabe termina em reticências. */
export function writeLines(c: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number, bottom: number) {
  let cursor = y
  for (let i = 0; i < lines.length; i++) {
    if (cursor + lineHeight > bottom) {
      // O texto inteiro aparece no painel de leitura; na nota fica a indicação de que continua.
      if (i > 0 && cursor < bottom) c.fillText('…', x, cursor - lineHeight * 0.35)
      return bottom
    }
    c.fillText(lines[i], x, cursor)
    cursor += lineHeight
  }
  return cursor
}

/** Polaroide: moldura amarelada, foto com corte "cover" e legenda à mão. */
export function paintPolaroid(image: HTMLImageElement | null, caption: string, fonts: WallFonts, seedText: string, width = 660, height = 800): Texture {
  const { element, c } = canvas(width, height)
  c.fillStyle = '#efe9dc'
  c.fillRect(0, 0, width, height)
  stains(c, width, height, 10, hash(seedText), '150,120,70', 0.12, 120)
  grain(c, width, height, 5000, hash(seedText) + 1, 0.12)
  const pad = width * 0.07, photoW = width - pad * 2, photoH = height - pad - width * 0.26
  c.fillStyle = '#1d1b19'
  c.fillRect(pad, pad, photoW, photoH)
  if (image) {
    const scale = Math.max(photoW / image.naturalWidth, photoH / image.naturalHeight)
    const dw = image.naturalWidth * scale, dh = image.naturalHeight * scale
    c.save()
    c.beginPath(); c.rect(pad, pad, photoW, photoH); c.clip()
    c.filter = 'sepia(0.18) contrast(1.05) saturate(0.85)'
    c.drawImage(image, pad + (photoW - dw) / 2, pad + (photoH - dh) * 0.15, dw, dh)
    c.restore()
  } else {
    c.fillStyle = 'rgba(255,255,255,0.35)'
    c.font = `${width * 0.05}px ${fonts.type}`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('sem fotografia', width / 2, pad + photoH / 2)
  }
  c.fillStyle = '#2a2622'
  c.font = `${width * 0.085}px ${fonts.hand}`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  const words = caption.length > 26 ? `${caption.slice(0, 25)}…` : caption
  c.fillText(words, width / 2, pad + photoH + (height - pad - photoH) / 2)
  return texture(element)
}

export const NOTE_COLORS = ['#e8d27a', '#e9b8a8', '#b9d3c2', '#bcd0e3', '#e6c79a'] as const

/** Nota adesiva escrita à mão: título sublinhado e linhas que quebram até caber. */
export function paintNote(title: string, lines: Array<{ label?: string; text: string }>, color: string, fonts: WallFonts, size = 560): Texture {
  const { element, c } = canvas(size, size)
  c.fillStyle = color
  c.fillRect(0, 0, size, size)
  const shade = c.createLinearGradient(0, 0, 0, size)
  shade.addColorStop(0, 'rgba(0,0,0,0.10)'); shade.addColorStop(0.18, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.06)')
  c.fillStyle = shade
  c.fillRect(0, 0, size, size)
  grain(c, size, size, 3000, hash(title), 0.1)
  const margin = size * 0.09
  c.fillStyle = '#2b2925'
  c.textBaseline = 'top'
  c.font = `${size * 0.085}px ${fonts.hand}`
  c.fillText(title, margin, margin * 0.8)
  const titleWidth = Math.min(c.measureText(title).width, size - margin * 2)
  c.strokeStyle = 'rgba(43,41,37,0.75)'; c.lineWidth = 2.5
  c.beginPath(); c.moveTo(margin, margin * 0.8 + size * 0.1); c.quadraticCurveTo(margin + titleWidth / 2, margin * 0.8 + size * 0.115, margin + titleWidth, margin * 0.8 + size * 0.098); c.stroke()
  let y = margin * 0.8 + size * 0.15
  const lineHeight = size * 0.072, bottom = size - margin * 0.7
  for (const line of lines) {
    if (line.label) {
      c.font = `bold ${size * 0.052}px ${fonts.hand}`
      if (y + lineHeight > bottom) break
      c.fillText(line.label.toUpperCase(), margin, y)
      y += lineHeight * 0.8
    }
    c.font = `${size * 0.062}px ${fonts.hand}`
    y = writeLines(c, wrap(c, line.text, size - margin * 2), margin, y, lineHeight, bottom) + lineHeight * 0.25
    if (y >= bottom) break
  }
  return texture(element)
}

export const SHEET_PX = { width: 1160, height: 1600 }
const SHEET_MARGIN = 110
const SHEET_FONT = 34
const SHEET_LINE = 50

export type SheetLine = { text: string; weight: 'normal' | 'bold'; indent: number; gap?: boolean }

/**
 * Quebra o conteúdo de uma página em folhas do tamanho de um papel: texto que não cabe vai para
 * uma folha nova em vez de esticar a folha (como pede o conceito da Evidência).
 */
export function paginateSheet(blocks: ContentTextBlock[], fonts: WallFonts): SheetLine[][] {
  const { c } = canvas(4, 4)
  const width = SHEET_PX.width - SHEET_MARGIN * 2
  const usable = SHEET_PX.height - SHEET_MARGIN * 2 - 140
  const perSheet = Math.floor(usable / SHEET_LINE)
  const lines: SheetLine[] = []
  for (const block of blocks) {
    const bold = block.kind === 'heading'
    const indent = block.kind === 'item' ? 36 : block.kind === 'quote' ? 48 : 0
    c.font = `${bold ? 'bold ' : ''}${SHEET_FONT}px ${fonts.type}`
    const wrapped = wrap(c, block.kind === 'item' ? `– ${block.text}` : block.text, width - indent)
    wrapped.forEach((text, i) => lines.push({ text, weight: bold ? 'bold' : 'normal', indent, gap: i === 0 && lines.length > 0 }))
  }
  const sheets: SheetLine[][] = []
  let current: SheetLine[] = [], used = 0
  for (const line of lines) {
    const cost = line.gap ? 1.4 : 1
    if (used + cost > perSheet && current.length) { sheets.push(current); current = []; used = 0 }
    current.push(current.length ? line : { ...line, gap: false })
    used += current.length === 1 ? 1 : cost
  }
  if (current.length || sheets.length === 0) sheets.push(current)
  return sheets
}

/** Folha de relatório datilografada, com cabeçalho, linhas e número da folha. */
export function paintSheet(title: string, lines: SheetLine[], page: number, total: number, fonts: WallFonts, seedText: string, heading = 'RELATÓRIO DE EVIDÊNCIA'): Texture {
  const { width, height } = SHEET_PX
  const { element, c } = canvas(width, height)
  c.fillStyle = '#f1ece1'
  c.fillRect(0, 0, width, height)
  stains(c, width, height, 14, hash(seedText), '150,125,80', 0.1, 220)
  grain(c, width, height, 14000, hash(seedText) + 2, 0.1)
  c.strokeStyle = 'rgba(160,60,50,0.35)'; c.lineWidth = 2
  c.beginPath(); c.moveTo(SHEET_MARGIN * 0.65, 0); c.lineTo(SHEET_MARGIN * 0.65, height); c.stroke()
  c.fillStyle = '#26231f'
  c.textBaseline = 'top'
  c.font = `${SHEET_FONT * 0.8}px ${fonts.type}`
  c.fillText(heading, SHEET_MARGIN, SHEET_MARGIN * 0.6)
  c.textAlign = 'right'
  c.fillText(`fl. ${page}/${total}`, width - SHEET_MARGIN, SHEET_MARGIN * 0.6)
  c.textAlign = 'left'
  c.font = `bold ${SHEET_FONT * 1.25}px ${fonts.type}`
  c.fillText(title.toUpperCase(), SHEET_MARGIN, SHEET_MARGIN * 0.6 + 58)
  c.strokeStyle = 'rgba(38,35,31,0.6)'; c.lineWidth = 2
  c.beginPath(); c.moveTo(SHEET_MARGIN, SHEET_MARGIN + 100); c.lineTo(width - SHEET_MARGIN, SHEET_MARGIN + 100); c.stroke()
  let y = SHEET_MARGIN + 130
  for (const line of lines) {
    if (line.gap) y += SHEET_LINE * 0.4
    c.font = `${line.weight === 'bold' ? 'bold ' : ''}${SHEET_FONT}px ${fonts.type}`
    // Tinta de máquina de escrever: cada linha um pouco desalinhada e com intensidade variável.
    const random = seeded(hash(line.text) + y)
    c.globalAlpha = 0.82 + random() * 0.18
    c.fillText(line.text, SHEET_MARGIN + line.indent + (random() - 0.5) * 2, y + (random() - 0.5) * 1.5)
    c.globalAlpha = 1
    y += SHEET_LINE
  }
  if (lines.length === 0) {
    c.font = `${SHEET_FONT}px ${fonts.type}`
    c.globalAlpha = 0.5
    c.fillText('(sem texto)', SHEET_MARGIN, y)
    c.globalAlpha = 1
  }
  return texture(element)
}
