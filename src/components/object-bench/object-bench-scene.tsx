'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { CatmullRomCurve3, Object3D, PMREMGenerator, TubeGeometry, Vector3, type Group, type Mesh, type MeshStandardMaterial, type PerspectiveCamera, type SpotLight, type Texture } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { SurfaceBoard, SurfaceCanvas, useSurface, type PieceHandlers, type SurfacePiece } from '@/components/surface-3d/surface-board'
import { BENCH, BENCH_SIZE, clampToBench, isOverSpecimen, type BenchItemKind } from '@/domain/objects/objectBench'
import type { SurfaceLayout } from '@/domain/canvas/surfaceLayout'
import { SPECIMEN_PHOTO, paintMat, paintTable } from './bench-textures'

export type BenchPiece = SurfacePiece & { kind: BenchItemKind }
export type BenchDetail = { id: string; index: number; x: number; y: number; texture: Texture }

export interface ObjectBenchSceneProps {
  pieces: BenchPiece[]
  layout: SurfaceLayout
  focusId: string | null
  reduced: boolean
  details: BenchDetail[]
  /** Visores das ferramentas: em repouso e medindo o objeto. */
  caliperDisplay: { idle: Texture; reading: Texture }
  materialCard: Texture
  onDrop: (id: string, x: number, y: number) => void
  onSelect: (id: string) => void
  onDetail: (id: string) => void
  onBackground: () => void
  onShown?: () => void
  onCursor?: (cursor: string) => void
}

export default function ObjectBenchScene(props: ObjectBenchSceneProps) {
  return <SurfaceCanvas background="#2a2d2f"><BenchScene {...props}/></SurfaceCanvas>
}

function BenchScene({ pieces, layout, focusId, reduced, details, caliperDisplay, materialCard, onDrop, onSelect, onDetail, onBackground, onShown, onCursor }: ObjectBenchSceneProps) {
  const mat = useMemo(() => paintMat(), [])
  const table = useMemo(() => { const t = paintTable(); t.wrapS = t.wrapT = 1000; t.repeat.set(3, 2); return t }, [])
  useEffect(() => () => { mat.dispose(); table.dispose() }, [mat, table])
  const environment = useStudioEnvironment()

  const renderPiece = (piece: SurfacePiece, handlers: PieceHandlers) => {
    if (piece.kind === 'caliper') return <Caliper handlers={handlers} display={caliperDisplay}/>
    if (piece.kind === 'loupe') return <Loupe handlers={handlers} card={materialCard} reduced={reduced} specimen={pieces.find((item) => item.kind === 'specimen')?.texture}/>
    return null
  }
  const renderAttachment = (piece: SurfacePiece) => {
    if (piece.kind === 'specimen') return details.map((detail) => <DetailSticker key={detail.id} detail={detail} piece={piece} onDetail={onDetail}/>)
    if (piece.kind === 'note' || piece.kind === 'label' || piece.kind === 'sheet') return <Tape piece={piece}/>
    return null
  }

  return (
    <Studio.Provider value={environment}>
    <SurfaceBoard
      surface={BENCH} pieces={pieces} layout={layout} focusId={focusId} reduced={reduced}
      clamp={(piece, x, y) => clampToBench(piece.kind as BenchItemKind, x, y)}
      onDrop={onDrop} onSelect={onSelect} onBackground={onBackground} onShown={onShown} onCursor={onCursor}
      surfaceMaterial={<meshStandardMaterial map={mat} roughness={0.85} metalness={0}/>}
      renderPiece={renderPiece} renderAttachment={renderAttachment} focusFill={0.62}
    >
      <Lights/>
      {/* Mesa de metal em volta do tapete, para a bancada não flutuar no vazio. */}
      <mesh position={[0, 0, -0.012]} receiveShadow>
        <planeGeometry args={[BENCH.width * 2.2, BENCH.height * 2.4]}/>
        <meshStandardMaterial map={table} roughness={0.5} metalness={0.55}/>
      </mesh>
      <Decor/>
    </SurfaceBoard>
    </Studio.Provider>
  )
}

/** Reflexos de um estúdio gerado em código (nada é baixado), só no metal, para as ferramentas brilharem. */
const Studio = createContext<Texture | null>(null)
function useStudioEnvironment() {
  const { gl } = useThree()
  const environment = useMemo(() => {
    const pmrem = new PMREMGenerator(gl)
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    return texture
  }, [gl])
  useEffect(() => () => environment.dispose(), [environment])
  return environment
}
function Steel(props: { color?: string; roughness?: number; metalness?: number }) {
  const environment = useContext(Studio)
  return <meshStandardMaterial color="#868d92" metalness={0.9} roughness={0.38} envMap={environment} envMapIntensity={0.16} {...props}/>
}

