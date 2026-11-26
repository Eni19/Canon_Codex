import { describe, expect, it } from 'vitest'
import { SceneCanvasSchema, fromTldrawSceneSnapshot, placePoiMarkers, readSceneCanvas } from './sceneCanvas'

const tldrawSnapshot = () => ({
  document: {
    schema: { schemaVersion: 2, sequences: {} },
    store: {
      'document:document': { id: 'document:document', typeName: 'document', gridSize: 10, name: '', meta: {} },
      'page:page': { id: 'page:page', typeName: 'page', name: 'Página', index: 'a1', meta: {} },
      'shape:bg': { id: 'shape:bg', typeName: 'shape', type: 'scene-background', x: 0, y: 0, rotation: 0, index: 'a1', isLocked: true, opacity: 1, meta: {}, parentId: 'page:page', props: { w: 1600, h: 900, assetId: 'asset-1' } },
      'shape:token-b': { id: 'shape:token-b', typeName: 'shape', type: 'scene-token', x: 300, y: 120, rotation: 0.5, index: 'a3', isLocked: false, opacity: 1, meta: {}, parentId: 'page:page', props: { w: 140, h: 140, entityId: 'entity-b', representation: 'round', visibility: 'hidden', locked: true } },
      'shape:poi': { id: 'shape:poi', typeName: 'shape', type: 'scene-poi', x: 782, y: 432, rotation: 0, index: 'a2', isLocked: true, opacity: 1, meta: {}, parentId: 'page:page', props: { w: 180, h: 38, poiId: 'poi-1', visibility: 'hidden' } },
      'shape:token-a': { id: 'shape:token-a', typeName: 'shape', type: 'scene-token', x: 10, y: 20, rotation: 0, index: 'a2V', isLocked: false, opacity: 1, meta: { flipX: true }, parentId: 'page:page', props: { w: 180, h: 280, entityId: 'entity-a', representation: 'cutout', visibility: 'visible', locked: false } },
      'shape:arrow': { id: 'shape:arrow', typeName: 'shape', type: 'arrow', x: 0, y: 0, rotation: 0, index: 'a4', props: {} },
    },
  },
})

describe('canvas de cena', () => {
  it('converte o snapshot do tldraw na ordem de desenho, sem o fundo e sem tipos desconhecidos', () => {
    const canvas = fromTldrawSceneSnapshot(tldrawSnapshot())
    expect(canvas.shapes.map((shape) => shape.id)).toEqual(['shape:poi', 'shape:token-a', 'shape:token-b'])
    expect(canvas.shapes[1]).toEqual({ id: 'shape:token-a', kind: 'token', x: 10, y: 20, rotation: 0, w: 180, h: 280, entityId: 'entity-a', representation: 'cutout', visibility: 'visible', locked: false, flipX: true })
    expect(canvas.shapes[2]).toMatchObject({ kind: 'token', representation: 'round', visibility: 'hidden', locked: true, flipX: false, rotation: 0.5 })
    expect(canvas.shapes[0]).toEqual({ id: 'shape:poi', kind: 'poi', x: 782, y: 432, rotation: 0, w: 180, h: 38, poiId: 'poi-1', visibility: 'hidden' })
    expect(SceneCanvasSchema.parse(canvas)).toEqual(canvas)
  })

  it('guarda o documento original para permitir voltar ao tldraw', () => {
    const snapshot = tldrawSnapshot()
    expect(readSceneCanvas(snapshot).legacyTldraw).toEqual(snapshot)
  })

  it('lê o formato próprio sem converter de novo e é idempotente depois de salvar', () => {
    const first = readSceneCanvas(tldrawSnapshot())
    const saved = JSON.parse(JSON.stringify(first))
    expect(readSceneCanvas(saved)).toEqual(first)
    expect(readSceneCanvas(readSceneCanvas(saved))).toEqual(first)
  })

  it('trata cena nova como vazia e recusa dados ilegíveis', () => {
    expect(readSceneCanvas(null).shapes).toEqual([])
    expect(readSceneCanvas(undefined).shapes).toEqual([])
    expect(() => readSceneCanvas({ foo: 1 })).toThrow()
    expect(() => readSceneCanvas({ format: 'canon-scene-canvas', version: 99, shapes: [] })).toThrow()
  })

  it('completa valores ausentes ou inválidos com os padrões do editor', () => {
    const canvas = fromTldrawSceneSnapshot({ document: { store: { t: { typeName: 'shape', type: 'scene-token', id: 't', index: 'a1', x: 'x', props: { w: -1 } } } } })
    expect(canvas.shapes[0]).toMatchObject({ x: 0, y: 0, w: 180, h: 280, representation: 'cutout', visibility: 'visible', locked: false })
  })

  it('posiciona marcadores pelos pontos do Local, preservando id, ordem e visibilidade', () => {
    const canvas = fromTldrawSceneSnapshot(tldrawSnapshot())
    let next = 0
    const placed = placePoiMarkers(canvas, [{ id: 'poi-1', x: 50, y: 50 }, { id: 'poi-2', x: 10, y: 20 }], { width: 1600, height: 900 }, () => `novo-${++next}`)
    expect(placed.shapes[0]).toMatchObject({ id: 'shape:poi', x: 782, y: 432, visibility: 'hidden' })
    expect(placed.shapes.at(-1)).toEqual({ id: 'novo-1', kind: 'poi', x: 142, y: 162, rotation: 0, w: 180, h: 38, poiId: 'poi-2', visibility: 'visible' })
    expect(placed.shapes).toHaveLength(4)
    expect(placePoiMarkers(placed, [{ id: 'poi-2', x: 10, y: 20 }], { width: 1600, height: 900 }, () => 'outro').shapes).toHaveLength(4)
  })
})
