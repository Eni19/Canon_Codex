import { describe, expect, it } from 'vitest'
import { createTimelineStressFixture } from '../../../scripts/timeline-stress-fixture'
import { buildTimelineCanvasLayout, canvasNodesInViewport, CANVAS_CARD_HEIGHT, CANVAS_CARD_WIDTH, centerTimelinePoint, fitTimelineCanvas, pinchTimelineCamera, worldPoint, zoomTimelineAt } from './timelineCanvas'

describe('coordenadas e câmera do mapa temporal', () => {
  const fixture = createTimelineStressFixture()
  const layout = buildTimelineCanvasLayout(fixture.world.calendar, fixture.timeline.appearances, 'horizontal')

  it('posiciona as 500 aparições nas duas orientações, em ordem, sem sobreposição de cartões', () => {
    for (const orientation of ['horizontal', 'vertical'] as const) {
      const layout = buildTimelineCanvasLayout(fixture.world.calendar, fixture.timeline.appearances, orientation)
      expect(layout.nodes).toHaveLength(500)
      expect(new Set(layout.nodes.map(node => node.appearance.id)).size).toBe(500)
      expect(layout.nodes.slice(-50).every(node => node.undated)).toBe(true)
      for (let i = 0; i < layout.nodes.length; i++) {
        for (const other of layout.nodes.slice(i + 1)) {
          const node = layout.nodes[i]
          expect(Math.abs(node.x - other.x) >= CANVAS_CARD_WIDTH || Math.abs(node.y - other.y) >= CANVAS_CARD_HEIGHT + 40).toBe(true)
        }
      }
    }
  })

  it('conserva o ponto sob o cursor em múltiplos níveis de zoom, inclusive nos limites', () => {
    const camera = { x: -370, y: 81, scale: 0.8 }
    const cursor = { x: 173, y: 290 }
    for (const scale of [0.008, 0.1, 1, 2.4, 900, -1]) {
      const after = zoomTimelineAt(camera, cursor, scale)
      expect(worldPoint(after, cursor).x).toBeCloseTo(worldPoint(camera, cursor).x)
      expect(worldPoint(after, cursor).y).toBeCloseTo(worldPoint(camera, cursor).y)
    }
  })

  it('combina translação e zoom do pinch pelo ponto médio dos dedos', () => {
    const before: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 100, y: 100 }, { x: 200, y: 100 }]
    const after: typeof before = [{ x: 100, y: 120 }, { x: 300, y: 120 }]
    const camera = { x: 0, y: 0, scale: 1 }
    const next = pinchTimelineCamera(camera, before, after)
    expect(next.scale).toBe(2)
    expect(worldPoint(next, { x: 200, y: 120 })).toEqual({ x: 150, y: 100 })
  })

  it('enquadra toda a linha e limita o DOM ao viewport sem alterar os dados', () => {
    const original = JSON.stringify(fixture.timeline)
    const size = { width: 1200, height: 800 }
    const camera = fitTimelineCanvas(layout, size)
    expect(layout.width * camera.scale).toBeLessThanOrEqual(size.width)
    expect(layout.height * camera.scale).toBeLessThanOrEqual(size.height)
    expect(canvasNodesInViewport(layout, camera, size)).toHaveLength(0)
    const centered = centerTimelinePoint({ x: 0, y: 0, scale: 1 }, layout.nodes[250], size)
    const visible = canvasNodesInViewport(layout, centered, size)
    expect(visible.some(node => node.appearance.id === layout.nodes[250].appearance.id)).toBe(true)
    expect(visible.length).toBeLessThan(30)
    expect(JSON.stringify(fixture.timeline)).toBe(original)
  })

  it('os filtros são uma seleção de IDs, sem reconstruir coordenadas ou câmera', () => {
    const camera = { x: 80, y: -240, scale: 0.8 }
    const visible = canvasNodesInViewport(layout, camera, { width: 390, height: 844 })
    const filteredIds = new Set(layout.nodes.filter(node => node.appearance.title?.includes('007')).map(node => node.appearance.id))
    const filtered = visible.map(node => ({ ...node, hidden: !filteredIds.has(node.appearance.id) }))
    expect(filtered.map(({ x, y }) => [x, y])).toEqual(visible.map(({ x, y }) => [x, y]))
    expect(camera).toEqual({ x: 80, y: -240, scale: 0.8 })
  })
})
