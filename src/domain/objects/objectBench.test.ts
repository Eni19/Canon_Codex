import { describe, expect, it } from 'vitest'
import { bringToFront, readSurfaceLayout, serializeSurfaceLayout } from '@/domain/canvas/surfaceLayout'
import { BENCH, BENCH_SIZE, caliperReading, clampToBench, defaultBenchLayout, isOverSpecimen, type BenchItemRef } from './objectBench'

const items: BenchItemRef[] = [
  { id: 'specimen', kind: 'specimen' },
  { id: 'caliper', kind: 'caliper' },
  { id: 'loupe', kind: 'loupe' },
  ...Array.from({ length: 7 }, (_, i) => ({ id: `note:${i}`, kind: 'note' as const })),
  { id: 'label:registro', kind: 'label' },
  { id: 'sheet:a:1', kind: 'sheet' },
  { id: 'sheet:a:2', kind: 'sheet' },
]

describe('bancada de Objetos', () => {
  it('coloca todas as peças dentro da bancada, sem ferramentas sobre a foto no início', () => {
    const layout = defaultBenchLayout(items)
    for (const item of items) {
      const p = layout[item.id], { w, h } = BENCH_SIZE[item.kind]
      expect(Math.abs(p.x) + w / 2).toBeLessThanOrEqual(BENCH.width / 2)
      expect(Math.abs(p.y) + h / 2).toBeLessThanOrEqual(BENCH.height / 2)
    }
    expect(isOverSpecimen(layout.caliper, layout.specimen)).toBe(false)
    expect(isOverSpecimen(layout.loupe, layout.specimen)).toBe(false)
    expect(new Set(Object.values(layout).map((p) => p.order)).size).toBe(items.length)
  })

  it('não deixa uma peça sair da bancada', () => {
    expect(clampToBench('note', 99, -99)).toEqual({ x: BENCH.width / 2 - 0.21 - 0.05, y: -(BENCH.height / 2 - 0.21 - 0.05) })
  })

  it('reconhece uma ferramenta sobre a foto', () => {
    expect(isOverSpecimen({ x: 0.3, y: 0.1 }, { x: 0, y: 0 })).toBe(true)
    expect(isOverSpecimen({ x: 1.2, y: 0 }, { x: 0, y: 0 })).toBe(false)
  })

  it('lê o paquímetro a partir do texto das dimensões', () => {
    expect(caliperReading('12 × 4 cm')).toEqual({ value: '12,00', unit: 'cm' })
    expect(caliperReading('Lâmina de 7,5 pol')).toEqual({ value: '7,50', unit: 'pol' })
    expect(caliperReading('30mm')).toEqual({ value: '30,00', unit: 'mm' })
    expect(caliperReading('do tamanho de uma mão')).toBeNull()
  })

  it('mantém a arrumação salva, completa peças novas e descarta as removidas', () => {
    const initial = defaultBenchLayout(items)
    const moved = bringToFront({ ...initial, caliper: { ...initial.caliper, x: 0.1, y: 0.1 } }, 'caliper')
    const saved = JSON.parse(JSON.stringify(serializeSurfaceLayout(moved)))
    const next = [...items.filter((item) => item.id !== 'sheet:a:2'), { id: 'note:novo', kind: 'note' as const }]
    const read = readSurfaceLayout(saved, next, defaultBenchLayout(next), (item, x, y) => clampToBench(item.kind, x, y))
    expect(read.caliper).toMatchObject({ x: 0.1, y: 0.1 })
    expect(read['sheet:a:2']).toBeUndefined()
    expect(read['note:novo'].order).toBeGreaterThan(moved.caliper.order)
    expect(readSurfaceLayout({ version: 9 }, items, initial, (item, x, y) => clampToBench(item.kind, x, y))).toBe(initial)
  })
})