function Lights() {
  const { camera } = useThree()
  const { pointer, focusId, groups, reduced } = useSurface()
  const lamp = useRef<SpotLight>(null)
  const lampTarget = useMemo(() => new Object3D(), [])
  const keyTarget = useMemo(() => new Object3D(), [])
  useFrame((_, delta) => {
    // Luminária de bancada: um foco que segue o ponteiro; com uma peça em estudo, aponta para ela.
    const perspective = camera as PerspectiveCamera
    const focus = focusId ? groups.current.get(focusId)?.position : null
    const ray = new Vector3(pointer.current.x, pointer.current.y, 0.5).unproject(perspective).sub(perspective.position).normalize()
    const aim = perspective.position.clone().add(ray.multiplyScalar(-perspective.position.z / ray.z))
    lampTarget.position.lerp(new Vector3(focus ? focus.x : aim.x, focus ? focus.y : aim.y, 0), reduced ? 1 : 1 - Math.exp(-delta * 8))
    lamp.current?.position.set(lampTarget.position.x * 0.5 - 0.6, lampTarget.position.y * 0.5 + 0.9, 2.6)
  })
  return <>
    <hemisphereLight args={['#e2e8eb', '#1a1d1f', 1.5]}/>
    {/* Luz de teto, fria e larga, de cima e da esquerda. */}
    <spotLight color="#eef1f2" intensity={52} decay={2} distance={0} position={[-2.4, 2.4, 4.4]} angle={0.7} penumbra={0.85} target={keyTarget} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}/>
    <primitive object={keyTarget} position={[0.3, -0.2, 0]}/>
    <spotLight ref={lamp} color="#fff3df" intensity={20} decay={2} distance={0} angle={0.34} penumbra={0.9} target={lampTarget} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}/>
    <primitive object={lampTarget}/>
  </>
}

/** Se a ferramenta está sobre a foto do objeto agora (lido a cada quadro das posições vivas). */
function useOverSpecimen(id: string) {
  const { groups } = useSurface()
  const [over, setOver] = useState(false)
  useFrame(() => {
    const tool = groups.current.get(id)?.position, specimen = groups.current.get('specimen')?.position
    const now = Boolean(tool && specimen && isOverSpecimen(tool, specimen))
    if (now !== over) setOver(now)
  })
  return over
}


/**
 * Paquímetro digital: régua de aço, bico fixo à esquerda e cursor com visor. Sobre a foto do
 * objeto, o cursor abre até a largura da foto e o visor mostra a dimensão registrada.
 */
function Caliper({ handlers, display }: { handlers: PieceHandlers; display: { idle: Texture; reading: Texture } }) {
  const over = useOverSpecimen('caliper')
  const { reduced } = useSurface()
  const slider = useRef<Group>(null)
  const opening = useRef(0.02)
  useFrame((_, delta) => {
    const target = over ? 0.74 : 0.02
    opening.current += (target - opening.current) * (reduced ? 1 : 1 - Math.exp(-delta * 5))
    if (slider.current) slider.current.position.x = -0.6 + 0.05 + opening.current
  })
  return (
    <group {...handlers} position={[0, 0, 0.012]}>
      {/* Régua com escala gravada. */}
      <mesh castShadow receiveShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[1.32, 0.07, 0.012]}/>
        <Steel/>
      </mesh>
      {Array.from({ length: 52 }, (_, i) => (
        <mesh key={i} position={[-0.48 + i * 0.022, 0.118 - (i % 5 === 0 ? 0.008 : 0), 0.0065]}>
          <planeGeometry args={[0.0025, i % 5 === 0 ? 0.03 : 0.016]}/>
          <meshBasicMaterial color="#33373a"/>
        </mesh>
      ))}
      {/* Bico fixo (medida externa embaixo, interna em cima). */}
      <mesh castShadow position={[-0.6, -0.02, 0]}>
        <boxGeometry args={[0.05, 0.25, 0.012]}/>
        <Steel/>
      </mesh>
      <mesh castShadow position={[-0.61, 0.16, 0]}>
        <boxGeometry args={[0.025, 0.06, 0.01]}/>
        <Steel/>
      </mesh>
      {/* Cursor: bico móvel, corpo plástico, visor e botões. */}
      <group ref={slider} position={[-0.53, 0, 0]}>
        <mesh castShadow position={[0.025, -0.02, 0]}>
          <boxGeometry args={[0.05, 0.25, 0.012]}/>
          <Steel/>
        </mesh>
        <mesh castShadow position={[0.012, 0.16, 0]}>
          <boxGeometry args={[0.025, 0.06, 0.01]}/>
          <Steel/>
        </mesh>
        <mesh castShadow receiveShadow position={[0.2, 0.09, 0.012]}>
          <boxGeometry args={[0.34, 0.15, 0.028]}/>
          <meshStandardMaterial color="#2b2e31" roughness={0.45} metalness={0.2}/>
        </mesh>
        <mesh position={[0.17, 0.105, 0.0265]}>
          <planeGeometry args={[0.2, 0.075]}/>
          <meshStandardMaterial map={over ? display.reading : display.idle} roughness={0.25} emissive="#2a3026" emissiveIntensity={0.15}/>
        </mesh>
        {[0.32, 0.32].map((x, i) => (
          <mesh key={i} position={[x, 0.125 - i * 0.05, 0.028]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.006, 16]}/>
            <meshStandardMaterial color={i ? '#8b2f2a' : '#c9ccce'} roughness={0.4}/>
          </mesh>
        ))}
      </group>
    </group>
  )
}

