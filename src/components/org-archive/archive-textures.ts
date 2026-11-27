import type { Texture } from 'three'
import { canvas, grain, hash, seeded, stains, texture, wrap, writeLines, type WallFonts } from '@/components/evidence-wall/wall-textures'

/**
 * Texturas da caixa-arquivo das Organizações, todas desenhadas em código: mesa de madeira, papelão
 * da caixa, etiqueta da tampa, índice colado por dentro da tampa e os documentos (dossiê, páginas
 * do livro de registro, pasta sanfonada, estatuto e envelopes).
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
export function paintDesk(width = 2048, height = 1176, planks = 6): Texture {
  const { element, c } = canvas(width, height)
  const plankH = height / planks
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

/** Percalina da capa do livro de registro: tecido verde-escuro com trama fina. */
export function paintCloth(size = 512): Texture {
  const { element, c } = canvas(size, size)
  c.fillStyle = '#26382c'
  c.fillRect(0, 0, size, size)
  const random = seeded(71)
  for (let i = 0; i < size; i += 3) {
    c.fillStyle = `rgba(255,255,255,${0.02 + random() * 0.03})`; c.fillRect(0, i, size, 1)
    c.fillStyle = `rgba(0,0,0,${0.04 + random() * 0.05})`; c.fillRect(i, 0, 1, size)
  }
  stains(c, size, size, 12, 73, '10,16,12', 0.25, 90)
  return texture(element)
}

export const LEDGER_PAGE_PX = { width: 640, height: 880 }
export type LedgerEntry = { name: string; groups: string[]; leader: boolean; number: number }

/** Papel do livro: creme pautado, com a sombra da lombada do lado de dentro. */
function ledgerPaper(c: CanvasRenderingContext2D, side: 'left' | 'right', seed: number) {
  const { width, height } = LEDGER_PAGE_PX
  c.fillStyle = '#f0e9d8'
  c.fillRect(0, 0, width, height)
  stains(c, width, height, 8, seed, '150,120,70', 0.08, 140)
  grain(c, width, height, 5000, seed + 1, 0.08)
  const gutter = c.createLinearGradient(side === 'left' ? width : 0, 0, side === 'left' ? width - 70 : 70, 0)
  gutter.addColorStop(0, 'rgba(60,40,20,0.28)'); gutter.addColorStop(1, 'rgba(60,40,20,0)')
  c.fillStyle = gutter
  c.fillRect(0, 0, width, height)
}

/**
 * Página do livro de registro: a folha de rosto (página 0) ou uma tabela pautada com número, nome e
 * subgrupos; a liderança leva uma estrela.
 */
