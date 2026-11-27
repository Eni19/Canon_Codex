'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Plane, PlaneGeometry, Raycaster, Vector2, Vector3, type Group, type PerspectiveCamera, type Texture } from 'three'
import type { SurfaceLayout } from '@/domain/canvas/surfaceLayout'

/**
 * Base comum das superfícies 3D com peças (a parede de Evidências e a bancada de Objetos): câmera
 * com limites e paralaxe, peças arrastáveis com peso, destaque ao passar o mouse e foco numa peça
 * para leitura. Cada página traz a própria superfície, luzes e enfeites como filhos.
 */
export type SurfacePiece = {
  id: string
  kind: string
  label: string
  size: { w: number; h: number }
  /** Textura do papel; peças com modelo próprio (ferramentas) não precisam. */
  texture?: Texture
  roughness?: number
  /** Curvatura do papel: nota levanta a ponta de baixo; papel curva pouco. */
  curl?: 'note' | 'paper' | 'none'
  transparent?: boolean
  /** Altura que a câmera enquadra ao focar a peça (ferramentas pedem uma vista mais aberta). */
  focusHeight?: number
}

export type PieceHandlers = {
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void
  onPointerOver: (event: ThreeEvent<PointerEvent>) => void
  onPointerOut: () => void
}

export interface SurfaceBoardProps {
  surface: { width: number; height: number }
  pieces: SurfacePiece[]
  layout: SurfaceLayout
  focusId: string | null
  reduced: boolean
  clamp: (piece: SurfacePiece, x: number, y: number) => { x: number; y: number }
  onDrop: (id: string, x: number, y: number) => void
  /** Clique sem arrastar numa peça (ou num alvo dentro dela, como um adesivo numerado). */
  onSelect: (id: string) => void
  onBackground: () => void
  onShown?: () => void
  onCursor?: (cursor: string) => void
  /** Material da superfície (parede, tapete de corte...). */
  surfaceMaterial: ReactNode
  /** Modelo próprio de uma peça (ferramentas); sem ele, a peça é um papel com a textura. */
  renderPiece?: (piece: SurfacePiece, handlers: PieceHandlers) => ReactNode
  /** Enfeites presos à peça e que se movem com ela (alfinetes, prendedores, adesivos). */
  renderAttachment?: (piece: SurfacePiece) => ReactNode
  /** Altura da peça em foco, em relação à altura visível (0,7 = 70%). */
  focusFill?: number
  /** Altura de repouso própria de onde a peça está (dentro de uma caixa, por exemplo); `null` usa a padrão. */
  restZ?: (piece: SurfacePiece, x: number, y: number, order: number) => number | null
  /** Altura da peça erguida (arrastada ou em `raisedIds`); precisa passar por cima do que houver na superfície. */
  liftZ?: number
  /** Peças erguidas pela página, por exemplo antes de saírem de dentro de uma caixa. */
  raisedIds?: ReadonlySet<string>
  /** Peças que vão direto para a posição, sem o atraso do peso (carregadas junto com outra coisa). */
  instantIds?: ReadonlySet<string>
  /** Distância da vista inicial em relação à que preenche a tela (1,2 = 20% mais longe, com a borda da superfície à vista). */
  fitScale?: number
  children?: ReactNode
}

export const FOV = 35
const BASE_Z = 0.006
const ORDER_Z = 0.0025
const LIFT_Z = 0.1
const HOVER_Z = 0.018
const DRAG_THRESHOLD = 5
/** Quanto a câmera pode aproximar, em relação ao enquadramento da superfície inteira. */
const MIN_ZOOM = 0.38

export function SurfaceCanvas({ background, children }: { background: string; children: ReactNode }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: FOV, near: 0.05, far: 40, position: [0, 0, 6] }} gl={{ antialias: true }}>
      <color attach="background" args={[background]}/>
      {children}
    </Canvas>
  )
}

type Live = { x: number; y: number; rotation: number; vx: number }
type Gesture =
  | { kind: 'piece'; id: string; pointerId: number; start: Vector2; offset: Vector2; moved: boolean; lastT: number }
  | { kind: 'pan'; pointerId: number; start: Vector2; panStart: Vector2; moved: boolean }

