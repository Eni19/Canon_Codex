import { z } from 'zod'

/**
 * Arrumação das peças de uma superfície 3D (parede, bancada): posição em unidades da cena,
 * inclinação e ordem de empilhamento. Regras puras; a cena só desenha e move.
 */
export const PlacementSchema = z.object({ x: z.number().finite(), y: z.number().finite(), rotation: z.number().finite(), order: z.number().int().min(0) })
export type Placement = z.infer<typeof PlacementSchema>
export type SurfaceLayout = Record<string, Placement>

export const SURFACE_LAYOUT_VERSION = 1
const SavedLayoutSchema = z.object({ version: z.literal(SURFACE_LAYOUT_VERSION), placements: z.record(z.string(), PlacementSchema) })

/** Pequeno ângulo estável por peça, para que nada fique alinhado demais. */
export function tilt(id: string, amplitude = 0.055) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return (((h >>> 0) % 1000) / 1000 * 2 - 1) * amplitude
}

/** Mantém um retângulo w × h inteiro dentro de uma superfície, com margem. */
export function clampInside(surface: { width: number; height: number }, size: { w: number; h: number }, margin: number, x: number, y: number) {
  const maxX = Math.max(0, surface.width / 2 - size.w / 2 - margin), maxY = Math.max(0, surface.height / 2 - size.h / 2 - margin)
  return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) }
}

/**
 * A arrumação salva vale para as peças que ainda existem; peças novas entram na posição inicial e
 * as removidas somem. Dados ilegíveis voltam para a arrumação inicial.
 */
export function readSurfaceLayout<T extends { id: string }>(saved: unknown, items: T[], initial: SurfaceLayout, clamp: (item: T, x: number, y: number) => { x: number; y: number }): SurfaceLayout {
  const parsed = SavedLayoutSchema.safeParse(saved)
  if (!parsed.success) return initial
  const layout: SurfaceLayout = {}
  let top = Math.max(-1, ...Object.values(parsed.data.placements).map((p) => p.order))
  for (const item of items) {
    const kept = parsed.data.placements[item.id]
    if (kept) layout[item.id] = { ...kept, ...clamp(item, kept.x, kept.y) }
    else if (initial[item.id]) layout[item.id] = { ...initial[item.id], order: ++top }
  }
  return layout
}

export const serializeSurfaceLayout = (layout: SurfaceLayout) => ({ version: SURFACE_LAYOUT_VERSION, placements: layout })

/** Leva a peça para a frente das outras (a que foi mexida por último fica por cima). */
export function bringToFront(layout: SurfaceLayout, id: string): SurfaceLayout {
  const top = Math.max(...Object.values(layout).map((p) => p.order))
  if (layout[id]?.order === top) return layout
  return { ...layout, [id]: { ...layout[id], order: top + 1 } }
}
