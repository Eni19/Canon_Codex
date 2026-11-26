import type { Texture } from 'three'
import { canvas, grain, hash, seeded, stains, texture, wrap, writeLines, type WallFonts } from '@/components/evidence-wall/wall-textures'

/**
 * Texturas da bancada de Objetos, desenhadas em código: tapete de corte com grade, chapa de metal da
 * mesa, foto técnica do objeto, visor do paquímetro e etiquetas.
 */

/** Tapete de corte escuro com grade fina, réguas nas bordas e marcas de uso. */
export function paintMat(width = 2300, height = 1300): Texture {
  const { element, c } = canvas(width, height)
  c.fillStyle = '#26292b'
  c.fillRect(0, 0, width, height)
  stains(c, width, height, 60, 5, '70,76,80', 0.25, 220)
  grain(c, width, height, 50000, 9, 0.12)
  const cell = width / 92, border = cell * 2.4
  // Grade: linhas finas a cada célula, mais fortes a cada cinco.
  for (let x = border, i = 0; x <= width - border + 0.5; x += cell, i++) {
    c.strokeStyle = i % 5 === 0 ? 'rgba(170,180,185,0.2)' : 'rgba(170,180,185,0.08)'
    c.lineWidth = i % 5 === 0 ? 1.6 : 1
    c.beginPath(); c.moveTo(x, border); c.lineTo(x, height - border); c.stroke()
  }
  for (let y = border, i = 0; y <= height - border + 0.5; y += cell, i++) {
    c.strokeStyle = i % 5 === 0 ? 'rgba(170,180,185,0.2)' : 'rgba(170,180,185,0.08)'
    c.lineWidth = i % 5 === 0 ? 1.6 : 1
    c.beginPath(); c.moveTo(border, y); c.lineTo(width - border, y); c.stroke()
  }
  // Réguas nas bordas, com números a cada dez.
  c.fillStyle = 'rgba(190,198,202,0.45)'
  c.font = `${cell * 0.55}px ui-monospace, monospace`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  for (let x = border, i = 0; x <= width - border + 0.5; x += cell, i++) {
    const long = i % 10 === 0 ? 0.9 : i % 5 === 0 ? 0.6 : 0.35
    c.fillRect(x - 0.75, border - cell * long, 1.5, cell * long)
    c.fillRect(x - 0.75, height - border, 1.5, cell * long)
    if (i % 10 === 0 && i > 0) c.fillText(String(i), x, border - cell * 1.5)
  }
  // Moldura em relevo arredondada.
  c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = cell * 0.5
  c.beginPath(); c.roundRect(cell * 0.6, cell * 0.6, width - cell * 1.2, height - cell * 1.2, cell * 1.6); c.stroke()
  c.strokeStyle = 'rgba(200,210,215,0.08)'; c.lineWidth = 2
  c.beginPath(); c.roundRect(cell * 0.9, cell * 0.9, width - cell * 1.8, height - cell * 1.8, cell * 1.4); c.stroke()
  // Riscos de estilete.
  const random = seeded(23)
  c.strokeStyle = 'rgba(210,215,220,0.07)'; c.lineWidth = 1.2
  for (let k = 0; k < 40; k++) {
    const x = random() * width, y = random() * height, a = random() * Math.PI, l = 40 + random() * 260
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke()
  }
  return texture(element, 8)
}

/** Chapa de metal escovado da mesa, em volta do tapete. */
export function paintTable(size = 1024): Texture {
  const { element, c } = canvas(size, size)
  c.fillStyle = '#4a4e51'
  c.fillRect(0, 0, size, size)
  const random = seeded(31)
  for (let k = 0; k < 2600; k++) {
    const y = random() * size, v = 70 + random() * 60
    c.strokeStyle = `rgba(${v},${v + 4},${v + 8},${0.05 + random() * 0.08})`
    c.lineWidth = 1
    c.beginPath(); c.moveTo(0, y); c.lineTo(size, y + (random() - 0.5) * 6); c.stroke()
  }
  stains(c, size, size, 30, 13, '20,22,24', 0.3, 140)
  grain(c, size, size, 20000, 17, 0.1)
  return texture(element, 8)
}

/** Onde fica a área da foto dentro da prancha, em frações da prancha (origem no canto de cima). */
export type PhotoRect = { x: number; y: number; w: number; h: number }
export const SPECIMEN_PX = { width: 1040, height: 900 }
export const SPECIMEN_PHOTO: PhotoRect = { x: 0.05, y: 0.06, w: 0.9, h: 0.9 * (1040 / 900) * 0.75 }

/**
 * Prancha fotográfica do objeto: fundo cinza de estúdio, foto inteira (sem corte, como na ficha,
 * para os pontos de detalhe caírem no lugar certo), escala e legenda técnica.
 */
