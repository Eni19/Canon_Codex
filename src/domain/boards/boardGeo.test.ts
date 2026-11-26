import { describe, expect, it } from 'vitest'
import { GEO_TYPES } from './boardCanvas'
import { geoOutline, handDrawnPath } from './boardGeo'
import { fromTldrawBoardSnapshot } from './boardCanvas'

describe('formas do quadro', () => {
  it('todas as formas cabem na caixa e têm contorno fechado', () => {
    for (const geo of GEO_TYPES) {
      const { outline, marks } = geoOutline(geo, 200, 100)
      expect(outline.length, geo).toBeGreaterThanOrEqual(3)
      for (const p of [...outline, ...marks.flat()]) {
        expect(p.x, geo).toBeGreaterThanOrEqual(-0.01)
        expect(p.x, geo).toBeLessThanOrEqual(200.01)
        expect(p.y, geo).toBeGreaterThanOrEqual(-0.01)
        expect(p.y, geo).toBeLessThanOrEqual(100.01)
      }
    }
    expect(geoOutline('x-box', 10, 10).marks).toHaveLength(2)
    expect(geoOutline('check-box', 10, 10).marks).toHaveLength(1)
  })

  it('o traço desenhado à mão é sempre igual para a mesma forma e fica perto do contorno', () => {
    const square = geoOutline('rectangle', 100, 100).outline
    const a = handDrawnPath(square, true, 'shape:1', 3.5)
    expect(handDrawnPath(square, true, 'shape:1', 3.5)).toEqual(a)
    expect(handDrawnPath(square, true, 'shape:2', 3.5)).not.toEqual(a)
    for (const p of a) {
      const distance = Math.min(Math.abs(p.x), Math.abs(p.x - 100), Math.abs(p.y), Math.abs(p.y - 100))
      expect(distance).toBeLessThanOrEqual(3.5)
    }
    expect(a[0]).toEqual(a[a.length - 1])
  })

  it('converte notas, formas, linhas e imagens do tldraw', () => {
    const rich = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pista' }] }] }
    const canvas = fromTldrawBoardSnapshot({
      document: {
        store: {
          'asset:1': { id: 'asset:1', typeName: 'asset', type: 'image', props: {}, meta: { wikiAssetId: 'canon-asset' } },
          'shape:n': { id: 'shape:n', typeName: 'shape', type: 'note', x: 0, y: 0, rotation: 0, index: 'a1', props: { color: 'yellow', size: 'l', font: 'sans', align: 'middle-legacy', verticalAlign: 'start', growY: 12, scale: 1, labelColor: 'black', richText: rich } },
          'shape:g': { id: 'shape:g', typeName: 'shape', type: 'geo', x: 1, y: 2, rotation: 0, index: 'a2', props: { geo: 'star', w: 120, h: 80, color: 'red', fill: 'pattern', dash: 'dotted', size: 's', font: 'mono', align: 'start', verticalAlign: 'middle', growY: 0, scale: 1, labelColor: 'blue', richText: rich } },
          'shape:l': { id: 'shape:l', typeName: 'shape', type: 'line', x: 0, y: 0, rotation: 0, index: 'a3', props: { color: 'black', dash: 'solid', size: 'm', spline: 'cubic', scale: 1, points: { b: { id: 'b', index: 'a2', x: 10, y: 0 }, a: { id: 'a', index: 'a1', x: 0, y: 0 } } } },
          'shape:i': { id: 'shape:i', typeName: 'shape', type: 'image', x: 0, y: 0, rotation: 0, index: 'a4', props: { w: 300, h: 200, assetId: 'asset:1', flipX: true, flipY: false } },
          'shape:d': { id: 'shape:d', typeName: 'shape', type: 'draw', x: 0, y: 0, rotation: 0, index: 'a5', props: { segments: [{ type: 'free', path: 'AAAA' }] } },
        },
      },
    })
    expect(canvas.shapes.map((shape) => shape.kind)).toEqual(['note', 'geo', 'line', 'image', 'legacy'])
    expect(canvas.shapes[0]).toMatchObject({ kind: 'note', color: 'yellow', size: 'l', font: 'sans', align: 'middle', verticalAlign: 'start', growY: 12, text: 'Pista' })
    expect(canvas.shapes[1]).toMatchObject({ kind: 'geo', geo: 'star', w: 120, h: 80, fill: 'pattern', dash: 'dotted', labelColor: 'blue', align: 'start' })
    expect(canvas.shapes[2]).toMatchObject({ kind: 'line', spline: 'cubic', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] })
    expect(canvas.shapes[3]).toMatchObject({ kind: 'image', assetId: 'canon-asset', w: 300, h: 200, flipX: true })
  })
})
