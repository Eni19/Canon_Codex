import { clampInside, tilt, type SurfaceLayout } from '@/domain/canvas/surfaceLayout'

/**
 * A caixa-arquivo 3D de uma Organização: uma caixa de papelão com tampa numa mesa de madeira. Os
 * documentos (dossiê, polaroides da liderança, folhas do relatório, livro de registro dos membros,
 * pasta sanfonada dos subgrupos, estatuto e o maço de correspondência) começam empilhados dentro da caixa e saem para a
 * mesa. Cada tipo é um objeto só, qualquer que seja o número de membros ou subgrupos. A caixa também
 * pode ser arrastada pela mesa, levando o que está dentro. Unidades da cena, mesa centrada na origem.
 */
export const DESK = { width: 4.9, height: 3.3 } as const
export const DESK_MARGIN = 0.06

/** Medidas da caixa vista de cima: externas, espessura da parede e profundidade. */
export const BOX = { w: 1.9, h: 1.4, wall: 0.045, depth: 0.34 } as const
export const BOX_INTERIOR = { w: BOX.w - BOX.wall * 2, h: BOX.h - BOX.wall * 2 } as const
/** Onde fica o centro da caixa: a posição inicial e a arrastada pela pessoa. */
export type BoxAt = { x: number; y: number }
export const BOX_HOME: BoxAt = { x: -1.0, y: 0.4 }
/** Fundo da caixa e quanto a pilha pode subir (abaixo da borda, para a tampa fechar). */
const BOX_FLOOR = 0.012
const STACK_TOP = BOX.depth - 0.06
/** Folga entre um papel na mesa e a parede da caixa. */
const BOX_GAP = 0.04
/** Papel na mesa assenta rente ao tampo; o que está por cima de outro sobe só a espessura dele. */
const DESK_REST = 0.0012
const LAYER_GAP = 0.0008

export type ArchiveItemKind = 'dossier' | 'sheet' | 'ledger' | 'accordion' | 'charter' | 'letters' | 'polaroid'
export const ARCHIVE_SIZE: Record<ArchiveItemKind, { w: number; h: number }> = {
  dossier: { w: 0.92, h: 1.18 },
  sheet: { w: 0.66, h: 0.91 },
  ledger: { w: 1.34, h: 0.94 },
  accordion: { w: 1.0, h: 0.78 },
  charter: { w: 0.8, h: 1.05 },
  letters: { w: 0.66, h: 0.42 },
  polaroid: { w: 0.5, h: 0.606 },
}
/** Espessura de cada objeto, para as pilhas (na caixa e na mesa) não se atravessarem. */
export const ARCHIVE_THICKNESS: Record<ArchiveItemKind, number> = {
  dossier: 0.006, sheet: 0.002, ledger: 0.036, accordion: 0.03, charter: 0.026, letters: 0.03, polaroid: 0.004,
}

export type ArchiveItemRef = { id: string; kind: ArchiveItemKind }

/** O documento está dentro da caixa quando o centro dele cai no fundo da caixa. */
export function isInBox(x: number, y: number, box: BoxAt = BOX_HOME) {
  return Math.abs(x - box.x) < BOX_INTERIOR.w / 2 && Math.abs(y - box.y) < BOX_INTERIOR.h / 2
}

/** A caixa inteira fica na mesa. */
export function clampBox(x: number, y: number): BoxAt {
  return clampInside(DESK, BOX, DESK_MARGIN, x, y)
}

/** Lê a posição salva da caixa; qualquer coisa ilegível volta para a posição inicial. */
export function readBoxPosition(value: unknown): BoxAt {
  if (!value || typeof value !== 'object') return BOX_HOME
  const { x, y } = value as Record<string, unknown>
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y) ? clampBox(x, y) : BOX_HOME
}

/** Fora da caixa: na mesa e sem atravessar as paredes dela (é empurrado para o lado mais próximo). */
function outsideBox(kind: ArchiveItemKind, x: number, y: number, box: BoxAt) {
  const size = ARCHIVE_SIZE[kind]
  let at = clampInside(DESK, size, DESK_MARGIN, x, y)
  const overlapX = (BOX.w + size.w) / 2 + BOX_GAP - Math.abs(at.x - box.x)
  const overlapY = (BOX.h + size.h) / 2 + BOX_GAP - Math.abs(at.y - box.y)
  if (overlapX > 0 && overlapY > 0) {
    // Sai pelo lado em que precisa andar menos; se a mesa não deixar, tenta os outros lados.
    const sx = Math.sign(at.x - box.x || 1), sy = Math.sign(at.y - box.y || -1)
    const pushes = [
      { d: overlapX, x: at.x + sx * overlapX, y: at.y }, { d: overlapY, x: at.x, y: at.y + sy * overlapY },
      { d: (BOX.w + size.w) / 2 + BOX_GAP + Math.abs(at.x - box.x), x: box.x - sx * ((BOX.w + size.w) / 2 + BOX_GAP), y: at.y },
      { d: (BOX.h + size.h) / 2 + BOX_GAP + Math.abs(at.y - box.y), x: at.x, y: box.y - sy * ((BOX.h + size.h) / 2 + BOX_GAP) },
    ].sort((a, b) => a.d - b.d)
    at = pushes.map((push) => clampInside(DESK, size, DESK_MARGIN, push.x, push.y))
      .find((option) => Math.abs(option.x - box.x) >= (BOX.w + size.w) / 2 || Math.abs(option.y - box.y) >= (BOX.h + size.h) / 2) ?? at
  }
  return at
}

