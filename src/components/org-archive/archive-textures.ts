import type { Texture } from 'three'
import { canvas, grain, hash, seeded, stains, texture, wrap, writeLines, type WallFonts } from '@/components/evidence-wall/wall-textures'

/**
 * Texturas da caixa-arquivo das Organizações, todas desenhadas em código: mesa de madeira, papelão
 * da caixa, etiqueta da tampa, índice colado por dentro da tampa e os documentos (dossiê, pastas dos
 * subgrupos, fichas dos membros e memorandos).
 */

const INK = '#26231f'
const STAMP = 'rgba(158,42,34,0.78)'

/** Corta a foto em "cover" dentro de um retângulo. */
function drawCover(c: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number, filter = 'sepia(0.25) contrast(1.05) saturate(0.8)') {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight)
  const dw = image.naturalWidth * scale, dh = image.naturalHeight * scale
  c.save()
  c.beginPath(); c.rect(x, y, w, h); c.clip()
  c.filter = filter
  c.drawImage(image, x + (w - dw) / 2, y + (h - dh) * 0.2, dw, dh)
  c.restore()
}

/** Carimbo inclinado com borda dupla e tinta falhada. */
function stamp(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, angle: number, fonts: WallFonts, seed: number) {
  c.save()
  c.translate(x, y); c.rotate(angle)
  c.font = `bold ${size}px ${fonts.type}`
  const w = c.measureText(text).width + size * 0.9, h = size * 1.5
  c.strokeStyle = STAMP; c.fillStyle = STAMP
  c.lineWidth = size * 0.09
  c.strokeRect(-w / 2, -h / 2, w, h)
  c.lineWidth = size * 0.04
  c.strokeRect(-w / 2 + size * 0.14, -h / 2 + size * 0.14, w - size * 0.28, h - size * 0.28)
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(text, 0, size * 0.06)
  // Falhas da tinta.
  c.globalCompositeOperation = 'destination-out'
  const random = seeded(seed)
  for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(0,0,0,${random() * 0.7})`; c.fillRect(-w / 2 + random() * w, -h / 2 + random() * h, 1 + random() * 5, 1 + random() * 3) }
  c.restore()
}

/** Clipe de metal visto de cima, segurando a foto no papel. */
function paperclip(c: CanvasRenderingContext2D, x: number, y: number, length: number) {
  c.save()
  c.strokeStyle = '#8d9296'; c.lineWidth = length * 0.06; c.lineCap = 'round'
  const w = length * 0.28
  c.beginPath()
  c.moveTo(x, y + length * 0.75)
  c.lineTo(x, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w, y + length)
  c.arc(x + w * 0.6, y + length, w * 0.4, 0, Math.PI); c.lineTo(x + w * 0.2, y + w * 0.6)
  c.stroke()
  c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = length * 0.018
  c.beginPath(); c.moveTo(x - length * 0.012, y + length * 0.7); c.lineTo(x - length * 0.012, y + w / 2); c.stroke()
  c.restore()
}

/** Tampo de madeira escura, com tábuas, veios e marcas de uso. */
export function paintDesk(width = 2048, height = 1176): Texture {
  const { element, c } = canvas(width, height)
  const planks = 6, plankH = height / planks
  const random = seeded(41)
  for (let p = 0; p < planks; p++) {
    const base = 52 + random() * 14
    c.fillStyle = `rgb(${base + 22},${base},${base - 18})`
    c.fillRect(0, p * plankH, width, plankH)
    for (let k = 0; k < 90; k++) {
      const y = p * plankH + random() * plankH, v = random()
      c.strokeStyle = `rgba(${v < 0.5 ? '20,12,6' : '140,100,64'},${0.06 + random() * 0.12})`
      c.lineWidth = 1 + random() * 2.5
      c.beginPath(); c.moveTo(0, y)
      for (let x = 0; x <= width; x += 64) c.lineTo(x, y + Math.sin(x / (180 + random() * 60) + k) * (2 + random() * 5))
      c.stroke()
    }
    c.fillStyle = 'rgba(10,6,3,0.75)'
    c.fillRect(0, p * plankH, width, 3)
  }
  stains(c, width, height, 40, 43, '18,10,4', 0.25, 180)
  stains(c, width, height, 18, 47, '150,110,70', 0.08, 220)
  grain(c, width, height, 40000, 49, 0.08)
  return texture(element, 8)
}

/** Papelão pardo: fibras, manchas e um vinco escuro nas bordas. */
export function paintCardboard(seedText: string, width = 512, height = 512): Texture {
  const { element, c } = canvas(width, height)
  c.fillStyle = '#a9824f'
  c.fillRect(0, 0, width, height)
  const random = seeded(hash(seedText))
  for (let k = 0; k < 900; k++) {
    c.strokeStyle = `rgba(${random() < 0.5 ? '90,62,30' : '210,180,130'},${0.05 + random() * 0.1})`
    c.lineWidth = 1
    const x = random() * width, y = random() * height, l = 4 + random() * 18
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y + (random() - 0.5) * 3); c.stroke()
  }
  stains(c, width, height, 14, hash(seedText) + 1, '80,55,25', 0.18, 90)
  grain(c, width, height, 8000, hash(seedText) + 2, 0.1)
  const edge = c.createLinearGradient(0, 0, 0, height)
  edge.addColorStop(0, 'rgba(60,40,18,0.35)'); edge.addColorStop(0.08, 'rgba(0,0,0,0)'); edge.addColorStop(0.92, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(60,40,18,0.35)')
  c.fillStyle = edge
  c.fillRect(0, 0, width, height)
  return texture(element)
}

/**
 * Tampa vista de cima: papelão com a etiqueta impressa da caixa-arquivo preenchida à mão e o
 * carimbo de confidencial.
 */
export function paintLidTop(title: string, fields: Array<{ label: string; value: string }>, fonts: WallFonts, width = 1520, height = 1120): Texture {
  const { element, c } = canvas(width, height)
  c.fillStyle = '#ad8752'
  c.fillRect(0, 0, width, height)
  const random = seeded(hash(title))
  for (let k = 0; k < 2600; k++) {
    c.strokeStyle = `rgba(${random() < 0.5 ? '90,62,30' : '214,186,138'},${0.04 + random() * 0.09})`
    c.lineWidth = 1.2
    const x = random() * width, y = random() * height, l = 6 + random() * 26
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y + (random() - 0.5) * 4); c.stroke()
  }
  stains(c, width, height, 24, hash(title) + 3, '80,55,25', 0.2, 160)
  // Furo da alça na frente da tampa.
  c.fillStyle = 'rgba(30,20,10,0.85)'
  c.beginPath(); c.ellipse(width / 2, height - 70, 120, 26, 0, 0, Math.PI * 2); c.fill()
  // Etiqueta impressa em verde-escuro, como nas caixas de arquivo.
  const lx = 150, ly = 140, lw = width - 300, lh = height - 360
  c.fillStyle = 'rgba(244,238,222,0.92)'
  c.fillRect(lx, ly, lw, lh)
  c.strokeStyle = '#2f4a3a'; c.lineWidth = 6
  c.strokeRect(lx, ly, lw, lh)
  c.fillStyle = '#2f4a3a'
  c.fillRect(lx, ly, lw, 96)
  c.fillStyle = '#f4eede'
  c.font = `bold 58px ${fonts.type}`
  c.textBaseline = 'middle'
  c.fillText('ARQUIVO', lx + 36, ly + 50)
  c.textAlign = 'right'
  c.font = `34px ${fonts.type}`
  c.fillText('DOCUMENTOS INSTITUCIONAIS', lx + lw - 36, ly + 50)
  c.textAlign = 'left'
  const rows = [{ label: 'CONTEÚDO', value: title }, ...fields].slice(0, 4)
  const rowH = (lh - 96) / rows.length
  rows.forEach((row, i) => {
    const y = ly + 96 + rowH * i
    c.strokeStyle = 'rgba(47,74,58,0.6)'; c.lineWidth = 3
    if (i > 0) { c.beginPath(); c.moveTo(lx, y); c.lineTo(lx + lw, y); c.stroke() }
    c.fillStyle = '#2f4a3a'
    c.font = `30px ${fonts.type}`
    c.textBaseline = 'top'
    c.fillText(row.label, lx + 30, y + 18)
    c.fillStyle = '#1d2a4a'
    const size = i === 0 ? 104 : 74
    c.font = `${size}px ${fonts.hand}`
    let value = row.value || '—'
    while (c.measureText(value).width > lw - 80 && value.length > 4) value = `${value.slice(0, -2)}…`
    c.fillText(value, lx + 40, y + 46 + (i === 0 ? 0 : 6))
  })
  stamp(c, 'CONFIDENCIAL', width - 420, height - 210, 64, -0.12, fonts, hash(title) + 5)
  return texture(element)
}

/** Avesso da tampa: papelão claro com o índice do conteúdo colado com fita. */
export function paintLidInside(entries: string[], fonts: WallFonts, width = 1520, height = 1120): Texture {
  const { element, c } = canvas(width, height)
  // Vai na face de baixo da tampa, que fica de cabeça para baixo quando a tampa abre: pinta girado.
  c.translate(width, height); c.rotate(Math.PI)
  c.fillStyle = '#b8935e'
  c.fillRect(0, 0, width, height)
  stains(c, width, height, 20, 61, '80,55,25', 0.18, 150)
  grain(c, width, height, 16000, 63, 0.1)
  const cx = 330, cy = 120, cw = 860, ch = 880
  c.save()
  c.translate(cx + cw / 2, cy + ch / 2); c.rotate(-0.025); c.translate(-cw / 2, -ch / 2)
  c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 16; c.shadowOffsetY = 6
  c.fillStyle = '#f1ede2'
  c.fillRect(0, 0, cw, ch)
  c.shadowColor = 'transparent'
  c.strokeStyle = 'rgba(80,110,160,0.35)'; c.lineWidth = 2
  for (let y = 150; y < ch - 20; y += 52) { c.beginPath(); c.moveTo(0, y); c.lineTo(cw, y); c.stroke() }
  c.strokeStyle = 'rgba(180,60,50,0.45)'
  c.beginPath(); c.moveTo(0, 110); c.lineTo(cw, 110); c.stroke()
  c.fillStyle = INK
  c.font = `bold 40px ${fonts.type}`
  c.textBaseline = 'alphabetic'
  c.fillText('ÍNDICE DO CONTEÚDO', 40, 80)
  c.fillStyle = '#1d2a4a'
  c.font = `44px ${fonts.hand}`
  const max = Math.floor((ch - 170) / 52)
  entries.slice(0, max).forEach((entry, i) => {
    const line = entries.length > max && i === max - 1 ? `… e mais ${entries.length - max + 1}` : `${i + 1}. ${entry}`
    let text = line
    while (c.measureText(text).width > cw - 80 && text.length > 4) text = `${text.slice(0, -2)}…`
    c.fillText(text, 44, 142 + i * 52)
  })
  // Fitas nos cantos de cima.
  c.fillStyle = 'rgba(230,222,190,0.75)'
  for (const x of [-30, cw - 90]) { c.save(); c.translate(x + 60, -6); c.rotate(x < 0 ? -0.5 : 0.5); c.fillRect(-60, -18, 120, 40); c.restore() }
  c.restore()
  return texture(element)
}

/**
 * Pasta do dossiê: cartolina parda com a aba de identificação, a insígnia (ou a capa) presa com um
 * clipe e os dados datilografados da organização.
 */
export function paintDossier(image: HTMLImageElement | null, title: string, kind: string, fields: Array<{ label: string; value: string }>, fonts: WallFonts, width = 920, height = 1180): Texture {
  const { element, c } = canvas(width, height)
  c.fillStyle = '#d8b878'
  c.fillRect(0, 0, width, height)
  stains(c, width, height, 16, hash(title), '140,100,40', 0.14, 160)
  grain(c, width, height, 9000, hash(title) + 1, 0.1)
  // Aba com a etiqueta.
  c.fillStyle = '#cfae6b'
  c.fillRect(0, 0, width, 120)
  c.fillStyle = '#f2ede0'
  c.fillRect(40, 26, width * 0.62, 70)
  c.fillStyle = INK
  c.font = `bold 34px ${fonts.type}`
  c.textBaseline = 'middle'
  let name = title.toUpperCase()
  while (c.measureText(name).width > width * 0.62 - 40 && name.length > 4) name = `${name.slice(0, -2)}…`
  c.fillText(name, 60, 62)
  c.font = `26px ${fonts.type}`
  c.textAlign = 'right'
  c.fillText('DOSSIÊ', width - 40, 62)
  c.textAlign = 'left'
  c.strokeStyle = 'rgba(80,58,20,0.5)'; c.lineWidth = 3
  c.beginPath(); c.moveTo(0, 120); c.lineTo(width, 120); c.stroke()
  // Insígnia presa com clipe.
  const px = 60, py = 170, pw = 400, ph = 480
  c.save()
  c.translate(px + pw / 2, py + ph / 2); c.rotate(-0.035); c.translate(-pw / 2, -ph / 2)
  c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 14; c.shadowOffsetY = 6
  c.fillStyle = '#efe9dc'
  c.fillRect(0, 0, pw, ph)
  c.shadowColor = 'transparent'
  if (image) drawCover(c, image, 22, 22, pw - 44, ph - 44)
  else {
    c.fillStyle = '#d9d2c2'; c.fillRect(22, 22, pw - 44, ph - 44)
    c.fillStyle = 'rgba(38,35,31,0.45)'; c.font = `26px ${fonts.type}`; c.textAlign = 'center'
    c.fillText('sem insígnia', pw / 2, ph / 2)
    c.textAlign = 'left'
  }
  c.restore()
  paperclip(c, px + 70, py - 40, 150)
  // Ficha datilografada.
  const fx = 500, fw = width - fx - 50
  c.fillStyle = INK
  c.textBaseline = 'top'
  let y = 190
  c.font = `24px ${fonts.type}`
  c.fillText('CLASSIFICAÇÃO', fx, y)
  c.font = `bold 34px ${fonts.type}`
  y = writeLines(c, wrap(c, kind || 'Não classificada', fw), fx, y + 34, 40, y + 140) + 24
  for (const field of fields) {
    if (y > 620) break
    c.font = `24px ${fonts.type}`
    c.fillText(field.label.toUpperCase(), fx, y)
    c.font = `30px ${fonts.type}`
    y = writeLines(c, wrap(c, field.value || '—', fw), fx, y + 32, 36, y + 32 + 36 * 2) + 22
  }
  // Rodapé com linhas para anotação.
  c.strokeStyle = 'rgba(80,58,20,0.35)'; c.lineWidth = 2
  for (let ly = 760; ly < height - 70; ly += 64) { c.beginPath(); c.moveTo(60, ly); c.lineTo(width - 60, ly); c.stroke() }
  c.fillStyle = '#1d2a4a'
  c.font = `52px ${fonts.hand}`
  c.textBaseline = 'alphabetic'
  c.fillText('ver relatório, subgrupos e membros', 70, 816)
  stamp(c, 'CONFIDENCIAL', width - 250, height - 150, 46, -0.18, fonts, hash(title) + 9)
  return texture(element)
}

/** Pasta de um subgrupo: cartolina colorida com aba, nome à mão e a lista de integrantes. */
export const GROUP_COLORS = ['#c9a76a', '#9fb39a', '#b59a8c', '#9fb0bf'] as const
export function paintGroupFolder(name: string, description: string, members: string[], color: string, fonts: WallFonts, width = 840, height = 620): Texture {
  const { element, c } = canvas(width, height)
  c.fillStyle = color
  c.fillRect(0, 0, width, height)
  stains(c, width, height, 10, hash(name), '60,45,20', 0.12, 140)
  grain(c, width, height, 7000, hash(name) + 1, 0.1)
  c.fillStyle = 'rgba(0,0,0,0.08)'
  c.fillRect(0, 0, width, 92)
  c.fillStyle = '#f2ede0'
  c.fillRect(30, 18, width * 0.66, 58)
  c.fillStyle = '#1d2a4a'
  c.font = `52px ${fonts.hand}`
  c.textBaseline = 'middle'
  let label = name
  while (c.measureText(label).width > width * 0.66 - 30 && label.length > 4) label = `${label.slice(0, -2)}…`
  c.fillText(label, 46, 50)
  c.fillStyle = INK
  c.font = `24px ${fonts.type}`
  c.textAlign = 'right'
  c.fillText('SUBGRUPO', width - 34, 50)
  c.textAlign = 'left'
  c.textBaseline = 'top'
  let y = 120
  if (description) {
    c.font = `28px ${fonts.type}`
    y = writeLines(c, wrap(c, description, width - 80), 40, y, 34, y + 34 * 3) + 16
  }
  c.font = `24px ${fonts.type}`
  c.fillText(`INTEGRANTES (${members.length})`, 40, y)
  y += 36
  c.font = `30px ${fonts.type}`
  const columns = members.length > 5 ? 2 : 1, colW = (width - 80) / columns
  const perColumn = Math.max(1, Math.floor((height - y - 30) / 38))
  members.slice(0, perColumn * columns).forEach((member, i) => {
    const col = Math.floor(i / perColumn), row = i % perColumn
    let text = `– ${member}`
    while (c.measureText(text).width > colW - 20 && text.length > 4) text = `${text.slice(0, -2)}…`
    c.fillText(text, 40 + col * colW, y + row * 38)
  })
  if (!members.length) { c.globalAlpha = 0.55; c.fillText('(nenhum integrante)', 40, y); c.globalAlpha = 1 }
  return texture(element)
}

/** Ficha de membro: cartão pautado com retrato grampeado, nome datilografado e carimbo de líder. */
export function paintMemberCard(image: HTMLImageElement | null, name: string, groups: string[], leader: boolean, fonts: WallFonts, width = 750, height = 1020): Texture {
  const { element, c } = canvas(width, height)
  c.fillStyle = '#f2eee4'
  c.fillRect(0, 0, width, height)
  stains(c, width, height, 8, hash(name), '150,120,70', 0.1, 120)
  grain(c, width, height, 5000, hash(name) + 1, 0.1)
  c.strokeStyle = 'rgba(80,110,160,0.3)'; c.lineWidth = 2
  for (let y = 640; y < height - 30; y += 50) { c.beginPath(); c.moveTo(0, y); c.lineTo(width, y); c.stroke() }
  c.strokeStyle = 'rgba(180,60,50,0.5)'; c.lineWidth = 3
  c.beginPath(); c.moveTo(0, 110); c.lineTo(width, 110); c.stroke()
  c.fillStyle = INK
  c.font = `26px ${fonts.type}`
  c.textBaseline = 'alphabetic'
  c.fillText('FICHA DE MEMBRO', 40, 72)
  // Retrato 3×4 grampeado.
  const pw = 360, ph = 440, px = (width - pw) / 2, py = 150
  c.save()
  c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 10; c.shadowOffsetY = 4
  c.fillStyle = '#e8e2d4'
  c.fillRect(px, py, pw, ph)
  c.restore()
  if (image) drawCover(c, image, px + 12, py + 12, pw - 24, ph - 24, 'grayscale(0.85) sepia(0.3) contrast(1.1)')
  else {
    c.fillStyle = '#cfc8b8'; c.fillRect(px + 12, py + 12, pw - 24, ph - 24)
    c.fillStyle = 'rgba(60,55,48,0.5)'
    c.beginPath(); c.ellipse(px + pw / 2, py + ph * 0.42, pw * 0.2, ph * 0.18, 0, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.ellipse(px + pw / 2, py + ph * 0.95, pw * 0.38, ph * 0.3, 0, Math.PI, 0); c.fill()
  }
  c.strokeStyle = '#8d9296'; c.lineWidth = 6; c.lineCap = 'round'
  c.beginPath(); c.moveTo(px + pw / 2 - 40, py + 6); c.lineTo(px + pw / 2 + 40, py + 2); c.stroke()
  c.fillStyle = INK
  c.font = `bold 40px ${fonts.type}`
  let label = name.toUpperCase()
  while (c.measureText(label).width > width - 80 && label.length > 4) label = `${label.slice(0, -2)}…`
  c.fillText(label, 40, 680)
  c.font = `28px ${fonts.type}`
  writeLines(c, wrap(c, groups.length ? groups.join(', ') : 'Sem subgrupo', width - 80), 40, 740, 50, height - 30)
  if (leader) stamp(c, 'LIDERANÇA', width - 210, 560, 40, -0.2, fonts, hash(name) + 3)
  return texture(element)
}

/** Memorando em papel de cópia (fino e colorido), datilografado. */
export const MEMO_TINTS = ['#e9dcc8', '#d9e2e6', '#e6d6d6'] as const
export function paintMemo(code: string, title: string, text: string, tint: string, fonts: WallFonts, width = 930, height = 690): Texture {
  const { element, c } = canvas(width, height)
  c.fillStyle = tint
  c.fillRect(0, 0, width, height)
  grain(c, width, height, 6000, hash(title), 0.08)
  stains(c, width, height, 8, hash(title) + 2, '120,100,70', 0.1, 120)
  c.fillStyle = INK
  c.textBaseline = 'top'
  c.font = `24px ${fonts.type}`
  c.fillText(`MEMORANDO · ${code}`, 50, 40)
  c.font = `bold 38px ${fonts.type}`
  c.fillText(title.toUpperCase(), 50, 80)
  c.strokeStyle = 'rgba(38,35,31,0.55)'; c.lineWidth = 2
  c.beginPath(); c.moveTo(50, 136); c.lineTo(width - 50, 136); c.stroke()
  c.font = `30px ${fonts.type}`
  writeLines(c, wrap(c, text || '(nada registrado)', width - 100), 50, 160, 40, height - 40)
  return texture(element)
}