const LENS_RADIUS = 0.13
const LENS_ZOOM = 2.4

/**
 * Lupa: aro escuro, vidro e cabo. Sobre a foto do objeto, o vidro mostra a foto ampliada (a parte
 * que está embaixo dele) e abre o cartão de análise dos materiais.
 */
function Loupe({ handlers, card, reduced, specimen }: { handlers: PieceHandlers; card: Texture; reduced: boolean; specimen?: Texture }) {
  const over = useOverSpecimen('loupe')
  const { groups } = useSurface()
  const cardGroup = useRef<Group>(null)
  const lens = useRef<Mesh>(null)
  const shown = useRef(0)
  // Cópia da textura da foto com recorte próprio: o vidro mostra só o pedaço ampliado.
  const magnified = useMemo(() => {
    if (!specimen) return null
    const copy = specimen.clone()
    copy.needsUpdate = true
    return copy
  }, [specimen])
  useEffect(() => () => magnified?.dispose(), [magnified])
  const world = useMemo(() => new Vector3(), [])
  useFrame((_, delta) => {
    shown.current += ((over ? 1 : 0) - shown.current) * (reduced ? 1 : 1 - Math.exp(-delta * 8))
    const g = cardGroup.current
    if (g) {
      g.visible = shown.current > 0.02
      g.scale.setScalar(0.6 + shown.current * 0.4)
      g.position.set(0.3 + shown.current * 0.12, 0.12 + shown.current * 0.14, 0.05)
    }
    const mesh = lens.current, photo = groups.current.get('specimen'), self = groups.current.get('loupe')
    if (!mesh || !magnified || !photo || !self) return
    mesh.visible = shown.current > 0.02
    ;(mesh.material as MeshStandardMaterial).opacity = shown.current
    // Ponto da foto sob o centro da lente, em coordenadas de textura.
    mesh.getWorldPosition(world)
    photo.worldToLocal(world)
    const { w, h } = BENCH_SIZE.specimen
    const span = (2 * LENS_RADIUS) / LENS_ZOOM
    magnified.repeat.set(span / w, span / h)
    magnified.offset.set(world.x / w + 0.5 - span / w / 2, world.y / h + 0.5 - span / h / 2)
    // O conteúdo ampliado fica alinhado com a foto, mesmo com a lupa girada.
    mesh.rotation.z = photo.rotation.z - self.rotation.z
  })
  return (
    <group {...handlers}>
      <group position={[-0.15, 0, 0.03]}>
        <mesh castShadow>
          <torusGeometry args={[0.13, 0.014, 16, 64]}/>
          <Steel color="#1f2224" roughness={0.35} metalness={0.6}/>
        </mesh>
        <mesh>
          <circleGeometry args={[0.13, 48]}/>
          <meshStandardMaterial color="#d6e6ec" transparent opacity={0.16} roughness={0.05} metalness={0.1}/>
        </mesh>
        {magnified && (
          <mesh ref={lens} position={[0, 0, 0.0005]} visible={false}>
            <circleGeometry args={[LENS_RADIUS - 0.004, 48]}/>
            <meshStandardMaterial map={magnified} roughness={0.35} transparent opacity={0}/>
          </mesh>
        )}
        {/* Brilho do vidro. */}
        <mesh position={[-0.04, 0.05, 0.001]} rotation={[0, 0, 0.6]}>
          <planeGeometry args={[0.1, 0.018]}/>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.22}/>
        </mesh>
      </group>
      <mesh castShadow position={[0.1, 0, 0.03]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.1, 16]}/>
        <Steel/>
      </mesh>
      <mesh castShadow position={[0.24, 0, 0.03]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.024, 0.02, 0.2, 24]}/>
        <meshStandardMaterial color="#5a3a26" roughness={0.6}/>
      </mesh>
      <group ref={cardGroup} visible={false}>
        <mesh castShadow rotation={[0, 0, -0.5]}>
          <planeGeometry args={[0.34, 0.34]}/>
          <meshStandardMaterial map={card} roughness={0.9}/>
        </mesh>
      </group>
    </group>
  )
}