export function paintLedgerPage(entries: LedgerEntry[], page: number, total: number, title: string, fonts: WallFonts): Texture {
  const { width, height } = LEDGER_PAGE_PX
  const { element, c } = canvas(width, height)
  ledgerPaper(c, page % 2 === 0 ? 'left' : 'right', hash(`${title}:${page}`))
  c.fillStyle = INK
  if (page === 0) {
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.strokeStyle = 'rgba(38,35,31,0.5)'; c.lineWidth = 2
    c.strokeRect(60, 80, width - 120, height - 160)
    c.font = `bold 40px ${fonts.type}`
    c.fillText('LIVRO DE REGISTRO', width / 2, 250)
    c.font = `26px ${fonts.type}`
    c.fillText('QUADRO DE PESSOAL', width / 2, 300)
    c.fillStyle = '#1d2a4a'
    c.font = `58px ${fonts.hand}`
    let name = title
    while (c.measureText(name).width > width - 160 && name.length > 4) name = `${name.slice(0, -2)}…`
    c.fillText(name, width / 2, 450)
    c.fillStyle = INK
    c.font = `24px ${fonts.type}`
    const sheets = total - 1
    c.fillText(sheets > 0 ? `${sheets} folha${sheets === 1 ? '' : 's'} de registro` : 'nenhum registro', width / 2, 620)
    return texture(element)
  }
  const top = 120, row = 50, left = 56
  c.strokeStyle = 'rgba(80,110,160,0.35)'; c.lineWidth = 2
  for (let y = top + row; y < height - 40; y += row) { c.beginPath(); c.moveTo(30, y); c.lineTo(width - 30, y); c.stroke() }
  c.strokeStyle = 'rgba(180,60,50,0.5)'
  c.beginPath(); c.moveTo(left + 52, top - 30); c.lineTo(left + 52, height - 40); c.stroke()
  c.font = `20px ${fonts.type}`
  c.textBaseline = 'alphabetic'
  c.fillText('Nº', left, top + 10)
  c.fillText('NOME', left + 66, top + 10)
  c.textAlign = 'right'
  c.fillText('SUBGRUPO', width - 40, top + 10)
  c.fillText(`fl. ${page}`, width - 40, height - 20)
  entries.forEach((entry, i) => {
    const y = top + row * (i + 1) + 38
    c.textAlign = 'left'
    c.fillStyle = INK
    c.font = `20px ${fonts.type}`
    c.fillText(String(entry.number).padStart(3, '0'), left - 8, y)
    c.fillStyle = '#1d2a4a'
    c.font = `34px ${fonts.hand}`
    let name = `${entry.leader ? '★ ' : ''}${entry.name}`
    while (c.measureText(name).width > 300 && name.length > 4) name = `${name.slice(0, -2)}…`
    c.fillText(name, left + 66, y)
    c.textAlign = 'right'
    c.font = `26px ${fonts.hand}`
    let groups = entry.groups.join(', ') || '—'
    while (c.measureText(groups).width > 170 && groups.length > 4) groups = `${groups.slice(0, -2)}…`
    c.fillText(groups, width - 40, y)
  })
  c.textAlign = 'left'
  if (!entries.length) {
    c.globalAlpha = 0.5; c.font = `24px ${fonts.type}`
    c.fillText('(página em branco)', left + 66, top + row + 38)
    c.globalAlpha = 1
  }
  return texture(element)
}

/**
 * Pasta sanfonada vista de cima: corpo de papelão com a etiqueta e, em cima, as divisórias com uma
 * aba por subgrupo, em fileiras escalonadas; o que não cabe vira "+N".
 */
