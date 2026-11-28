import { BOARD_SCHEMA_VERSION, BoardDocumentSchema } from '../src/domain/boards/board'
import { BOARD_CANVAS_FORMAT, BOARD_CANVAS_VERSION, BOARD_COLORS, type BoardShape } from '../src/domain/boards/boardCanvas'
import { createRelationshipStressFixture } from './relationship-stress-fixture'

const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`

export const BOARD_STRESS_COUNTS = { cards: 300, arrows: 300, notes: 200, geos: 200, draws: 200, texts: 100, lines: 100 } as const

/**
 * Quadro sintético e determinístico com 1.400 itens de todos os tipos, sobre o mundo sintético do
 * grafo (500 registros). Serve só para medir desempenho; nada vem de \`workspace/\`. Com
 * `allTypes`, os registros passam pelos 17 tipos do mundo semente, para os cartões mostrarem todas
 * as silhuetas (#72).
 */
export function createBoardStressFixture({ allTypes = false } = {}) {
  const { world, entities } = createRelationshipStressFixture({ allTypes })
  const base = { rotation: 0, opacity: 1, locked: false }
  const shapes: BoardShape[] = []
  const color = (i: number) => BOARD_COLORS[i % (BOARD_COLORS.length - 1)]
  // Cartões em grade de 20 × 15, com setas para o vizinho da direita e o de baixo.
  for (let i = 0; i < BOARD_STRESS_COUNTS.cards; i++) {
    shapes.push({
      ...base, id: `shape:card-${i}`, kind: 'card', x: (i % 20) * 360, y: Math.floor(i / 20) * 260, w: 280, h: 170, entityId: entities[i].id,
      viewMode: (['card', 'minimal', 'portrait', 'dossier'] as const)[i % 4], showImage: true, showType: true, showTags: true, showStatus: true, customLabel: '',
    })
  }
  for (let i = 0; i < BOARD_STRESS_COUNTS.arrows; i++) {
    const from = i % 300, to = i % 2 ? Math.min(299, from + 20) : (from % 20 === 19 ? from - 1 : from + 1)
    shapes.push({
      ...base, id: `shape:arrow-${i}`, kind: 'arrow', x: 0, y: 0, start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, bend: i % 3 === 0 ? 30 : 0,
      color: 'black', labelColor: 'black', size: 'm', font: 'draw', dash: 'draw', arrowheadStart: 'none', arrowheadEnd: 'arrow', text: i % 5 === 0 ? 'liga' : '', labelPosition: 0.5, scale: 1,
      startBinding: { shapeId: `shape:card-${from}`, anchor: { x: 0.5, y: 0.5 }, isPrecise: false, isExact: false },
      endBinding: { shapeId: `shape:card-${to}`, anchor: { x: 0.5, y: 0.5 }, isPrecise: false, isExact: false },
    })
  }
  // Notas, formas, desenhos, textos e linhas numa faixa abaixo dos cartões.
  const top = 15 * 260 + 200
  for (let i = 0; i < BOARD_STRESS_COUNTS.notes; i++) {
    shapes.push({ ...base, id: `shape:note-${i}`, kind: 'note', x: (i % 20) * 360, y: top + Math.floor(i / 20) * 260, color: color(i), size: 'm', scale: 1, text: `Nota sintética ${i}`, labelColor: 'black', font: 'draw', align: 'middle', verticalAlign: 'middle', growY: 0 })
  }
  for (let i = 0; i < BOARD_STRESS_COUNTS.geos; i++) {
    shapes.push({
      ...base, id: `shape:geo-${i}`, kind: 'geo', geo: i % 2 ? 'ellipse' : 'rectangle', x: (i % 20) * 360 + 220, y: top + 2600 + Math.floor(i / 20) * 260, w: 160, h: 120,
      color: color(i), fill: (['none', 'semi', 'solid', 'pattern'] as const)[i % 4], dash: (['draw', 'solid', 'dashed'] as const)[i % 3], size: 'm', scale: 1,
      text: i % 3 === 0 ? 'Forma' : '', labelColor: 'black', font: 'draw', align: 'middle', verticalAlign: 'middle', growY: 0,
    })
  }
  for (let i = 0; i < BOARD_STRESS_COUNTS.draws; i++) {
    const points = Array.from({ length: 60 }, (_, k) => [k * 4, Math.sin((k + i) / 5) * 30, 0.5] as [number, number, number])
    shapes.push({ ...base, id: `shape:draw-${i}`, kind: 'draw', x: (i % 20) * 360, y: top + 5200 + Math.floor(i / 20) * 200, points, color: color(i), fill: 'none', dash: 'draw', size: 'm', isClosed: false, isPen: false, scale: 1 })
  }
  for (let i = 0; i < BOARD_STRESS_COUNTS.texts; i++) {
    shapes.push({ ...base, id: `shape:text-${i}`, kind: 'text', x: (i % 20) * 360, y: top + 7400 + Math.floor(i / 20) * 120, w: 8, text: `Texto sintético ${i}`, color: color(i), size: 'm', font: 'draw', textAlign: 'start', autoSize: true, scale: 1 })
  }
  for (let i = 0; i < BOARD_STRESS_COUNTS.lines; i++) {
    shapes.push({ ...base, id: `shape:line-${i}`, kind: 'line', x: (i % 20) * 360, y: top + 8200 + Math.floor(i / 20) * 120, points: [{ x: 0, y: 0 }, { x: 140, y: 40 }, { x: 260, y: -20 }], color: color(i), dash: 'draw', size: 'm', spline: 'line', scale: 1 })
  }
  const now = '2026-11-26T12:00:00.000Z'
  const board = BoardDocumentSchema.parse({
    schemaVersion: BOARD_SCHEMA_VERSION, id: id('40000000', 1), worldId: world.id, title: 'Quadro sintético de desempenho', tags: [],
    canvasSnapshot: { format: BOARD_CANVAS_FORMAT, version: BOARD_CANVAS_VERSION, shapes }, createdAt: now, updatedAt: now,
  })
  return { world, entities, board }
}