export function paintSpecimen(image: HTMLImageElement | null, title: string, figure: string, fonts: WallFonts): Texture {
  const { width, height } = SPECIMEN_PX
  const { element, c } = canvas(width, height)
  c.fillStyle = '#eceae4'
  c.fillRect(0, 0, width, height)
  grain(c, width, height, 6000, hash(title), 0.08)
  const px = SPECIMEN_PHOTO.x * width, py = SPECIMEN_PHOTO.y * height, pw = SPECIMEN_PHOTO.w * width, ph = SPECIMEN_PHOTO.h * height
  const backdrop = c.createRadialGradient(px + pw / 2, py + ph * 0.42, 0, px + pw / 2, py + ph * 0.42, pw * 0.7)
  backdrop.addColorStop(0, '#d3d3cc'); backdrop.addColorStop(0.55, '#afb0ab'); backdrop.addColorStop(1, '#8d8f8c')
  c.fillStyle = backdrop
  c.fillRect(px, py, pw, ph)
  if (image) {
    const pad = pw * 0.07
    const scale = Math.min((pw - pad * 2) / image.naturalWidth, (ph - pad * 2) / image.naturalHeight)
    const dw = image.naturalWidth * scale, dh = image.naturalHeight * scale
    c.save()
    c.shadowColor = 'rgba(0,0,0,0.4)'; c.shadowBlur = 30; c.shadowOffsetY = 18
    c.drawImage(image, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh)
    c.restore()
  } else {
    c.fillStyle = 'rgba(40,40,40,0.45)'
    c.font = `${width * 0.03}px ${fonts.type}`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('objeto ainda não fotografado', px + pw / 2, py + ph / 2)
  }
  // Escala de referência e legenda.
  const below = py + ph + 22
  c.textAlign = 'left'; c.textBaseline = 'top'
  for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? '#eceae4' : '#26231f'; c.fillRect(px + i * 26, below, 26, 10) }
  c.strokeStyle = '#26231f'; c.lineWidth = 1.5; c.strokeRect(px, below, 260, 10)
  c.fillStyle = '#26231f'
  c.font = `${width * 0.02}px ${fonts.type}`
  c.fillText('escala de referência', px, below + 18)
  c.textAlign = 'right'
  c.fillText(`FIG. ${figure}`, px + pw, below)
  c.font = `bold ${width * 0.026}px ${fonts.type}`
  const name = title.length > 34 ? `${title.slice(0, 33)}…` : title
  c.fillText(name.toUpperCase(), px + pw, below + 26)
  return texture(element)
}

/** Visor de cristal líquido do paquímetro. */
export function paintLcd(value: string, unit: string, width = 512, height = 200): Texture {
  const { element, c } = canvas(width, height)
  const glass = c.createLinearGradient(0, 0, 0, height)
  glass.addColorStop(0, '#b9c3b0'); glass.addColorStop(1, '#a2ad99')
  c.fillStyle = glass
  c.fillRect(0, 0, width, height)
  c.fillStyle = 'rgba(30,36,28,0.07)'
  c.font = `bold ${height * 0.62}px ui-monospace, "Cascadia Mono", Consolas, monospace`
  c.textAlign = 'right'; c.textBaseline = 'middle'
  c.fillText('88,88', width * 0.8, height * 0.52)
  c.fillStyle = '#1f251c'
  c.fillText(value, width * 0.8, height * 0.52)
  c.font = `bold ${height * 0.2}px ui-monospace, monospace`
  c.textAlign = 'left'
  c.fillText(unit || '—', width * 0.83, height * 0.62)
  return texture(element)
}

/** Etiqueta: papel branco com borda vermelha, título e linhas datilografadas. */
export function paintLabel(title: string, lines: string[], fonts: WallFonts, width = 640, height = 282): Texture {
  const { element, c } = canvas(width, height)
  c.fillStyle = '#f4f1ea'
  c.fillRect(0, 0, width, height)
  grain(c, width, height, 2500, hash(title), 0.08)
  c.strokeStyle = '#a3302a'; c.lineWidth = 6
  c.strokeRect(14, 14, width - 28, height - 28)
  c.lineWidth = 2
  c.strokeRect(24, 24, width - 48, height - 48)
  c.fillStyle = '#a3302a'
  c.fillRect(24, 24, width - 48, 52)
  c.fillStyle = '#f4f1ea'
  c.font = `bold 34px ${fonts.type}`
  c.textBaseline = 'middle'
  c.fillText(title.toUpperCase(), 44, 51)
  c.fillStyle = '#26231f'
  c.font = `42px ${fonts.type}`
  c.textBaseline = 'top'
  const wrapped = lines.flatMap((line) => wrap(c, line, width - 88))
  writeLines(c, wrapped, 44, 96, 52, height - 30)
  return texture(element)
}

