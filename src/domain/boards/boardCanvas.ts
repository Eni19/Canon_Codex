import { z } from 'zod'

/**
 * Conteúdo do canvas de um Quadro, em ordem de desenho (o primeiro fica mais ao fundo).
 * Coordenadas seguem a convenção herdada do tldraw: `x`/`y` é o canto superior esquerdo da forma
 * sem rotação e a rotação (radianos) gira em torno desse ponto. Estilos usam os mesmos nomes do
 * tldraw (cores, tamanhos, fontes, traços), para que a conversão não perca nada visível.
 */
export const BOARD_CANVAS_FORMAT = 'canon-board-canvas'
export const BOARD_CANVAS_VERSION = 1

export const BOARD_COLORS = ['black', 'grey', 'light-violet', 'violet', 'blue', 'light-blue', 'yellow', 'orange', 'green', 'light-green', 'light-red', 'red', 'white'] as const
export const BOARD_SIZES = ['s', 'm', 'l', 'xl'] as const
export const BOARD_FONTS = ['draw', 'sans', 'serif', 'mono'] as const
export const BOARD_DASHES = ['draw', 'solid', 'dashed', 'dotted'] as const
export const ARROWHEADS = ['none', 'arrow', 'triangle', 'square', 'dot', 'pipe', 'diamond', 'inverted', 'bar'] as const
export const CARD_VIEW_MODES = ['minimal', 'card', 'portrait', 'dossier', 'wide'] as const
export const BOARD_FILLS = ['none', 'semi', 'solid', 'pattern', 'fill'] as const
export const BOARD_ALIGNS = ['start', 'middle', 'end'] as const
export const GEO_TYPES = ['rectangle', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'octagon', 'star', 'rhombus', 'rhombus-2', 'oval', 'trapezoid', 'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'x-box', 'check-box', 'heart', 'cloud'] as const

export const CARD_DEFAULT = { w: 280, h: 170 } as const
export const CARD_WIDE = { w: 420, h: 190 } as const
export const CARD_MIN = { w: 160, h: 90 } as const
/** Tamanhos dos itens criados com um clique, como no tldraw. */
export const NOTE_SIZE = 200
export const GEO_DEFAULT = 100

const color = z.enum(BOARD_COLORS)
const size = z.enum(BOARD_SIZES)
const font = z.enum(BOARD_FONTS)
const finite = z.number().finite()
const point = z.object({ x: finite, y: finite })
const base = { id: z.string().min(1), x: finite, y: finite, rotation: finite, opacity: z.number().min(0).max(1), locked: z.boolean() }

export const BoardCardSchema = z.object({
  ...base, kind: z.literal('card'), w: z.number().positive(), h: z.number().positive(), entityId: z.string(),
  viewMode: z.enum(CARD_VIEW_MODES), showImage: z.boolean(), showType: z.boolean(), showTags: z.boolean(), showStatus: z.boolean(), customLabel: z.string(),
})
export const BoardTextSchema = z.object({
  ...base, kind: z.literal('text'), w: z.number().positive(), text: z.string(), color, size, font,
  textAlign: z.enum(['start', 'middle', 'end']), autoSize: z.boolean(), scale: z.number().positive(),
  /** Caixa de texto: altura mínima escolhida ao criar arrastando (o texto pode passar dela). */
  boxHeight: z.number().positive().optional(),
})
export const ArrowBindingSchema = z.object({ shapeId: z.string(), anchor: point, isPrecise: z.boolean(), isExact: z.boolean() })
export type ArrowBinding = z.infer<typeof ArrowBindingSchema>
export const BoardArrowSchema = z.object({
  ...base, kind: z.literal('arrow'), start: point, end: point, bend: finite, color, labelColor: color, size, font,
  dash: z.enum(BOARD_DASHES), arrowheadStart: z.enum(ARROWHEADS), arrowheadEnd: z.enum(ARROWHEADS),
  text: z.string(), labelPosition: z.number().min(0).max(1), scale: z.number().positive(),
  startBinding: ArrowBindingSchema.nullable(), endBinding: ArrowBindingSchema.nullable(),
})
const label = { text: z.string(), labelColor: color, font, align: z.enum(BOARD_ALIGNS), verticalAlign: z.enum(BOARD_ALIGNS), growY: z.number().min(0) }
export const BoardNoteSchema = z.object({ ...base, kind: z.literal('note'), color, size, scale: z.number().positive(), ...label })
export const BoardGeoSchema = z.object({
  ...base, kind: z.literal('geo'), geo: z.enum(GEO_TYPES), w: z.number().positive(), h: z.number().positive(), color, fill: z.enum(BOARD_FILLS),
  dash: z.enum(BOARD_DASHES), size, scale: z.number().positive(), ...label,
})
/** Desenho livre: pontos [x, y, pressão] relativos à origem da forma. */
export const BoardDrawSchema = z.object({
  ...base, kind: z.literal('draw'), points: z.array(z.tuple([finite, finite, z.number().min(0).max(1)])), color, fill: z.enum(BOARD_FILLS),
  dash: z.enum(BOARD_DASHES), size, isClosed: z.boolean(), isPen: z.boolean(), scale: z.number().positive(),
})
export const BoardLineSchema = z.object({ ...base, kind: z.literal('line'), points: z.array(point).min(2), color, dash: z.enum(BOARD_DASHES), size, spline: z.enum(['line', 'cubic']), scale: z.number().positive() })
/** Imagem: `assetId` é o ID do asset do Canon (ADR-003), não um caminho. */
export const BoardImageSchema = z.object({ ...base, kind: z.literal('image'), w: z.number().positive(), h: z.number().positive(), assetId: z.string().min(1), flipX: z.boolean(), flipY: z.boolean() })
/** Forma do editor anterior que ainda não tem equivalente: guardada intacta e mostrada como caixa. */
export const BoardLegacySchema = z.object({ ...base, kind: z.literal('legacy'), w: z.number().positive(), h: z.number().positive(), type: z.string(), record: z.unknown() })

export const BoardShapeSchema = z.discriminatedUnion('kind', [BoardCardSchema, BoardTextSchema, BoardArrowSchema, BoardNoteSchema, BoardGeoSchema, BoardDrawSchema, BoardLineSchema, BoardImageSchema, BoardLegacySchema])
export type BoardCard = z.infer<typeof BoardCardSchema>
export type BoardText = z.infer<typeof BoardTextSchema>
export type BoardArrow = z.infer<typeof BoardArrowSchema>
export type BoardLegacy = z.infer<typeof BoardLegacySchema>
export type BoardNote = z.infer<typeof BoardNoteSchema>
export type BoardGeo = z.infer<typeof BoardGeoSchema>
export type BoardDraw = z.infer<typeof BoardDrawSchema>
export type BoardLine = z.infer<typeof BoardLineSchema>
export type BoardImage = z.infer<typeof BoardImageSchema>
export type GeoType = (typeof GEO_TYPES)[number]
export type BoardFill = (typeof BOARD_FILLS)[number]
export type BoardDash = (typeof BOARD_DASHES)[number]
export type BoardShape = z.infer<typeof BoardShapeSchema>
export type BoardColor = (typeof BOARD_COLORS)[number]
export type BoardSize = (typeof BOARD_SIZES)[number]
export type BoardFont = (typeof BOARD_FONTS)[number]

export const BoardCanvasSchema = z.object({
  format: z.literal(BOARD_CANVAS_FORMAT),
  version: z.literal(BOARD_CANVAS_VERSION),
  shapes: z.array(BoardShapeSchema),
  /** Documento tldraw original, guardado intacto na primeira conversão para permitir voltar atrás. */
  legacyTldraw: z.unknown().optional(),
})
export type BoardCanvas = z.infer<typeof BoardCanvasSchema>

export const emptyBoardCanvas = (): BoardCanvas => ({ format: BOARD_CANVAS_FORMAT, version: BOARD_CANVAS_VERSION, shapes: [] })

type Obj = Record<string, unknown>
const isObject = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value)
const num = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const positive = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
const str = (value: unknown) => typeof value === 'string' ? value : ''
const bool = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback
const pick = <T extends string>(options: readonly T[], value: unknown, fallback: T): T => options.includes(value as T) ? value as T : fallback
const byIndex = (a: Obj, b: Obj) => { const l = str(a.index), r = str(b.index); return l < r ? -1 : l > r ? 1 : 0 }