/** O que os filhos da superfície podem consultar: grupos das peças, ponteiro e estado de interação. */
export type SurfaceContextValue = {
  groups: RefObject<Map<string, Group>>
  pieces: SurfacePiece[]
  pointer: RefObject<Vector2>
  focusId: string | null
  hoveredId: string | null
  draggingId: string | null
  reduced: boolean
  /** Ponto da superfície (z = 0) sob uma posição da tela, ou null. */
  onSurface: (clientX: number, clientY: number) => Vector3 | null
}
const SurfaceContext = createContext<SurfaceContextValue | null>(null)
export function useSurface() {
  const value = useContext(SurfaceContext)
  if (!value) throw new Error('useSurface fora de SurfaceBoard')
  return value
}

export function SurfaceBoard({ surface, pieces, layout, focusId, reduced, clamp, onDrop, onSelect, onBackground, onShown, onCursor, surfaceMaterial, renderPiece, renderAttachment, focusFill = 0.7, restZ, liftZ = LIFT_Z, raisedIds, instantIds, fitScale = 1, children }: SurfaceBoardProps) {
  const { camera, gl, size } = useThree()
  // Posições vivas: as peças correm atrás delas a cada quadro, o que dá peso ao papel.
  const live = useRef(new Map<string, Live>())
  const groups = useRef(new Map<string, Group>())
  const [dragging, setDragging] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [panning, setPanning] = useState(false)
  const gesture = useRef<Gesture | null>(null)
  const pointer = useRef(new Vector2())
  const view = useRef({ zoom: 0, pan: new Vector2(), parallax: new Vector2() })

  // Cada peça nova (ou a arrumação redefinida) passa a mirar a posição da arrumação.
  useEffect(() => {
    for (const piece of pieces) {
      const p = layout[piece.id]
      if (!p) continue
      const current = live.current.get(piece.id)
      if (current) { current.x = p.x; current.y = p.y; current.rotation = p.rotation }
      else live.current.set(piece.id, { x: p.x, y: p.y, rotation: p.rotation, vx: 0 })
    }
  }, [layout, pieces])

  const perspective = camera as PerspectiveCamera
  const tan = Math.tan((FOV * Math.PI) / 360)
  const aspect = size.width / Math.max(1, size.height)
  /** Distância em que a superfície preenche a tela (o que sobra nas laterais se vê movendo a vista). */
  const fitDistance = Math.min(surface.height / 2 / tan, surface.width / 2 / (tan * aspect)) * 0.98 * fitScale

  const ray = useMemo(() => new Raycaster(), [])
  const plane = useMemo(() => new Plane(new Vector3(0, 0, 1), 0), [])
  const toNdc = (clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect()
    return new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
  }
  const onSurface = (clientX: number, clientY: number) => {
    ray.setFromCamera(toNdc(clientX, clientY), perspective)
    const hit = new Vector3()
    return ray.ray.intersectPlane(plane, hit) ? hit : null
  }

  // Entrada: arrastar peças, mover a vista e aproximar com a roda, sempre dentro de limites.
  useEffect(() => {
    const element = gl.domElement
    const move = (event: PointerEvent) => {
      pointer.current.copy(toNdc(event.clientX, event.clientY))
      const g = gesture.current
      if (!g || g.pointerId !== event.pointerId) return
      if (!g.moved && Math.hypot(event.clientX - g.start.x, event.clientY - g.start.y) < DRAG_THRESHOLD) return
      g.moved = true
      if (g.kind === 'piece') {
        if (dragging !== g.id) setDragging(g.id)
        const hit = onSurface(event.clientX, event.clientY)
        const target = live.current.get(g.id)
        const piece = pieces.find((item) => item.id === g.id)
        if (!hit || !target || !piece) return
        const at = clamp(piece, hit.x - g.offset.x, hit.y - g.offset.y)
        target.vx = (at.x - target.x) / Math.max(0.008, (event.timeStamp - g.lastT) / 1000)
        g.lastT = event.timeStamp
        target.x = at.x
        target.y = at.y
      } else {
        const scale = (2 * perspective.position.z * tan) / element.clientHeight
        view.current.pan.set(g.panStart.x - (event.clientX - g.start.x) * scale, g.panStart.y + (event.clientY - g.start.y) * scale)
        if (!panning) setPanning(true)
      }
    }
    const up = (event: PointerEvent) => {
      const g = gesture.current
      if (!g || g.pointerId !== event.pointerId) return
      gesture.current = null
      if (g.kind === 'piece') {
        setDragging(null)
        const target = live.current.get(g.id)
        if (target) target.vx = 0
        if (g.moved && target) onDrop(g.id, target.x, target.y)
        else onSelect(g.id)
      } else {
        setPanning(false)
        if (!g.moved) onBackground()
      }
    }
    const wheel = (event: WheelEvent) => {
      if (focusId) return
      event.preventDefault()
      view.current.zoom = Math.min(1, Math.max(0, view.current.zoom - event.deltaY * 0.0012))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    element.addEventListener('wheel', wheel, { passive: false })
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      element.removeEventListener('wheel', wheel)
    }
  })

  const pieceDown = (id: string, event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0 || focusId) return
    event.stopPropagation()
    const target = live.current.get(id)
    const hit = onSurface(event.clientX, event.clientY)
    if (!target || !hit) return
    gesture.current = { kind: 'piece', id, pointerId: event.pointerId, start: new Vector2(event.clientX, event.clientY), offset: new Vector2(hit.x - target.x, hit.y - target.y), moved: false, lastT: event.nativeEvent.timeStamp }
  }
  const register = (id: string, group: Group | null) => { if (group) groups.current.set(id, group); else groups.current.delete(id) }
  const startPan = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return
    gesture.current = { kind: 'pan', pointerId: event.pointerId, start: new Vector2(event.clientX, event.clientY), panStart: view.current.pan.clone(), moved: false }
  }

  useEffect(() => {
    onCursor?.(dragging || panning ? 'grabbing' : hovered && !focusId ? 'grab' : '')
  }, [dragging, focusId, hovered, onCursor, panning])

  const desiredTarget = useMemo(() => new Vector3(), [])
  const lookAt = useRef(new Vector3())
  const frames = useRef(0)
  useFrame((_, delta) => {
    if (frames.current < 4 && ++frames.current === 4) onShown?.()
    const v = view.current
    const ease = reduced ? 1 : 1 - Math.exp(-delta * 7)
    const focus = focusId ? live.current.get(focusId) : null
    const focusPiece = focusId ? pieces.find((item) => item.id === focusId) : null
    let distance: number
    // A vista não sai da superfície: o alvo fica limitado ao que sobra além do que já se vê.
    const keepInside = (x: number, y: number) => {
      const visibleW = 2 * distance * tan * aspect, visibleH = 2 * distance * tan
      const maxX = Math.max(0, (surface.width - visibleW) / 2), maxY = Math.max(0, (surface.height - visibleH) / 2)
      return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) }
    }
    if (focus && focusPiece) {
      // A peça fica no terço esquerdo da tela; o painel de leitura abre à direita.
      distance = Math.min(fitDistance, (focusPiece.focusHeight ?? Math.max(focusPiece.size.h, focusPiece.size.w * 0.75)) / focusFill / (2 * tan))
      const at = keepInside(focus.x + 2 * distance * tan * aspect * 0.2, focus.y)
      desiredTarget.set(at.x, at.y, 0)
    } else {
      distance = fitDistance * (1 - v.zoom * (1 - MIN_ZOOM))
      const at = keepInside(v.pan.x, v.pan.y)
      v.pan.set(at.x, at.y)
      desiredTarget.set(at.x, at.y, 0)
    }
    // Paralaxe leve: a câmera desliza com o mouse e continua olhando para o mesmo ponto.
    if (!reduced && !focus) v.parallax.lerp(pointer.current, 1 - Math.exp(-delta * 3))
    else v.parallax.multiplyScalar(0.9)
    const sway = distance * 0.05
    lookAt.current.lerp(desiredTarget, ease)
    perspective.position.lerp(new Vector3(lookAt.current.x + v.parallax.x * sway, lookAt.current.y + v.parallax.y * sway, distance), ease)
    perspective.lookAt(lookAt.current)

    // Peças: correm atrás da posição viva; a arrastada sobe, inclina com o movimento e projeta sombra maior.
    for (const piece of pieces) {
      const group = groups.current.get(piece.id)
      const state = live.current.get(piece.id)
      const placement = layout[piece.id]
      if (!group || !state || !placement) continue
      const lifted = dragging === piece.id || Boolean(raisedIds?.has(piece.id))
      const rest = restZ?.(piece, group.position.x, group.position.y, placement.order) ?? BASE_Z + placement.order * ORDER_Z
      const z = lifted ? liftZ : rest + (hovered === piece.id && !focusId ? HOVER_Z : 0)
      const k = reduced || instantIds?.has(piece.id) ? 1 : 1 - Math.exp(-delta * (lifted ? 18 : 10))
      group.position.x += (state.x - group.position.x) * k
      group.position.y += (state.y - group.position.y) * k
      // Sobe depressa ao pegar e desce um pouco mais devagar ao soltar, assentando.
      group.position.z += (z - group.position.z) * (reduced ? 1 : 1 - Math.exp(-delta * (z < group.position.z ? 8 : 12)))
      const swing = lifted ? Math.max(-0.35, Math.min(0.35, -state.vx * 0.08)) : 0
      state.vx *= Math.exp(-delta * 6)
      group.rotation.z += (state.rotation + swing - group.rotation.z) * k
      group.rotation.x += ((lifted ? -0.12 : 0) - group.rotation.x) * k
    }
  })

  const context: SurfaceContextValue = { groups, pieces, pointer, focusId, hoveredId: hovered, draggingId: dragging, reduced, onSurface }
  return <SurfaceContext.Provider value={context}>
    <mesh receiveShadow onPointerDown={startPan}>
      <planeGeometry args={[surface.width, surface.height]}/>
      {surfaceMaterial}
    </mesh>
    {pieces.map((piece) => (
      <PieceSlot
        key={piece.id} piece={piece} placement={layout[piece.id]} register={register} onDown={pieceDown}
        onOver={setHovered} renderPiece={renderPiece} renderAttachment={renderAttachment}
      />
    ))}
    {children}
  </SurfaceContext.Provider>
}

