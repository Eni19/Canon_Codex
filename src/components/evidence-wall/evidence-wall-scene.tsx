'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import {
  CatmullRomCurve3, Color, Object3D, Plane, PlaneGeometry, Raycaster, TubeGeometry, Vector2, Vector3,
  type Group, type Mesh, type PerspectiveCamera, type SpotLight, type Texture,
} from 'three'
import { ITEM_SIZE, WALL, clampToWall, type WallItemKind, type WallLayout } from '@/domain/evidence/evidenceWall'
import { paintLeafGobo, paintWall } from './wall-textures'

export type WallPiece = { id: string; kind: WallItemKind; texture: Texture; label: string }

export interface EvidenceWallSceneProps {
  pieces: WallPiece[]
  layout: WallLayout
  strings: Array<[string, string]>
  focusId: string | null
  reduced: boolean
  /** Peça solta depois de arrastada, já dentro da parede. */
  onDrop: (id: string, x: number, y: number) => void
  onSelect: (id: string) => void
  onBackground: () => void
  onShown?: () => void
  /** Cursor que a cena pede para o elemento que a contém. */
  onCursor?: (cursor: string) => void
}

const FOV = 35
const BASE_Z = 0.006
const ORDER_Z = 0.0025
const LIFT_Z = 0.1
const HOVER_Z = 0.018
const DRAG_THRESHOLD = 5
/** Quanto a câmera pode aproximar, em relação ao enquadramento da parede inteira. */
const MIN_ZOOM = 0.38
const PIN_FROM_TOP = 0.045

export default function EvidenceWallScene(props: EvidenceWallSceneProps) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: FOV, near: 0.05, far: 40, position: [0, 0, 6] }} gl={{ antialias: true }}>
      <color attach="background" args={['#14110e']}/>
      <WallScene {...props}/>
    </Canvas>
  )
}

type Live = { x: number; y: number; z: number; rotation: number; tiltX: number; tiltY: number; vx: number }
type Gesture =
  | { kind: 'piece'; id: string; pointerId: number; start: Vector2; offset: Vector2; moved: boolean; lastX: number; lastT: number }
  | { kind: 'pan'; pointerId: number; start: Vector2; panStart: Vector2; moved: boolean }

