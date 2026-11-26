import { describe, expect, it } from 'vitest'
import { BoardCanvasSchema, fromTldrawBoardSnapshot, readBoardCanvas, richTextToPlain } from './boardCanvas'

const rich = (...paragraphs: string[]) => ({ type: 'doc', content: paragraphs.map((text) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })) })

const tldrawSnapshot = () => ({
  document: {
    schema: { schemaVersion: 2, sequences: {} },
    store: {
      'page:page': { id: 'page:page', typeName: 'page', index: 'a1', meta: {} },
      'shape:card': { id: 'shape:card', typeName: 'shape', type: 'entity-card', x: 10, y: 20, rotation: 0, index: 'a1', isLocked: false, opacity: 1, meta: {}, parentId: 'page:page', props: { w: 280, h: 170, entityId: 'entity-1', viewMode: 'dossier', showImage: false, showType: true, showTags: true, showStatus: true, customLabel: 'Apelido' } },
      'shape:text': { id: 'shape:text', typeName: 'shape', type: 'text', x: 300, y: 40, rotation: 0, index: 'a3', isLocked: true, opacity: 0.5, meta: {}, parentId: 'page:page', props: { color: 'red', size: 'l', w: 8, font: 'serif', textAlign: 'middle', autoSize: true, scale: 1, richText: rich('Primeira', 'Segunda') } },
      'shape:arrow': { id: 'shape:arrow', typeName: 'shape', type: 'arrow', x: 100, y: 100, rotation: 0, index: 'a2', isLocked: false, opacity: 1, meta: {}, parentId: 'page:page', props: { kind: 'arc', dash: 'draw', size: 'm', fill: 'none', color: 'black', labelColor: 'black', bend: 12, start: { x: 0, y: 0 }, end: { x: 200, y: 0 }, arrowheadStart: 'none', arrowheadEnd: 'arrow', richText: rich('liga'), labelPosition: 0.5, font: 'draw', scale: 1 } },
      'shape:geo': { id: 'shape:geo', typeName: 'shape', type: 'geo', x: 0, y: 0, rotation: 0, index: 'a4', props: { w: 50, h: 60, geo: 'rectangle' } },
      'binding:1': { id: 'binding:1', typeName: 'binding', type: 'arrow', fromId: 'shape:arrow', toId: 'shape:card', props: { terminal: 'start', normalizedAnchor: { x: 0.2, y: 0.8 }, isPrecise: true, isExact: false, snap: 'none' } },
      'binding:2': { id: 'binding:2', typeName: 'binding', type: 'arrow', fromId: 'shape:arrow', toId: 'shape:apagada', props: { terminal: 'end', normalizedAnchor: { x: 0.5, y: 0.5 }, isPrecise: false, isExact: false } },
    },
  },
})

describe('canvas de quadro', () => {
  it('converte cartões, textos e setas do tldraw na ordem de desenho', () => {
    const canvas = fromTldrawBoardSnapshot(tldrawSnapshot())
    expect(canvas.shapes.map((shape) => shape.kind)).toEqual(['card', 'arrow', 'text', 'legacy'])
    expect(canvas.shapes[0]).toMatchObject({ kind: 'card', entityId: 'entity-1', viewMode: 'dossier', showImage: false, customLabel: 'Apelido', w: 280, h: 170 })
    expect(canvas.shapes[2]).toMatchObject({ kind: 'text', text: 'Primeira\nSegunda', color: 'red', size: 'l', font: 'serif', textAlign: 'middle', locked: true, opacity: 0.5 })
    expect(BoardCanvasSchema.parse(canvas)).toEqual(canvas)
  })

  it('leva os vínculos das setas e descarta vínculos para formas que não existem', () => {
    const arrow = fromTldrawBoardSnapshot(tldrawSnapshot()).shapes[1]
    expect(arrow).toMatchObject({ kind: 'arrow', bend: 12, text: 'liga', end: { x: 200, y: 0 }, endBinding: null })
    expect(arrow.kind === 'arrow' && arrow.startBinding).toEqual({ shapeId: 'shape:card', anchor: { x: 0.2, y: 0.8 }, isPrecise: true, isExact: false })
  })

  it('guarda o original e as formas sem equivalente intactas', () => {
    const snapshot = tldrawSnapshot()
    const canvas = readBoardCanvas(snapshot)
    expect(canvas.legacyTldraw).toEqual(snapshot)
    expect(canvas.shapes[3]).toMatchObject({ kind: 'legacy', type: 'geo', w: 50, h: 60, record: snapshot.document.store['shape:geo'] })
  })

  it('lê o formato próprio sem converter de novo e recusa dados ilegíveis', () => {
    const first = readBoardCanvas(tldrawSnapshot())
    const saved = JSON.parse(JSON.stringify(first))
    expect(readBoardCanvas(saved)).toEqual(first)
    expect(readBoardCanvas(null).shapes).toEqual([])
    expect(() => readBoardCanvas({ foo: 1 })).toThrow()
  })

  it('transforma richText em texto simples', () => {
    expect(richTextToPlain(rich('a', '', 'b'))).toBe('a\n\nb')
    expect(richTextToPlain({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }, { type: 'hardBreak' }, { type: 'text', text: 'y' }] }] })).toBe('x\ny')
    expect(richTextToPlain(undefined)).toBe('')
  })
})