function PieceSlot({ piece, placement, register, onDown, onOver, renderPiece, renderAttachment }: {
  piece: SurfacePiece
  placement: SurfaceLayout[string] | undefined
  register: (id: string, group: Group | null) => void
  onDown: (id: string, event: ThreeEvent<PointerEvent>) => void
  onOver: (update: (current: string | null) => string | null) => void
  renderPiece?: SurfaceBoardProps['renderPiece']
  renderAttachment?: SurfaceBoardProps['renderAttachment']
}) {
  const handlers: PieceHandlers = {
    onPointerDown: (event) => onDown(piece.id, event),
    onPointerOver: (event) => { event.stopPropagation(); onOver(() => piece.id) },
    onPointerOut: () => onOver((h) => h === piece.id ? null : h),
  }
  return (
    // A posição só é aplicada quando a peça aparece; depois quem move é o quadro a quadro. Passar
    // position/rotation como props faria cada mudança de arrumação (soltar uma peça) teleportar a
    // peça de volta à altura da superfície, sem a descida.
    <group ref={(group) => {
      if (group && !group.userData.placed) {
        group.position.set(placement?.x ?? 0, placement?.y ?? 0, BASE_Z)
        group.rotation.set(0, 0, placement?.rotation ?? 0)
        group.userData.placed = true
      }
      register(piece.id, group)
    }}>
      {renderPiece?.(piece, handlers) ?? <Paper piece={piece} handlers={handlers}/>}
      {renderAttachment?.(piece)}
    </group>
  )
}

/** Papel com uma curvatura leve nos cantos de baixo, que pega a luz como papel de verdade. */
export function Paper({ piece, handlers }: { piece: SurfacePiece; handlers: PieceHandlers }) {
  const { w, h } = piece.size
  const curl = piece.curl ?? 'paper'
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(w, h, 12, 16)
    const position = g.attributes.position
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) / (w / 2), y = position.getY(i) / (h / 2)
      const fromBottom = Math.max(0, -y * 0.5 + 0.5)
      const lift = curl === 'note' ? 0.03 * fromBottom ** 3 : curl === 'paper' ? 0.012 * fromBottom ** 2 * (0.5 + Math.abs(x) * 0.5) : 0
      position.setZ(i, lift)
    }
    g.computeVertexNormals()
    return g
  }, [curl, h, w])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} castShadow receiveShadow onPointerDown={handlers.onPointerDown} onPointerOver={handlers.onPointerOver} onPointerOut={handlers.onPointerOut}>
      <meshStandardMaterial map={piece.texture} roughness={piece.roughness ?? 0.9} side={2} transparent={piece.transparent} alphaTest={piece.transparent ? 0.5 : 0}/>
    </mesh>
  )
}