/**
 * Onde um documento pode ficar: dentro da caixa, inteiro no fundo dela; fora, na mesa e sem
 * atravessar as paredes da caixa. Com `keepOut`, nunca entra (quando é a caixa que veio até ele).
 */
export function clampToArchive(kind: ArchiveItemKind, x: number, y: number, box: BoxAt = BOX_HOME, keepOut = false) {
  if (!keepOut && isInBox(x, y, box)) {
    const inside = clampInside({ width: BOX_INTERIOR.w, height: BOX_INTERIOR.h }, ARCHIVE_SIZE[kind], 0.01, x - box.x, y - box.y)
    return { x: inside.x + box.x, y: inside.y + box.y }
  }
  return outsideBox(kind, x, y, box)
}

type Placed = { id: string; kind: ArchiveItemKind; x: number; y: number; order: number }

/**
 * Altura de repouso de cada documento. Na caixa, cada um assenta sobre a espessura dos que estão
 * por baixo (pela ordem), sem passar da borda. Na mesa, fica rente ao tampo e só sobe quando está
 * por cima de outro documento, na espessura dele.
 */
export function restHeights(items: Placed[], box: BoxAt = BOX_HOME): Record<string, number> {
  const heights: Record<string, number> = {}
  const ordered = [...items].sort((a, b) => a.order - b.order)
  let top = BOX_FLOOR
  const onDesk: Placed[] = []
  for (const item of ordered) {
    if (isInBox(item.x, item.y, box)) {
      heights[item.id] = Math.min(STACK_TOP, top)
      top += ARCHIVE_THICKNESS[item.kind] + 0.002
      continue
    }
    const size = ARCHIVE_SIZE[item.kind]
    let z = DESK_REST
    for (const below of onDesk) {
      const other = ARCHIVE_SIZE[below.kind]
      if (Math.abs(item.x - below.x) < (size.w + other.w) / 2 && Math.abs(item.y - below.y) < (size.h + other.h) / 2) {
        z = Math.max(z, heights[below.id] + ARCHIVE_THICKNESS[below.kind] + LAYER_GAP)
      }
    }
    heights[item.id] = z
    onDesk.push(item)
  }
  return heights
}

const angleIn = (item: ArchiveItemRef) => tilt(item.id, item.kind === 'dossier' ? 0.06 : 0.16)
const angleOut = (item: ArchiveItemRef) => tilt(`${item.id}:mesa`, item.kind === 'dossier' ? 0.03 : 0.07)

/** Ordem da pilha na caixa: os volumes grossos no fundo e o dossiê por cima, o primeiro a ser visto. */
const STACK: ArchiveItemKind[] = ['ledger', 'accordion', 'sheet', 'letters', 'charter', 'polaroid', 'dossier']

/** Arrumação inicial: tudo dentro da caixa, empilhado com folgas e inclinações diferentes. */
export function defaultArchiveLayout(items: ArchiveItemRef[], box: BoxAt = BOX_HOME): SurfaceLayout {
  const layout: SurfaceLayout = {}
  let order = 0
  for (const kind of STACK) {
    for (const item of items.filter((candidate) => candidate.kind === kind)) {
      const { w, h } = ARCHIVE_SIZE[kind]
      const free = { x: Math.max(0, (BOX_INTERIOR.w - w) / 2), y: Math.max(0, (BOX_INTERIOR.h - h) / 2) }
      const x = box.x + tilt(`${item.id}:x`, 1) * free.x * 0.75
      const y = box.y + tilt(`${item.id}:y`, 1) * free.y * 0.75
      layout[item.id] = { ...clampToArchive(kind, x, y, box), rotation: angleIn(item), order: order++ }
    }
  }
  return layout
}

/** Lugar preferido de cada tipo na mesa com a caixa na posição inicial (a busca parte daqui). */
const PREFERRED: Record<ArchiveItemKind, { x: number; y: number }> = {
  dossier: { x: 0.52, y: 0.58 },
  charter: { x: 0.45, y: -0.76 },
  sheet: { x: 1.16, y: 0.62 },
  letters: { x: 1.22, y: -0.2 },
  accordion: { x: 1.68, y: -0.86 },
  ledger: { x: -1.22, y: -0.98 },
  polaroid: { x: 1.95, y: 0.7 },
}
/** Ordem de escolha: os maiores primeiro, para os pequenos ocuparem as sobras. */
const SPREAD_ORDER: ArchiveItemKind[] = ['dossier', 'ledger', 'sheet', 'charter', 'accordion', 'letters', 'polaroid']
/** Quanto a tampa aberta ocupa atrás da caixa, vista de cima. */
const LID_REACH = 0.5
const SEARCH_STEP = 0.05