function WallScene({ pieces, layout, strings, focusId, reduced, onDrop, onSelect, onBackground, onShown, onCursor }: EvidenceWallSceneProps) {
  const { camera, gl, size } = useThree()
  const wallTexture = useMemo(() => paintWall(), [])
  const gobo = useMemo(() => paintLeafGobo(), [])
  useEffect(() => () => { wallTexture.dispose(); gobo.dispose() }, [wallTexture, gobo])

  // Posições vivas: as peças correm atrás delas a cada quadro, o que dá peso ao papel.
  const live = useRef(new Map<string, Live>())
  const groups = useRef(new Map<string, Group>())
  const [dragging, setDragging] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [panning, setPanning] = useState(false)
  const gesture = useRef<Gesture | null>(null)
  const view = useRef({ zoom: 0, pan: new Vector2(), pointer: new Vector2(), parallax: new Vector2() })
  const flashlight = useRef<SpotLight>(null)
  const flashTarget = useMemo(() => new Object3D(), [])
  const keyTarget = useMemo(() => new Object3D(), [])

  // Cada peça nova (ou a arrumação redefinida) passa a mirar a posição da arrumação.
  useEffect(() => {
    for (const piece of pieces) {
      const p = layout[piece.id]
      if (!p) continue
      const current = live.current.get(piece.id)
      if (current) { current.x = p.x; current.y = p.y; current.rotation = p.rotation }
      else live.current.set(piece.id, { x: p.x, y: p.y, z: BASE_Z, rotation: p.rotation, tiltX: 0, tiltY: 0, vx: 0 })
    }
  }, [layout, pieces])

  const perspective = camera as PerspectiveCamera
  const tan = Math.tan((FOV * Math.PI) / 360)
  const aspect = size.width / Math.max(1, size.height)
  /** Distância em que a parede preenche a tela (o que sobra nas laterais se vê movendo a parede). */
  const fitDistance = Math.min(WALL.height / 2 / tan, WALL.width / 2 / (tan * aspect)) * 0.98

  const ray = useMemo(() => new Raycaster(), [])
  const plane = useMemo(() => new Plane(new Vector3(0, 0, 1), 0), [])
  const toNdc = (clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect()
    return new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
  }
  const onWall = (clientX: number, clientY: number) => {
    ray.setFromCamera(toNdc(clientX, clientY), perspective)
    const hit = new Vector3()
    return ray.ray.intersectPlane(plane, hit) ? hit : null
  }

  // Entrada: arrastar peças, mover a parede e aproximar com a roda, sempre dentro de limites.
  useEffect(() => {
    const element = gl.domElement
    const move = (event: PointerEvent) => {
      const v = view.current
      v.pointer.copy(toNdc(event.clientX, event.clientY))
      const g = gesture.current
      if (!g || g.pointerId !== event.pointerId) return
      if (!g.moved && Math.hypot(event.clientX - g.start.x, event.clientY - g.start.y) < DRAG_THRESHOLD) return
      g.moved = true
      if (g.kind === 'piece') {
        if (dragging !== g.id) setDragging(g.id)
        const hit = onWall(event.clientX, event.clientY)
        const target = live.current.get(g.id)
        const piece = pieces.find((item) => item.id === g.id)
        if (!hit || !target || !piece) return
        const at = clampToWall(piece.kind, hit.x - g.offset.x, hit.y - g.offset.y)
        const now = event.timeStamp
        target.vx = (at.x - target.x) / Math.max(0.008, (now - g.lastT) / 1000)
        g.lastT = now
        target.x = at.x
        target.y = at.y
      } else {
        const distance = perspective.position.z
        const scale = (2 * distance * tan) / element.clientHeight
        v.pan.set(g.panStart.x - (event.clientX - g.start.x) * scale, g.panStart.y + (event.clientY - g.start.y) * scale)
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
      const v = view.current
      v.zoom = Math.min(1, Math.max(0, v.zoom - event.deltaY * 0.0012))
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

  const startPiece = (event: ThreeEvent<PointerEvent>, id: string) => {
    if (event.button !== 0 || focusId) return
    event.stopPropagation()
    const target = live.current.get(id)
    const hit = onWall(event.clientX, event.clientY)
    if (!target || !hit) return
    gesture.current = { kind: 'piece', id, pointerId: event.pointerId, start: new Vector2(event.clientX, event.clientY), offset: new Vector2(hit.x - target.x, hit.y - target.y), moved: false, lastX: target.x, lastT: event.nativeEvent.timeStamp }
  }
  const startPan = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return
    gesture.current = { kind: 'pan', pointerId: event.pointerId, start: new Vector2(event.clientX, event.clientY), panStart: view.current.pan.clone(), moved: false }
  }

  useEffect(() => {
    onCursor?.(dragging || panning ? 'grabbing' : hovered && !focusId ? 'grab' : '')
  }, [dragging, focusId, hovered, onCursor, panning])

  const desiredTarget = useMemo(() => new Vector3(), [])
  const lookAt = useRef(new Vector3())
  useFrame((_, delta) => {
    const v = view.current
    const ease = reduced ? 1 : 1 - Math.exp(-delta * 7)
    const focus = focusId ? live.current.get(focusId) : null
    const focusPiece = focusId ? pieces.find((item) => item.id === focusId) : null
    let distance: number
    if (focus && focusPiece) {
      // A peça fica no terço esquerdo da tela; o painel de leitura abre à direita.
      const { h } = ITEM_SIZE[focusPiece.kind]
      distance = (h * 1.45) / (2 * tan)
      const visibleW = 2 * distance * tan * aspect
      desiredTarget.set(focus.x + visibleW * 0.2, focus.y, 0)
    } else {
      distance = fitDistance * (1 - v.zoom * (1 - MIN_ZOOM))
      // A vista não sai da parede: o pan fica limitado ao que sobra além do que já se vê.
      const visibleW = 2 * distance * tan * aspect, visibleH = 2 * distance * tan
      const maxX = Math.max(0, (WALL.width - visibleW) / 2), maxY = Math.max(0, (WALL.height - visibleH) / 2)
      v.pan.set(Math.min(maxX, Math.max(-maxX, v.pan.x)), Math.min(maxY, Math.max(-maxY, v.pan.y)))
      desiredTarget.set(v.pan.x, v.pan.y, 0)
    }
    // Paralaxe leve: a câmera desliza com o mouse e continua olhando para o mesmo ponto.
    if (!reduced && !focus) v.parallax.lerp(v.pointer, 1 - Math.exp(-delta * 3))
    else v.parallax.multiplyScalar(0.9)
    const sway = distance * 0.05
    lookAt.current.lerp(desiredTarget, ease)
    perspective.position.lerp(new Vector3(lookAt.current.x + v.parallax.x * sway, lookAt.current.y + v.parallax.y * sway, distance), ease)
    perspective.lookAt(lookAt.current)

    // Lanterna: segue o ponteiro na parede.
    const pointer = new Vector3(v.pointer.x, v.pointer.y, 0.5).unproject(perspective).sub(perspective.position).normalize()
    const t = -perspective.position.z / pointer.z
    const aim = perspective.position.clone().add(pointer.multiplyScalar(t))
    flashTarget.position.lerp(new Vector3(focus ? focus.x : aim.x, focus ? focus.y : aim.y, 0), reduced ? 1 : 1 - Math.exp(-delta * 10))
    if (flashlight.current) flashlight.current.position.set(perspective.position.x * 0.6, perspective.position.y * 0.6 + 0.3, 3.2)

    // Peças: correm atrás da posição viva; a arrastada sobe, inclina com o movimento e projeta sombra maior.
    for (const piece of pieces) {
      const group = groups.current.get(piece.id)
      const state = live.current.get(piece.id)
      const placement = layout[piece.id]
      if (!group || !state || !placement) continue
      const lifted = dragging === piece.id
      const z = lifted ? LIFT_Z : BASE_Z + placement.order * ORDER_Z + (hovered === piece.id && !focusId ? HOVER_Z : 0)
      const k = reduced ? 1 : 1 - Math.exp(-delta * (lifted ? 18 : 10))
      group.position.x += (state.x - group.position.x) * k
      group.position.y += (state.y - group.position.y) * k
      group.position.z += (z - group.position.z) * (reduced ? 1 : 1 - Math.exp(-delta * 12))
      const swing = lifted ? Math.max(-0.35, Math.min(0.35, -state.vx * 0.08)) : 0
      state.vx *= Math.exp(-delta * 6)
      group.rotation.z += (state.rotation + swing - group.rotation.z) * k
      group.rotation.x += ((lifted ? -0.12 : 0) - group.rotation.x) * k
    }
  })

  const pinOf = (id: string) => {
    const piece = pieces.find((item) => item.id === id)
    const group = groups.current.get(id)
    if (!piece || !group) return null
    const top = ITEM_SIZE[piece.kind].h / 2 - PIN_FROM_TOP
    const angle = group.rotation.z
    return new Vector3(group.position.x - Math.sin(angle) * top, group.position.y + Math.cos(angle) * top, group.position.z + 0.012)
  }

  return <>
    <FirstFrames onShown={onShown}/>
    <hemisphereLight args={['#d8cdb8', '#2a2018', 0.85]}/>
    {/* Luz da janela, de cima e da direita, filtrada por folhagem (a sombra das folhas na parede). */}
    <spotLight
      color="#ffe2b8" intensity={38} decay={2} distance={0} position={[3.6, 2.6, 3.4]} angle={0.62} penumbra={0.55}
      map={gobo} target={keyTarget} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
    />
    <primitive object={keyTarget} position={[0.6, -0.2, 0]}/>
    {/* Lanterna do investigador: um círculo de luz que segue o ponteiro, como na referência. */}
    <spotLight ref={flashlight} color="#fff4e2" intensity={26} decay={2} distance={0} angle={0.2} penumbra={0.65} target={flashTarget} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}/>
    <primitive object={flashTarget}/>

    <mesh position={[0, 0, 0]} receiveShadow onPointerDown={startPan}>
      <planeGeometry args={[WALL.width, WALL.height]}/>
      <meshStandardMaterial map={wallTexture} roughness={0.95}/>
    </mesh>
    {/* Moldura escura além da parede, para a parede não flutuar no vazio. */}
    <mesh position={[0, 0, -0.02]}>
      <planeGeometry args={[WALL.width + 6, WALL.height + 6]}/>
      <meshStandardMaterial color="#1c1814" roughness={1}/>
    </mesh>

    {pieces.map((piece) => (
      <group
        key={piece.id}
        ref={(group) => { if (group) groups.current.set(piece.id, group); else groups.current.delete(piece.id) }}
        position={[layout[piece.id]?.x ?? 0, layout[piece.id]?.y ?? 0, BASE_Z]}
        rotation={[0, 0, layout[piece.id]?.rotation ?? 0]}
      >
        <Paper piece={piece} onPointerDown={(event) => startPiece(event, piece.id)} onOver={() => setHovered(piece.id)} onOut={() => setHovered((h) => h === piece.id ? null : h)}/>
        <Pin y={ITEM_SIZE[piece.kind].h / 2 - PIN_FROM_TOP} color={piece.kind === 'note' ? '#c8352b' : piece.kind === 'sheet' ? '#c9a24a' : '#2f5d8a'}/>
      </group>
    ))}

    {strings.map(([a, b]) => <Yarn key={`${a}>${b}`} from={a} to={b} pinOf={pinOf}/>)}
  </>
}

/** Papel com uma curvatura leve nos cantos de baixo, que pega a luz como papel de verdade. */
function Paper({ piece, onPointerDown, onOver, onOut }: { piece: WallPiece; onPointerDown: (event: ThreeEvent<PointerEvent>) => void; onOver: () => void; onOut: () => void }) {
  const { w, h } = ITEM_SIZE[piece.kind]
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(w, h, 12, 16)
    const position = g.attributes.position
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) / (w / 2), y = position.getY(i) / (h / 2)
      const fromBottom = Math.max(0, -y * 0.5 + 0.5)
      const curl = piece.kind === 'note' ? 0.03 * fromBottom ** 3 : 0.012 * fromBottom ** 2 * (0.5 + Math.abs(x) * 0.5)
      position.setZ(i, curl)
    }
    g.computeVertexNormals()
    return g
  }, [h, piece.kind, w])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} castShadow receiveShadow onPointerDown={onPointerDown} onPointerOver={(event) => { event.stopPropagation(); onOver() }} onPointerOut={onOut}>
      <meshStandardMaterial map={piece.texture} roughness={piece.kind === 'cover' || piece.kind === 'character' ? 0.55 : 0.9} side={2}/>
    </mesh>
  )
}