export const ACCORDION_PX = { width: 1000, height: 780 }
export function paintAccordion(groups: string[], title: string, fonts: WallFonts): Texture {
  const { width, height } = ACCORDION_PX
  const { element, c } = canvas(width, height)
  const tabColors = ['#e6d3a8', '#c9d6c2', '#e2c3b5', '#c8d3de', '#e8dca0']
  const perRow = 4, maxRows = 3, tabW = (width - 60) / perRow, tabH = 64, step = tabH - 12
  const capacity = perRow * maxRows
  const visible = groups.length > capacity ? capacity - 1 : groups.length
  const labels = [...groups.slice(0, visible), ...(groups.length > visible ? [`+${groups.length - visible}`] : [])]
  const rows = Math.max(1, Math.ceil(labels.length / perRow))
  const bodyTop = 16 + rows * step + 26
  c.fillStyle = '#7a5a33'
  c.fillRect(0, 0, width, height)
  // Divisórias com abas: as de trás aparecem mais acima.
  for (let r = 0; r < rows; r++) {
    const y = 16 + r * step
    c.fillStyle = tabColors[r % tabColors.length]
    c.fillRect(12, y + tabH - 8, width - 24, height)
    c.strokeStyle = 'rgba(60,45,20,0.35)'; c.lineWidth = 2
    c.beginPath(); c.moveTo(12, y + tabH - 8); c.lineTo(width - 12, y + tabH - 8); c.stroke()
    for (let k = 0; k < perRow; k++) {
      const label = labels[r * perRow + k]
      if (label === undefined) continue
      const x = 24 + k * tabW + (r % 2) * 26
      c.fillStyle = tabColors[(r + k + 1) % tabColors.length]
      c.beginPath(); c.moveTo(x + 6, y + tabH - 8); c.lineTo(x + 18, y); c.lineTo(x + tabW - 30, y); c.lineTo(x + tabW - 18, y + tabH - 8); c.closePath(); c.fill()
      c.stroke()
      c.fillStyle = '#1d2a4a'
      c.font = `32px ${fonts.hand}`
      c.textBaseline = 'middle'
      let text = label
      while (c.measureText(text).width > tabW - 60 && text.length > 3) text = `${text.slice(0, -2)}…`
      c.fillText(text, x + 26, y + tabH / 2)
    }
  }
  // Corpo da pasta, em sanfona.
  c.fillStyle = '#a7804c'
  c.fillRect(0, bodyTop, width, height - bodyTop)
  const random = seeded(hash(title))
  for (let k = 0; k < 1400; k++) {
    c.strokeStyle = `rgba(${random() < 0.5 ? '90,62,30' : '214,186,138'},${0.05 + random() * 0.08})`
    c.lineWidth = 1
    const x = random() * width, y = bodyTop + random() * (height - bodyTop)
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6 + random() * 16, y); c.stroke()
  }
  for (const x of [0, width - 26]) {
    const fold = c.createLinearGradient(x, 0, x + 26, 0)
    fold.addColorStop(0, 'rgba(50,32,12,0.45)'); fold.addColorStop(0.5, 'rgba(255,230,190,0.15)'); fold.addColorStop(1, 'rgba(50,32,12,0.45)')
    c.fillStyle = fold; c.fillRect(x, bodyTop, 26, height - bodyTop)
  }
  const ly = bodyTop + (height - bodyTop) / 2 - 70
  c.fillStyle = '#f2ede0'
  c.fillRect(width / 2 - 260, ly, 520, 140)
  c.strokeStyle = '#2f4a3a'; c.lineWidth = 4; c.strokeRect(width / 2 - 260, ly, 520, 140)
  c.fillStyle = INK
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.font = `bold 40px ${fonts.type}`
  c.fillText('SUBGRUPOS', width / 2, ly + 46)
  c.font = `26px ${fonts.type}`
  c.fillText(groups.length ? `${groups.length} divisória${groups.length === 1 ? '' : 's'}` : 'nenhuma divisória', width / 2, ly + 100)
  c.textAlign = 'left'
  return texture(element)
}

/**
 * Estatuto: papel encorpado com moldura ornamental, os artigos (objetivos e ideais) e as linhas de
 * assinatura. O lacre é um objeto 3D preso por cima, no canto de baixo à direita.
 */
