import { describe, expect, it } from 'vitest'
import type { Frame } from '@/domain/canvas/geometry'
import { arrowGeometry, arrowheadBase, bendHandle, bendThrough, distanceToPath, pathLength } from './boardArrow'
import type { BoardArrow } from './boardCanvas'

const arrow = (patch: Partial<BoardArrow> = {}): BoardArrow => ({
  id: 'a', kind: 'arrow', x: 0, y: 0, rotation: 0, opacity: 1, locked: false, start: { x: 0, y: 0 }, end: { x: 300, y: 0 }, bend: 0,
  color: 'black', labelColor: 'black', size: 'm', font: 'draw', dash: 'draw', arrowheadStart: 'none', arrowheadEnd: 'arrow', text: '', labelPosition: 0.5, scale: 1,
  startBinding: null, endBinding: null, ...patch,
})
const frames: Record<string, Frame> = { card: { x: 400, y: -50, w: 200, h: 100, rotation: 0 }, left: { x: -100, y: -50, w: 100, h: 100, rotation: 0 } }
const frameOf = (id: string) => frames[id] ?? null

describe('geometria da seta', () => {
  it('liga a ponta ao centro da forma e para antes da borda, com o recuo da cabeça', () => {
    const geometry = arrowGeometry(arrow({ endBinding: { shapeId: 'card', anchor: { x: 0, y: 0 }, isPrecise: false, isExact: false } }), frameOf)
    expect(geometry.end).toEqual({ x: 500, y: 0 })
    const tip = geometry.points.at(-1)!
    // Borda em x = 400, menos 10 + metade de 3,5.
    expect(tip.x).toBeCloseTo(400 - 11.75, 1)
    expect(tip.y).toBeCloseTo(0)
  })

  it('sem cabeça, a ponta encosta na borda', () => {
    const geometry = arrowGeometry(arrow({ arrowheadEnd: 'none', endBinding: { shapeId: 'card', anchor: { x: 0.5, y: 0.5 }, isPrecise: true, isExact: false } }), frameOf)
    expect(geometry.points.at(-1)!.x).toBeCloseTo(400, 1)
  })

  it('usa a âncora precisa quando marcada', () => {
    const geometry = arrowGeometry(arrow({ endBinding: { shapeId: 'card', anchor: { x: 0.25, y: 1 }, isPrecise: true, isExact: true } }), frameOf)
    expect(geometry.end).toEqual({ x: 450, y: 50 })
  })

  it('desenha um arco pelo ponto do meio e acha o bend de volta', () => {
    const geometry = arrowGeometry(arrow({ bend: 50 }), frameOf)
    expect(geometry.points.length).toBeGreaterThan(10)
    const handle = bendHandle({ x: 0, y: 0 }, { x: 300, y: 0 }, 50)
    expect(handle).toEqual({ x: 150, y: 50 })
    expect(distanceToPath(geometry.points, handle)).toBeLessThan(1)
    expect(bendThrough({ x: 0, y: 0 }, { x: 300, y: 0 }, handle)).toBeCloseTo(50)
    expect(pathLength(geometry.points)).toBeGreaterThan(300)
  })

  it('a cabeça mede entre uma e três espessuras', () => {
    const { point, int } = arrowheadBase([{ x: 0, y: 0 }, { x: 300, y: 0 }], 'end', 3.5)
    expect(point).toEqual({ x: 300, y: 0 })
    expect(300 - int.x).toBeCloseTo(10.5)
    // Seta curta: a cabeça não fica menor que uma espessura.
    expect(arrowheadBase([{ x: 0, y: 0 }, { x: 10, y: 0 }], 'end', 3.5).int.x).toBeCloseTo(6.5)
  })

  it('ligada à mesma forma nas duas pontas, não recorta', () => {
    const geometry = arrowGeometry(arrow({ startBinding: { shapeId: 'left', anchor: { x: 0, y: 0 }, isPrecise: true, isExact: false }, endBinding: { shapeId: 'left', anchor: { x: 1, y: 1 }, isPrecise: true, isExact: false } }), frameOf)
    expect(geometry.points[0]).toEqual({ x: -100, y: -50 })
    expect(geometry.points.at(-1)).toEqual({ x: 0, y: 50 })
  })
})