function Pin({ y, color }: { y: number; color: string }) {
  return <group position={[0, y, 0.012]}>
    <mesh castShadow>
      <sphereGeometry args={[0.018, 16, 12]}/>
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.1}/>
    </mesh>
    <mesh position={[0, 0, -0.008]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.004, 0.004, 0.02, 6]}/>
      <meshStandardMaterial color="#b8b2a6" metalness={0.8} roughness={0.3}/>
    </mesh>
  </group>
}

/** Linha vermelha entre dois alfinetes, com a barriga de um fio solto; refaz a forma só quando as pontas mexem. */
function Yarn({ from, to, pinOf }: { from: string; to: string; pinOf: (id: string) => Vector3 | null }) {
  const mesh = useRef<Mesh>(null)
  const last = useRef('')
  const color = useMemo(() => new Color('#a3231d'), [])
  useFrame(() => {
    const a = pinOf(from), b = pinOf(to)
    if (!a || !b || !mesh.current) return
    const key = `${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)},${b.x.toFixed(3)},${b.y.toFixed(3)},${b.z.toFixed(3)}`
    if (key === last.current) return
    last.current = key
    const span = a.distanceTo(b)
    const points = Array.from({ length: 12 }, (_, i) => {
      const t = i / 11
      const p = a.clone().lerp(b, t)
      p.y -= Math.sin(Math.PI * t) * Math.min(0.14, span * 0.06)
      p.z += Math.sin(Math.PI * t) * 0.01
      return p
    })
    const next = new TubeGeometry(new CatmullRomCurve3(points), 32, 0.0045, 6, false)
    mesh.current.geometry.dispose()
    mesh.current.geometry = next
  })
  return <mesh ref={mesh} castShadow>
    <bufferGeometry/>
    <meshStandardMaterial color={color} roughness={0.8}/>
  </mesh>
}

function FirstFrames({ onShown }: { onShown?: () => void }) {
  const frames = useRef(0)
  const done = useRef(false)
  useFrame(() => {
    if (done.current) return
    frames.current += 1
    if (frames.current > 3) { done.current = true; onShown?.() }
  })
  return null
}