/** Texto simples de um `richText` do tldraw (documento TipTap): parágrafos viram linhas. */
export function richTextToPlain(rich: unknown): string {
  if (typeof rich === 'string') return rich
  if (!isObject(rich)) return ''
  const walk = (node: unknown): string => {
    if (!isObject(node)) return ''
    if (node.type === 'text') return str(node.text)
    if (node.type === 'hardBreak') return '\n'
    const children = Array.isArray(node.content) ? node.content.map(walk) : []
    return node.type === 'doc' ? children.join('\n') : children.join('')
  }
  return walk(rich)
}

/**
 * Converte o snapshot `{ document: { store } }` que o tldraw gravava. Cartões, textos e setas
 * (com os vínculos às formas) viram formas próprias; os demais tipos ficam como `legacy`.
 */
export function fromTldrawBoardSnapshot(snapshot: unknown): BoardCanvas {
  const document = isObject(snapshot) && isObject(snapshot.document) ? snapshot.document : undefined
  const store = document && isObject(document.store) ? document.store : undefined
  if (!store) throw new Error('Snapshot de quadro do tldraw sem documento')
  const records = Object.values(store).filter(isObject)
  const bindings = new Map<string, { start?: ArrowBinding; end?: ArrowBinding }>()
  for (const record of records) {
    if (record.typeName !== 'binding' || record.type !== 'arrow') continue
    const props = isObject(record.props) ? record.props : {}
    const anchor = isObject(props.normalizedAnchor) ? props.normalizedAnchor : {}
    const terminal = props.terminal === 'end' ? 'end' : 'start'
    const entry = bindings.get(str(record.fromId)) ?? {}
    entry[terminal] = { shapeId: str(record.toId), anchor: { x: num(anchor.x, 0.5), y: num(anchor.y, 0.5) }, isPrecise: bool(props.isPrecise, false), isExact: bool(props.isExact, false) }
    bindings.set(str(record.fromId), entry)
  }
  // Imagens apontam para registros `asset`; o asset do Canon fica em `meta.wikiAssetId`.
  const wikiAssets = new Map<string, string>()
  for (const record of records) if (record.typeName === 'asset' && isObject(record.meta) && typeof record.meta.wikiAssetId === 'string') wikiAssets.set(str(record.id), record.meta.wikiAssetId)
  const shapes: BoardShape[] = []
  for (const record of records.filter((item) => item.typeName === 'shape').sort(byIndex)) {
    const props = isObject(record.props) ? record.props : {}
    const id = str(record.id) || `shape:${shapes.length}`
    const common = { id, x: num(record.x, 0), y: num(record.y, 0), rotation: num(record.rotation, 0), opacity: Math.min(1, Math.max(0, num(record.opacity, 1))), locked: record.isLocked === true }
    if (record.type === 'entity-card') {
      shapes.push({
        ...common, kind: 'card', w: positive(props.w, CARD_DEFAULT.w), h: positive(props.h, CARD_DEFAULT.h), entityId: str(props.entityId),
        viewMode: pick(CARD_VIEW_MODES, props.viewMode, 'card'), showImage: bool(props.showImage, true), showType: bool(props.showType, true),
        showTags: bool(props.showTags, true), showStatus: bool(props.showStatus, true), customLabel: str(props.customLabel),
      })
    } else if (record.type === 'text') {
      shapes.push({
        ...common, kind: 'text', w: positive(props.w, 8), text: richTextToPlain(props.richText ?? props.text), color: pick(BOARD_COLORS, props.color, 'black'),
        size: pick(BOARD_SIZES, props.size, 'm'), font: pick(BOARD_FONTS, props.font, 'draw'), textAlign: pick(['start', 'middle', 'end'] as const, props.textAlign, 'start'),
        autoSize: bool(props.autoSize, true), scale: positive(props.scale, 1),
      })
    } else if (record.type === 'arrow') {
      const start = isObject(props.start) ? props.start : {}, end = isObject(props.end) ? props.end : {}
      const bound = bindings.get(id) ?? {}
      shapes.push({
        ...common, kind: 'arrow', start: { x: num(start.x, 0), y: num(start.y, 0) }, end: { x: num(end.x, 0), y: num(end.y, 0) }, bend: num(props.bend, 0),
        color: pick(BOARD_COLORS, props.color, 'black'), labelColor: pick(BOARD_COLORS, props.labelColor, 'black'), size: pick(BOARD_SIZES, props.size, 'm'),
        font: pick(BOARD_FONTS, props.font, 'draw'), dash: pick(BOARD_DASHES, props.dash, 'draw'),
        arrowheadStart: pick(ARROWHEADS, props.arrowheadStart, 'none'), arrowheadEnd: pick(ARROWHEADS, props.arrowheadEnd, 'arrow'),
        text: richTextToPlain(props.richText ?? props.text), labelPosition: Math.min(1, Math.max(0, num(props.labelPosition, 0.5))), scale: positive(props.scale, 1),
        startBinding: bound.start ?? null, endBinding: bound.end ?? null,
      })
    } else if (record.type === 'note' || record.type === 'geo') {
      const labelProps = {
        text: richTextToPlain(props.richText ?? props.text), labelColor: pick(BOARD_COLORS, props.labelColor, 'black'), font: pick(BOARD_FONTS, props.font, 'draw'),
        align: pick(BOARD_ALIGNS, String(props.align ?? 'middle').replace('-legacy', ''), 'middle'), verticalAlign: pick(BOARD_ALIGNS, props.verticalAlign, 'middle'),
        growY: Math.max(0, num(props.growY, 0)),
      }
      const styles = { color: pick(BOARD_COLORS, props.color, 'black'), size: pick(BOARD_SIZES, props.size, 'm'), scale: positive(props.scale, 1) }
      if (record.type === 'note') shapes.push({ ...common, kind: 'note', ...styles, ...labelProps })
      else shapes.push({
        ...common, kind: 'geo', ...styles, ...labelProps, geo: pick(GEO_TYPES, props.geo, 'rectangle'), w: positive(props.w, GEO_DEFAULT), h: positive(props.h, GEO_DEFAULT),
        fill: pick(BOARD_FILLS, props.fill, 'none'), dash: pick(BOARD_DASHES, props.dash, 'draw'),
      })
    } else if (record.type === 'line' && isObject(props.points)) {
      const points = Object.values(props.points).filter(isObject).sort(byIndex).map((p) => ({ x: num(p.x, 0), y: num(p.y, 0) }))
      if (points.length >= 2) shapes.push({ ...common, kind: 'line', points, color: pick(BOARD_COLORS, props.color, 'black'), dash: pick(BOARD_DASHES, props.dash, 'draw'), size: pick(BOARD_SIZES, props.size, 'm'), spline: props.spline === 'cubic' ? 'cubic' : 'line', scale: positive(props.scale, 1) })
      else shapes.push({ ...common, kind: 'legacy', w: 100, h: 100, type: 'line', record })
    } else if (record.type === 'image' && wikiAssets.has(str(props.assetId))) {
      shapes.push({ ...common, kind: 'image', w: positive(props.w, 100), h: positive(props.h, 100), assetId: wikiAssets.get(str(props.assetId))!, flipX: props.flipX === true, flipY: props.flipY === true })
    } else {
      shapes.push({ ...common, kind: 'legacy', w: positive(props.w, 100), h: positive(props.h, 100), type: str(record.type) || 'desconhecido', record })
    }
  }
  // Vínculos para formas que não existem mais são descartados, como o tldraw faria ao abrir.
  const ids = new Set(shapes.map((shape) => shape.id))
  for (const shape of shapes) if (shape.kind === 'arrow') {
    if (shape.startBinding && !ids.has(shape.startBinding.shapeId)) shape.startBinding = null
    if (shape.endBinding && !ids.has(shape.endBinding.shapeId)) shape.endBinding = null
  }
  return { format: BOARD_CANVAS_FORMAT, version: BOARD_CANVAS_VERSION, shapes, legacyTldraw: snapshot }
}

/**
 * Lê o `canvasSnapshot` guardado no Quadro: vazio, formato Canon ou snapshot antigo do tldraw.
 * A conversão acontece em memória; o registro só muda no próximo salvamento.
 */
export function readBoardCanvas(snapshot: unknown): BoardCanvas {
  if (snapshot === null || snapshot === undefined) return emptyBoardCanvas()
  if (isObject(snapshot) && snapshot.format === BOARD_CANVAS_FORMAT) return BoardCanvasSchema.parse(snapshot)
  return fromTldrawBoardSnapshot(snapshot)
}