export const CHARTER_PX = { width: 800, height: 1050 }
export function paintCharter(title: string, founded: string, articles: Array<{ heading: string; text: string }>, fonts: WallFonts): Texture {
  const { width, height } = CHARTER_PX
  const { element, c } = canvas(width, height)
  c.fillStyle = '#efe6cf'
  c.fillRect(0, 0, width, height)
  stains(c, width, height, 18, hash(title) + 11, '150,115,60', 0.12, 160)
  grain(c, width, height, 8000, hash(title) + 12, 0.08)
  // Moldura: fio duplo e um friso de losangos.
  c.strokeStyle = '#5b4a2e'; c.lineWidth = 4
  c.strokeRect(34, 34, width - 68, height - 68)
  c.lineWidth = 1.5
  c.strokeRect(48, 48, width - 96, height - 96)
  c.fillStyle = 'rgba(91,74,46,0.75)'
  const diamond = (x: number, y: number) => { c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x + 4, y); c.lineTo(x, y + 5); c.lineTo(x - 4, y); c.fill() }
  for (let x = 70; x < width - 60; x += 22) { diamond(x, 41); diamond(x, height - 41) }
  for (let y = 70; y < height - 60; y += 22) { diamond(41, y); diamond(width - 41, y) }
  c.fillStyle = INK
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'
  c.font = `bold 56px ${fonts.type}`
  c.fillText('ESTATUTO', width / 2, 150)
  c.font = `46px ${fonts.hand}`
  let name = title
  while (c.measureText(name).width > width - 200 && name.length > 4) name = `${name.slice(0, -2)}…`
  c.fillText(name, width / 2, 210)
  if (founded) { c.font = `20px ${fonts.type}`; c.fillText(`fundada em ${founded}`, width / 2, 246) }
  c.textAlign = 'left'
  c.textBaseline = 'top'
  let y = 290
  articles.forEach((article, i) => {
    c.font = `bold 24px ${fonts.type}`
    c.fillText(`ART. ${i + 1}º — ${article.heading.toUpperCase()}`, 90, y)
    c.font = `22px ${fonts.type}`
    const bottom = i === articles.length - 1 ? height - 240 : Math.min(height - 360, y + 40 + 30 * 8)
    y = writeLines(c, wrap(c, article.text, width - 180), 90, y + 40, 30, bottom) + 28
  })
  c.textBaseline = 'alphabetic'
  // Assinaturas.
  c.strokeStyle = 'rgba(38,35,31,0.7)'; c.lineWidth = 1.5
  for (const x of [100, 330]) { c.beginPath(); c.moveTo(x, height - 140); c.lineTo(x + 190, height - 140); c.stroke() }
  c.strokeStyle = '#1d2a4a'; c.lineWidth = 2.5
  const random = seeded(hash(title) + 13)
  for (const x of [110, 340]) {
    c.beginPath(); c.moveTo(x, height - 155)
    for (let k = 1; k < 9; k++) c.quadraticCurveTo(x + k * 20 - 10, height - 175 + random() * 40, x + k * 20, height - 152 - random() * 14)
    c.stroke()
  }
  return texture(element)
}

/** Envelope endereçado à mão, com selo e carimbo do correio. */
export const ENVELOPE_PX = { width: 660, height: 420 }
export function paintEnvelope(addressee: string, fonts: WallFonts, seedText: string): Texture {
  const { width, height } = ENVELOPE_PX
  const { element, c } = canvas(width, height)
  const random = seeded(hash(seedText))
  const tones = ['#ece3cf', '#e6d7b8', '#dfe2da']
  c.fillStyle = tones[Math.floor(random() * tones.length)]
  c.fillRect(0, 0, width, height)
  stains(c, width, height, 8, hash(seedText) + 1, '150,120,70', 0.1, 120)
  grain(c, width, height, 4000, hash(seedText) + 2, 0.08)
  c.fillStyle = ['#9e3b2f', '#2f5a7a', '#4d6b3a'][Math.floor(random() * 3)]
  c.fillRect(width - 130, 30, 90, 110)
  c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 3; c.strokeRect(width - 122, 38, 74, 94)
  c.strokeStyle = 'rgba(38,35,31,0.55)'; c.lineWidth = 3
  c.beginPath(); c.arc(width - 170, 110, 48, 0, Math.PI * 2); c.stroke()
  for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(width - 230 - k * 6, 70 + k * 18); c.quadraticCurveTo(width - 170, 60 + k * 18, width - 90, 72 + k * 18); c.stroke() }
  c.fillStyle = '#1d2a4a'
  c.font = `28px ${fonts.type}`
  c.fillText('À', 100, 232)
  c.font = `52px ${fonts.hand}`
  let name = addressee
  while (c.measureText(name).width > width - 220 && name.length > 4) name = `${name.slice(0, -2)}…`
  c.fillText(name, 140, 240)
  c.strokeStyle = 'rgba(38,35,31,0.35)'; c.lineWidth = 2
  for (const y of [258, 310, 360]) { c.beginPath(); c.moveTo(130, y); c.lineTo(width - 70, y); c.stroke() }
  return texture(element)
}
