import { z } from 'zod'

/**
 * A parede 3D de uma Evidência: onde cada peça (polaroide da evidência, polaroides dos personagens,
 * folhas do relatório e notas) fica pregada, e quais peças a linha vermelha liga. Tudo em unidades
 * da cena, com a parede centrada na origem. Regras puras: a cena só desenha e move.
 */
export const WALL = { width: 4.4, height: 2.5 } as const
/** Margem que uma peça mantém da borda da parede ao ser arrastada. */
export const WALL_MARGIN = 0.06

export type WallItemKind = 'cover' | 'character' | 'sheet' | 'note'
export const ITEM_SIZE: Record<WallItemKind, { w: number; h: number }> = {
  cover: { w: 0.66, h: 0.8 },
  character: { w: 0.4, h: 0.49 },
  sheet: { w: 0.58, h: 0.8 },
  note: { w: 0.46, h: 0.46 },
}

export type WallItemRef = { id: string; kind: WallItemKind }
export const WallPlacementSchema = z.object({ x: z.number().finite(), y: z.number().finite(), rotation: z.number().finite(), order: z.number().int().min(0) })
export type WallPlacement = z.infer<typeof WallPlacementSchema>
export type WallLayout = Record<string, WallPlacement>

export const WALL_LAYOUT_VERSION = 1
const SavedLayoutSchema = z.object({ version: z.literal(WALL_LAYOUT_VERSION), placements: z.record(z.string(), WallPlacementSchema) })

/** Pequeno ângulo estável por peça, para que nada fique alinhado demais, como num quadro real. */
export function tilt(id: string, amplitude = 0.055) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return (((h >>> 0) % 1000) / 1000 * 2 - 1) * amplitude
}

/** Mantém a peça inteira dentro da parede, com margem. */
export function clampToWall(kind: WallItemKind, x: number, y: number) {
  const { w, h } = ITEM_SIZE[kind]
  const maxX = WALL.width / 2 - w / 2 - WALL_MARGIN, maxY = WALL.height / 2 - h / 2 - WALL_MARGIN
  return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) }
}

/**
 * Arrumação inicial: a polaroide da evidência à esquerda, os personagens embaixo dela, as folhas
 * do relatório no centro (levemente sobrepostas, como páginas pregadas juntas) e as notas à direita.
 */
export function defaultLayout(items: WallItemRef[]): WallLayout {
  const layout: WallLayout = {}
  let order = 0
  const place = (item: WallItemRef, x: number, y: number) => {
    const at = clampToWall(item.kind, x, y)
    layout[item.id] = { ...at, rotation: tilt(item.id), order: order++ }
  }
  const of = (kind: WallItemKind) => items.filter((item) => item.kind === kind)
  // As peças ficam na faixa central (±1,55) que a tela mostra de início; o resto da parede é folga.
  of('sheet').forEach((item, i) => place(item, -0.12 + (i % 4) * 0.3, 0.2 - Math.floor(i / 4) * 0.2 - (i % 2) * 0.07))
  of('cover').forEach((item, i) => place(item, -1.06 + i * 0.28, 0.36))
  of('character').forEach((item, i) => place(item, -1.3 + (i % 4) * 0.44, -0.66 - Math.floor(i / 4) * 0.2))
  of('note').forEach((item, i) => {
    const column = Math.floor(i / 4), row = i % 4
    place(item, 1.3 - column * 0.5, 0.66 - row * 0.5)
  })
  return layout
}

/**
 * A arrumação salva vale para as peças que ainda existem; peças novas entram na posição inicial e
 * as removidas somem. Dados ilegíveis voltam para a arrumação inicial.
 */
export function readWallLayout(saved: unknown, items: WallItemRef[]): WallLayout {
  const fallback = defaultLayout(items)
  const parsed = SavedLayoutSchema.safeParse(saved)
  if (!parsed.success) return fallback
  const layout: WallLayout = {}
  let top = Math.max(-1, ...Object.values(parsed.data.placements).map((p) => p.order))
  for (const item of items) {
    const kept = parsed.data.placements[item.id]
    if (kept) layout[item.id] = { ...kept, ...clampToWall(item.kind, kept.x, kept.y) }
    else layout[item.id] = { ...fallback[item.id], order: ++top }
  }
  return layout
}

export const serializeWallLayout = (layout: WallLayout) => ({ version: WALL_LAYOUT_VERSION, placements: layout })

/** Leva a peça para a frente das outras (a que foi mexida por último fica por cima). */
export function bringToFront(layout: WallLayout, id: string): WallLayout {
  const top = Math.max(...Object.values(layout).map((p) => p.order))
  if (layout[id]?.order === top) return layout
  return { ...layout, [id]: { ...layout[id], order: top + 1 } }
}

/** Linha vermelha: da polaroide da evidência para cada nota, personagem e primeira folha; as folhas entre si. */
export function wallStrings(items: WallItemRef[]): Array<[string, string]> {
  const cover = items.find((item) => item.kind === 'cover')
  const sheets = items.filter((item) => item.kind === 'sheet')
  const links: Array<[string, string]> = []
  if (cover) {
    for (const item of items) if (item.kind === 'note' || item.kind === 'character') links.push([cover.id, item.id])
    if (sheets[0]) links.push([cover.id, sheets[0].id])
  }
  for (let i = 1; i < sheets.length; i++) links.push([sheets[i - 1].id, sheets[i].id])
  return links
}
