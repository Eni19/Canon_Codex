import { clampInside, tilt, type SurfaceLayout } from '@/domain/canvas/surfaceLayout'

/**
 * A caixa-arquivo 3D de uma Organização: uma caixa de papelão com tampa numa mesa de madeira. Os
 * documentos (dossiê, folhas do relatório, pastas dos subgrupos, fichas dos membros e memorandos)
 * começam empilhados dentro da caixa e saem para a mesa. Unidades da cena, mesa centrada na origem.
 */
export const DESK = { width: 4.9, height: 3.3 } as const
export const DESK_MARGIN = 0.06

/** Caixa vista de cima: centro, medidas externas, espessura da parede e profundidade. */
export const BOX = { x: -1.0, y: 0.4, w: 1.9, h: 1.4, wall: 0.045, depth: 0.34 } as const
export const BOX_INTERIOR = { x: BOX.x, y: BOX.y, w: BOX.w - BOX.wall * 2, h: BOX.h - BOX.wall * 2 } as const
/** Fundo da caixa e quanto a pilha pode subir (abaixo da borda, para a tampa fechar). */
const BOX_FLOOR = 0.012
const STACK_STEP = 0.0035
const STACK_TOP = BOX.depth - 0.06
/** Folga entre um papel na mesa e a parede da caixa. */
const BOX_GAP = 0.04

export type ArchiveItemKind = 'dossier' | 'sheet' | 'group' | 'member' | 'memo'
export const ARCHIVE_SIZE: Record<ArchiveItemKind, { w: number; h: number }> = {
  dossier: { w: 0.92, h: 1.18 },
  sheet: { w: 0.66, h: 0.91 },
  group: { w: 0.84, h: 0.62 },
  member: { w: 0.5, h: 0.68 },
  memo: { w: 0.62, h: 0.46 },
}

export type ArchiveItemRef = { id: string; kind: ArchiveItemKind }

/** O documento está dentro da caixa quando o centro dele cai no fundo da caixa. */
export function isInBox(x: number, y: number) {
  return Math.abs(x - BOX_INTERIOR.x) < BOX_INTERIOR.w / 2 && Math.abs(y - BOX_INTERIOR.y) < BOX_INTERIOR.h / 2
}

/**
 * Onde um documento pode ficar: dentro da caixa, inteiro no fundo dela; fora, na mesa e sem
 * atravessar as paredes da caixa (é empurrado para o lado mais próximo).
 */
export function clampToArchive(kind: ArchiveItemKind, x: number, y: number) {
  const size = ARCHIVE_SIZE[kind]
  if (isInBox(x, y)) {
    const inside = clampInside({ width: BOX_INTERIOR.w, height: BOX_INTERIOR.h }, size, 0.01, x - BOX_INTERIOR.x, y - BOX_INTERIOR.y)
    return { x: inside.x + BOX_INTERIOR.x, y: inside.y + BOX_INTERIOR.y }
  }
  let at = clampInside(DESK, size, DESK_MARGIN, x, y)
  const overlapX = (BOX.w + size.w) / 2 + BOX_GAP - Math.abs(at.x - BOX.x)
  const overlapY = (BOX.h + size.h) / 2 + BOX_GAP - Math.abs(at.y - BOX.y)
  if (overlapX > 0 && overlapY > 0) {
    // Sai pelo lado em que precisa andar menos; se a mesa não deixar, tenta o outro eixo.
    const pushX = { x: at.x + Math.sign(at.x - BOX.x || 1) * overlapX, y: at.y }
    const pushY = { x: at.x, y: at.y + Math.sign(at.y - BOX.y || -1) * overlapY }
    const options = overlapX < overlapY ? [pushX, pushY] : [pushY, pushX]
    at = options.map((option) => clampInside(DESK, size, DESK_MARGIN, option.x, option.y))
      .find((option) => Math.abs(option.x - BOX.x) >= (BOX.w + size.w) / 2 || Math.abs(option.y - BOX.y) >= (BOX.h + size.h) / 2) ?? at
  }
  return at
}

/** Altura de repouso: dentro da caixa, empilhado no fundo; na mesa, `null` (a altura padrão). */
export function restHeight(x: number, y: number, order: number): number | null {
  if (!isInBox(x, y)) return null
  return Math.min(STACK_TOP, BOX_FLOOR + order * STACK_STEP)
}

const angleIn = (item: ArchiveItemRef) => tilt(item.id, item.kind === 'dossier' ? 0.06 : 0.16)
const angleOut = (item: ArchiveItemRef) => tilt(`${item.id}:mesa`, item.kind === 'dossier' ? 0.03 : 0.07)

/** Ordem da pilha na caixa: o relatório no fundo e o dossiê por cima, o primeiro a ser visto. */
const STACK: ArchiveItemKind[] = ['sheet', 'memo', 'group', 'member', 'dossier']

/** Arrumação inicial: tudo dentro da caixa, empilhado com folgas e inclinações diferentes. */
export function defaultArchiveLayout(items: ArchiveItemRef[]): SurfaceLayout {
  const layout: SurfaceLayout = {}
  let order = 0
  for (const kind of STACK) {
    for (const item of items.filter((candidate) => candidate.kind === kind)) {
      const { w, h } = ARCHIVE_SIZE[kind]
      const free = { x: Math.max(0, (BOX_INTERIOR.w - w) / 2), y: Math.max(0, (BOX_INTERIOR.h - h) / 2) }
      const x = BOX_INTERIOR.x + tilt(`${item.id}:x`, 1) * free.x * 0.75
      const y = BOX_INTERIOR.y + tilt(`${item.id}:y`, 1) * free.y * 0.75
      layout[item.id] = { ...clampToArchive(kind, x, y), rotation: angleIn(item), order: order++ }
    }
  }
  return layout
}

/**
 * Onde cada documento vai quando sai da caixa: o dossiê ao lado dela, memorandos embaixo dele, as
 * folhas em leque, as pastas dos subgrupos na coluna da direita e as fichas dos membros em fila.
 */
export function spreadPositions(items: ArchiveItemRef[]): Record<string, { x: number; y: number; rotation: number }> {
  const spots: Record<string, { x: number; y: number; rotation: number }> = {}
  const of = (kind: ArchiveItemKind) => items.filter((item) => item.kind === kind)
  const put = (item: ArchiveItemRef, x: number, y: number) => { spots[item.id] = { ...clampToArchive(item.kind, x, y), rotation: angleOut(item) } }
  of('dossier').forEach((item, i) => put(item, 0.52 + i * 0.1, 0.58 - i * 0.08))
  of('memo').forEach((item, i) => put(item, -1.6 + (i % 4) * 0.66, -0.45 - Math.floor(i / 4) * 0.08))
  of('sheet').forEach((item, i) => put(item, 1.16 + (i % 4) * 0.1, 0.62 - (i % 4) * 0.07 - Math.floor(i / 4) * 0.1))
  of('group').forEach((item, i) => put(item, 1.76 - Math.floor(i / 3) * 0.12, 1.02 - (i % 3) * 0.62 - Math.floor(i / 3) * 0.05))
  of('member').forEach((item, i) => put(item, -1.9 + (i % 8) * 0.54, -1.08 + Math.floor(i / 8) * 0.08))
  return spots
}