type Rect = { x: number; y: number; w: number; h: number }
const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2)) *
  Math.max(0, Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2))

/**
 * Onde cada documento vai quando sai da caixa. Cada tipo tem um lugar preferido (o dossiê com o
 * estatuto embaixo, as folhas, a correspondência, a pasta sanfonada e as polaroides da liderança à
 * direita, o livro embaixo à esquerda); com a caixa levada para a direita ou para baixo, as preferências se espelham. Cada
 * documento fica no ponto livre da mesa mais perto do preferido, sem cair na caixa, na tampa aberta
 * nem em cima dos que já foram postos. As folhas do relatório saem em leque, sobrepostas de propósito.
 */
export function spreadPositions(items: ArchiveItemRef[], box: BoxAt = BOX_HOME): Record<string, { x: number; y: number; rotation: number }> {
  const spots: Record<string, { x: number; y: number; rotation: number }> = {}
  const sx = box.x > 0 ? -1 : 1, sy = box.y < 0 ? -1 : 1
  const obstacles: Rect[] = [
    { x: box.x, y: box.y, w: BOX.w + BOX_GAP * 2, h: BOX.h + BOX_GAP * 2 },
    { x: box.x, y: box.y + BOX.h / 2 + LID_REACH / 2, w: BOX.w, h: LID_REACH },
  ]
  const placed: Rect[] = []
  /** Ponto livre mais perto do preferido para uma área `w × h`. */
  const find = (w: number, h: number, prefer: { x: number; y: number }) => {
    const maxX = Math.max(0, DESK.width / 2 - DESK_MARGIN - w / 2), maxY = Math.max(0, DESK.height / 2 - DESK_MARGIN - h / 2)
    let best = { x: Math.min(maxX, Math.max(-maxX, prefer.x)), y: Math.min(maxY, Math.max(-maxY, prefer.y)), cost: Infinity }
    for (let x = -maxX; x <= maxX + 1e-9; x += SEARCH_STEP) {
      for (let y = -maxY; y <= maxY + 1e-9; y += SEARCH_STEP) {
        const rect = { x, y, w, h }
        const blocked = obstacles.reduce((sum, obstacle) => sum + overlapArea(rect, obstacle), 0)
        const crowded = placed.reduce((sum, other) => sum + overlapArea(rect, other), 0)
        const cost = Math.hypot(x - prefer.x, y - prefer.y) + blocked * 40 + crowded * 30
        if (cost < best.cost) best = { x, y, cost }
      }
    }
    placed.push({ x: best.x, y: best.y, w, h })
    return best
  }
  for (const kind of SPREAD_ORDER) {
    const ofKind = items.filter((item) => item.kind === kind)
    if (!ofKind.length) continue
    const prefer = { x: sx * PREFERRED[kind].x, y: sy * PREFERRED[kind].y }
    const size = ARCHIVE_SIZE[kind]
    if (kind === 'sheet') {
      // O leque inteiro procura lugar como uma área só; cada folha anda um pouco a partir da primeira.
      const across = Math.min(ofKind.length, 4) - 1, rows = Math.floor((ofKind.length - 1) / 4)
      const area = { w: size.w + across * 0.1, h: size.h + across * 0.07 + rows * 0.1 }
      const at = find(area.w, area.h, prefer)
      const left = at.x - area.w / 2 + size.w / 2, top = at.y + area.h / 2 - size.h / 2
      ofKind.forEach((item, i) => {
        spots[item.id] = { ...clampToArchive(kind, left + (i % 4) * 0.1, top - (i % 4) * 0.07 - Math.floor(i / 4) * 0.1, box, true), rotation: angleOut(item) }
      })
      continue
    }
    ofKind.forEach((item, i) => {
      const step = kind === 'polaroid' ? { x: -0.56 * sx, y: 0 } : { x: 0.1, y: -0.08 }
      const at = find(size.w, size.h, { x: prefer.x + i * step.x, y: prefer.y + i * step.y })
      spots[item.id] = { ...clampToArchive(kind, at.x, at.y, box, true), rotation: angleOut(item) }
    })
  }
  return spots
}

/** Linhas por página do livro de registro. */
export const LEDGER_PER_PAGE = 14

/**
 * Páginas do livro de registro: a primeira é a folha de rosto; depois os membros, em ordem, com a
 * liderança primeiro. Cada abertura do livro mostra duas páginas.
 */
export function ledgerPages<T extends { leader: boolean }>(members: T[], perPage = LEDGER_PER_PAGE): { pages: T[][]; spreads: number } {
  const ordered = [...members.filter((member) => member.leader), ...members.filter((member) => !member.leader)]
  const pages: T[][] = [[]]
  for (let i = 0; i < ordered.length; i += perPage) pages.push(ordered.slice(i, i + perPage))
  if (pages.length === 1) pages.push([])
  return { pages, spreads: Math.ceil(pages.length / 2) }
}

/** Abertura do livro em que aparece o membro de posição `index` (já na ordem do livro). */
export const ledgerSpreadOf = (index: number, perPage = LEDGER_PER_PAGE) => Math.floor((1 + Math.floor(index / perPage)) / 2)
