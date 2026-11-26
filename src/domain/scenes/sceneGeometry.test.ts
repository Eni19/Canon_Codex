import { describe, expect, it } from 'vitest'
import type { ScenePoiMarker, SceneToken } from './sceneCanvas'
import { frameIntersectsRect, hitsFrame, resizeShapes, rotateShapes, selectionFrame, shapeFrame, snapToGrid } from './sceneGeometry'

const token = (patch: Partial<SceneToken> = {}): SceneToken => ({ id: 't', kind: 'token', x: 0, y: 0, rotation: 0, w: 100, h: 200, entityId: 'e', representation: 'cutout', visibility: 'visible', locked: false, flipX: false, ...patch })
const poi: ScenePoiMarker = { id: 'p', kind: 'poi', x: 0, y: 0, rotation: 0, w: 180, h: 38, poiId: 'x', visibility: 'visible' }

describe('geometria da cena', () => {
  it('acerta a forma com margem e respeita a rotação', () => {
    const frame = shapeFrame(token())
    expect(hitsFrame(frame, { x: 50, y: 100 })).toBe(true)
    expect(hitsFrame(frame, { x: 102, y: 100 })).toBe(false)
    expect(hitsFrame(frame, { x: 102, y: 100 }, 3)).toBe(true)
    const turned = shapeFrame(token({ rotation: Math.PI / 2 }))
    expect(hitsFrame(turned, { x: -150, y: 50 })).toBe(true)
    expect(hitsFrame(turned, { x: 50, y: 50 })).toBe(false)
  })

  it('seleciona por área quem toca o retângulo', () => {
    expect(frameIntersectsRect(shapeFrame(token()), { x: 90, y: 190, w: 50, h: 50 })).toBe(true)
    expect(frameIntersectsRect(shapeFrame(token()), { x: 120, y: 0, w: 50, h: 50 })).toBe(false)
    expect(frameIntersectsRect(shapeFrame(token({ rotation: Math.PI / 4 })), { x: 80, y: 0, w: 10, h: 10 })).toBe(false)
  })

  it('redimensiona mantendo a proporção a partir do canto oposto', () => {
    const shape = token({ x: 10, y: 20 })
    const [result] = resizeShapes([shape], shapeFrame(shape), 'bottom_right', { x: 210, y: 300 }) as SceneToken[]
    expect(result).toMatchObject({ x: 10, y: 20, w: 200, h: 400 })
    const [fromTop] = resizeShapes([shape], shapeFrame(shape), 'top_left', { x: 60, y: 120 }) as SceneToken[]
    expect(fromTop).toMatchObject({ w: 50, h: 100 })
    expect(fromTop.x + fromTop.w).toBeCloseTo(110)
    expect(fromTop.y + fromTop.h).toBeCloseTo(220)
  })

  it('respeita os mínimos, o formato redondo e os tokens travados', () => {
    const [small] = resizeShapes([token()], shapeFrame(token()), 'bottom_right', { x: 1, y: 1 }) as SceneToken[]
    expect(small).toMatchObject({ w: 48, h: 72 })
    const round = token({ representation: 'round', w: 140, h: 140 })
    const [grown] = resizeShapes([round], shapeFrame(round), 'right', { x: 280, y: 70 }) as SceneToken[]
    expect(grown).toMatchObject({ w: 280, h: 280 })
    const locked = token({ locked: true })
    expect(resizeShapes([locked], shapeFrame(locked), 'bottom_right', { x: 300, y: 600 })[0]).toEqual(locked)
  })

  it('gira em torno do centro e encaixa em 15° com Shift', () => {
    const shape = token({ w: 100, h: 100 })
    const center = { x: 50, y: 50 }
    const [quarter] = rotateShapes([shape], center, { x: 100, y: 50 }, { x: 50, y: 100 }, 0)
    expect(quarter.rotation).toBeCloseTo(Math.PI / 2)
    expect(quarter.x).toBeCloseTo(100)
    expect(quarter.y).toBeCloseTo(0)
    const [snapped] = rotateShapes([shape], center, { x: 100, y: 50 }, { x: 100, y: 58 }, 0, true)
    expect(snapped.rotation).toBeCloseTo(Math.PI / 12)
  })

  it('usa a moldura da forma sozinha e a caixa envolvente para várias', () => {
    expect(selectionFrame([])).toBeNull()
    expect(selectionFrame([token({ rotation: 1 })])?.rotation).toBe(1)
    expect(selectionFrame([token(), { ...poi, x: 200, y: 300 }])).toEqual({ x: 0, y: 0, w: 380, h: 338, rotation: 0 })
  })

  it('encaixa na grade considerando o deslocamento', () => {
    expect(snapToGrid(104, 70, 0)).toBe(70)
    expect(snapToGrid(106, 70, 0)).toBe(140)
    expect(snapToGrid(104, 70, 10)).toBe(80)
  })
})
