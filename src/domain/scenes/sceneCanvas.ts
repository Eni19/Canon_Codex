import { z } from 'zod'

/**
 * Conteúdo do canvas de uma Cena: tokens e marcadores de pontos de interesse, em ordem de
 * desenho (o primeiro fica mais ao fundo). O fundo vem da própria Cena e não é guardado aqui.
 *
 * Coordenadas seguem a convenção herdada do tldraw: `x`/`y` são o canto superior esquerdo da
 * forma sem rotação, e a rotação (radianos) gira em torno desse ponto. A projeção usa os mesmos
 * valores, então a troca de motor não muda o que o jogador vê.
 */
export const SCENE_CANVAS_FORMAT = 'canon-scene-canvas'
export const SCENE_CANVAS_VERSION = 1

export const TOKEN_DEFAULT = { w: 180, h: 280 } as const
export const ROUND_TOKEN_DEFAULT = { w: 140, h: 140 } as const
export const POI_MARKER_SIZE = { w: 180, h: 38 } as const
export const TOKEN_MIN_WIDTH = 48
export const TOKEN_MIN_HEIGHT = 72
export const TOKEN_MAX_SIZE = 2400

const visibility = z.enum(['visible', 'hidden'])
const finite = z.number().finite()

export const SceneTokenSchema = z.object({
  id: z.string().min(1), kind: z.literal('token'),
  x: finite, y: finite, rotation: finite, w: z.number().positive(), h: z.number().positive(),
  entityId: z.string(), representation: z.enum(['cutout', 'round']), visibility,
  locked: z.boolean(), flipX: z.boolean(),
})
export type SceneToken = z.infer<typeof SceneTokenSchema>

export const ScenePoiMarkerSchema = z.object({
  id: z.string().min(1), kind: z.literal('poi'),
  x: finite, y: finite, rotation: finite, w: z.number().positive(), h: z.number().positive(),
  poiId: z.string(), visibility,
})
export type ScenePoiMarker = z.infer<typeof ScenePoiMarkerSchema>

export const SceneCanvasShapeSchema = z.discriminatedUnion('kind', [SceneTokenSchema, ScenePoiMarkerSchema])
export type SceneCanvasShape = z.infer<typeof SceneCanvasShapeSchema>

export const SceneCanvasSchema = z.object({
  format: z.literal(SCENE_CANVAS_FORMAT),
  version: z.literal(SCENE_CANVAS_VERSION),
  shapes: z.array(SceneCanvasShapeSchema),
  /** Documento tldraw original, guardado intacto na primeira conversão para permitir voltar atrás. */
  legacyTldraw: z.unknown().optional(),
})
export type SceneCanvas = z.infer<typeof SceneCanvasSchema>

export const emptySceneCanvas = (): SceneCanvas => ({ format: SCENE_CANVAS_FORMAT, version: SCENE_CANVAS_VERSION, shapes: [] })

type Record_ = Record<string, unknown>
const isObject = (value: unknown): value is Record_ => typeof value === 'object' && value !== null && !Array.isArray(value)
const num = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const positive = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
const str = (value: unknown) => typeof value === 'string' ? value : ''

/** Ordena como o tldraw: índices fracionários comparados como texto, sem localidade. */
const byIndex = (a: Record_, b: Record_) => {
  const left = str(a.index), right = str(b.index)
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * Converte o snapshot `{ document: { store, schema } }` que o tldraw gravava. Só os tipos
 * próprios da Cena são lidos; o fundo é descartado porque é derivado da Cena.
 */
export function fromTldrawSceneSnapshot(snapshot: unknown): SceneCanvas {
  const document = isObject(snapshot) && isObject(snapshot.document) ? snapshot.document : undefined
  const store = document && isObject(document.store) ? document.store : undefined
  if (!store) throw new Error('Snapshot de cena do tldraw sem documento')
  const records = Object.values(store).filter(isObject).filter((record) => record.typeName === 'shape').sort(byIndex)
  const shapes: SceneCanvasShape[] = []
  for (const record of records) {
    const props = isObject(record.props) ? record.props : {}
    const base = { id: str(record.id) || `shape:${shapes.length}`, x: num(record.x, 0), y: num(record.y, 0), rotation: num(record.rotation, 0) }
    if (record.type === 'scene-token') {
      const meta = isObject(record.meta) ? record.meta : {}
      shapes.push({
        ...base, kind: 'token',
        w: positive(props.w, TOKEN_DEFAULT.w), h: positive(props.h, TOKEN_DEFAULT.h),
        entityId: str(props.entityId),
        representation: props.representation === 'round' ? 'round' : 'cutout',
        visibility: props.visibility === 'hidden' ? 'hidden' : 'visible',
        locked: props.locked === true, flipX: meta.flipX === true,
      })
    } else if (record.type === 'scene-poi') {
      shapes.push({
        ...base, kind: 'poi',
        w: positive(props.w, POI_MARKER_SIZE.w), h: positive(props.h, POI_MARKER_SIZE.h),
        poiId: str(props.poiId), visibility: props.visibility === 'hidden' ? 'hidden' : 'visible',
      })
    }
  }
  return { format: SCENE_CANVAS_FORMAT, version: SCENE_CANVAS_VERSION, shapes, legacyTldraw: snapshot }
}

/**
 * Lê o `canvasSnapshot` guardado na Cena: vazio, formato Canon ou snapshot antigo do tldraw.
 * A conversão acontece em memória; o arquivo só muda no próximo salvamento.
 */
export function readSceneCanvas(snapshot: unknown): SceneCanvas {
  if (snapshot === null || snapshot === undefined) return emptySceneCanvas()
  if (isObject(snapshot) && snapshot.format === SCENE_CANVAS_FORMAT) return SceneCanvasSchema.parse(snapshot)
  return fromTldrawSceneSnapshot(snapshot)
}

export type ScenePoiPlacement = { id: string; x: number; y: number }

/**
 * Posiciona um marcador para cada ponto de interesse do Local, em porcentagem do fundo, como o
 * editor antigo fazia ao abrir a cena. Marcadores existentes mantêm id, ordem e visibilidade;
 * marcadores de pontos removidos do Local continuam no canvas.
 */
export function placePoiMarkers(canvas: SceneCanvas, pois: ScenePoiPlacement[], background: { width: number; height: number }, newId: () => string): SceneCanvas {
  const shapes = [...canvas.shapes]
  for (const poi of pois) {
    const x = background.width * poi.x / 100 - 18, y = background.height * poi.y / 100 - 18
    const index = shapes.findIndex((shape) => shape.kind === 'poi' && shape.poiId === poi.id)
    if (index >= 0) shapes[index] = { ...shapes[index], x, y }
    else shapes.push({ id: newId(), kind: 'poi', x, y, rotation: 0, ...POI_MARKER_SIZE, poiId: poi.id, visibility: 'visible' })
  }
  return { ...canvas, shapes }
}
