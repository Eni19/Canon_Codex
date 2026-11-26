import { clampInside, tilt, type SurfaceLayout } from '@/domain/canvas/surfaceLayout'

/**
 * A bancada 3D de um Objeto: um tapete de corte escuro onde ficam a foto técnica do objeto, as
 * ferramentas de estudo (paquímetro para as dimensões, lupa para os materiais), notas adesivas,
 * etiquetas e as folhas do relatório. Unidades da cena, bancada centrada na origem.
 */
export const BENCH = { width: 4.6, height: 2.6 } as const
export const BENCH_MARGIN = 0.05

export type BenchItemKind = 'specimen' | 'caliper' | 'loupe' | 'note' | 'label' | 'sheet'
export const BENCH_SIZE: Record<BenchItemKind, { w: number; h: number }> = {
  specimen: { w: 1.04, h: 0.9 },
  caliper: { w: 1.36, h: 0.36 },
  loupe: { w: 0.62, h: 0.34 },
  note: { w: 0.42, h: 0.42 },
  label: { w: 0.5, h: 0.22 },
  sheet: { w: 0.54, h: 0.74 },
}

export type BenchItemRef = { id: string; kind: BenchItemKind }

export const clampToBench = (kind: BenchItemKind, x: number, y: number) => clampInside(BENCH, BENCH_SIZE[kind], BENCH_MARGIN, x, y)

/** Ferramentas ficam retas, como apoiadas na bancada; papéis ganham uma inclinação leve. */
const angleOf = (item: BenchItemRef) => item.kind === 'caliper' ? -0.12 : item.kind === 'loupe' ? 0.35 : tilt(item.id, item.kind === 'specimen' ? 0.02 : 0.06)

/**
 * Arrumação inicial: a foto do objeto no centro, o paquímetro em cima e a lupa embaixo dela (perto o
 * bastante para chamar o uso), notas à esquerda, folhas do relatório à direita, etiquetas em baixo.
 */
export function defaultBenchLayout(items: BenchItemRef[]): SurfaceLayout {
  const layout: SurfaceLayout = {}
  let order = 0
  const place = (item: BenchItemRef, x: number, y: number) => {
    layout[item.id] = { ...clampToBench(item.kind, x, y), rotation: angleOf(item), order: order++ }
  }
  const of = (kind: BenchItemKind) => items.filter((item) => item.kind === kind)
  of('specimen').forEach((item) => place(item, -0.1, 0.02))
  of('sheet').forEach((item, i) => place(item, 0.92 + (i % 3) * 0.2, 0.28 - (i % 3) * 0.1 - Math.floor(i / 3) * 0.12))
  of('note').forEach((item, i) => place(item, -1.22 - Math.floor(i / 3) * 0.46, 0.5 - (i % 3) * 0.46))
  of('label').forEach((item, i) => place(item, -0.62 + i * 0.56, -0.86))
  of('caliper').forEach((item) => place(item, 0.2, 0.84))
  of('loupe').forEach((item) => place(item, 0.95, -0.62))
  return layout
}

/** A ferramenta está sobre a foto do objeto quando o centro dela cai dentro da foto (com folga). */
export function isOverSpecimen(tool: { x: number; y: number }, specimen: { x: number; y: number }, slack = 0.08) {
  const { w, h } = BENCH_SIZE.specimen
  return Math.abs(tool.x - specimen.x) < w / 2 + slack && Math.abs(tool.y - specimen.y) < h / 2 + slack
}

export type CaliperReading = { value: string; unit: string }

/**
 * Leitura do paquímetro a partir do texto livre de "Dimensões" ("12 × 4 cm", "30cm de altura"):
 * o primeiro número e a unidade que vier depois dele. Sem número, não há leitura.
 */
export function caliperReading(dimensions: string): CaliperReading | null {
  const match = dimensions.match(/(\d+(?:[.,]\d+)?)/)
  if (!match) return null
  const number = Number(match[1].replace(',', '.'))
  const unit = dimensions.slice((match.index ?? 0) + match[1].length).match(/\b(mm|cm|m|km|pol|in|ft|pés?)\b/i)?.[1].toLowerCase() ?? ''
  return { value: number.toFixed(2).replace('.', ','), unit }
}