/** Adesivo numerado sobre um ponto de detalhe da foto; clicar abre a leitura daquele detalhe. */
function DetailSticker({ detail, piece, onDetail }: { detail: BenchDetail; piece: SurfacePiece; onDetail: (id: string) => void }) {
  const { w, h } = piece.size
  const u = SPECIMEN_PHOTO.x + SPECIMEN_PHOTO.w * detail.x / 100, v = SPECIMEN_PHOTO.y + SPECIMEN_PHOTO.h * detail.y / 100
  const down = useRef<{ x: number; y: number } | null>(null)
  return (
    <mesh
      position={[(u - 0.5) * w, (0.5 - v) * h, 0.006]}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); down.current = { x: event.clientX, y: event.clientY } }}
      onPointerUp={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation()
        if (down.current && Math.hypot(event.clientX - down.current.x, event.clientY - down.current.y) < 5) onDetail(detail.id)
        down.current = null
      }}
    >
      <circleGeometry args={[0.03, 32]}/>
      <meshStandardMaterial map={detail.texture} roughness={0.6} transparent alphaTest={0.5}/>
    </mesh>
  )
}

/** Tira de fita crepe prendendo papéis à bancada. */
function Tape({ piece }: { piece: SurfacePiece }) {
  const angle = ((piece.id.length * 37) % 20 - 10) / 100
  return (
    <mesh position={[0, piece.size.h / 2 - 0.01, 0.004]} rotation={[0, 0, angle]}>
      <planeGeometry args={[Math.min(0.16, piece.size.w * 0.45), 0.05]}/>
      <meshStandardMaterial color="#d8cca6" transparent opacity={0.78} roughness={0.95}/>
    </mesh>
  )
}

/** Enfeites fixos nas bordas da bancada: rolo de fita, parafusos e fios (não interagem). */
function Decor(): ReactNode {
  const wires = useMemo(() => [
    { color: '#b3332b', points: [[2.0, -0.62], [1.62, -0.86], [1.42, -1.05], [1.3, -1.6]] },
    { color: '#d9b43a', points: [[2.0, -0.78], [1.7, -0.95], [1.55, -1.2], [1.5, -1.6]] },
    { color: '#222426', points: [[2.0, -0.92], [1.8, -1.1], [1.7, -1.6]] },
  ].map(({ color, points }) => ({
    color,
    geometry: new TubeGeometry(new CatmullRomCurve3(points.map(([x, y]) => new Vector3(x, y, 0.012))), 40, 0.009, 8, false),
  })), [])
  useEffect(() => () => { for (const wire of wires) wire.geometry.dispose() }, [wires])
  return <group>
    <group position={[-1.45, -0.98, 0.025]}>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.05, 48, 1, true]}/>
        <meshStandardMaterial color="#d6cba8" roughness={0.9} side={2}/>
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.105, 0.105, 0.052, 48, 1, true]}/>
        <meshStandardMaterial color="#9b8a68" roughness={0.9} side={2}/>
      </mesh>
      <mesh position={[0, 0, 0.026]}>
        <ringGeometry args={[0.105, 0.17, 48]}/>
        <meshStandardMaterial color="#cbbf9a" roughness={0.95}/>
      </mesh>
    </group>
    {[[1.42, 0.98, 0.4], [1.28, 1.08, -0.3]].map(([x, y, r], i) => (
      <group key={i} position={[x, y, 0.008]} rotation={[0, 0, r]}>
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.008, 0.008, 0.11, 10]}/>
          <Steel/>
        </mesh>
        <mesh castShadow position={[-0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.018, 0.018, 0.012, 16]}/>
          <Steel color="#2b2e31" metalness={0.6} roughness={0.4}/>
        </mesh>
      </group>
    ))}
    {wires.map((wire) => (
      <mesh key={wire.color} geometry={wire.geometry} castShadow>
        <meshStandardMaterial color={wire.color} roughness={0.5}/>
      </mesh>
    ))}
  </group>
}
