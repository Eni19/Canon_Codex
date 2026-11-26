'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Object3D, PMREMGenerator, Vector3, type Group, type Mesh, type MeshStandardMaterial, type Texture } from 'three'
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

function BenchScene({ pieces, layout, focusId, reduced, details, caliperDisplay, onDrop, onSelect, onDetail, onBackground, onShown, onCursor }: ObjectBenchSceneProps) {
  const mat = useMemo(() => paintMat(), [])
  const table = useMemo(() => { const t = paintTable(); t.wrapS = t.wrapT = 1000; t.repeat.set(3, 2); return t }, [])
  useEffect(() => () => { mat.dispose(); table.dispose() }, [mat, table])
  const environment = useStudioEnvironment()

  const renderPiece = (piece: SurfacePiece, handlers: PieceHandlers) => {
    if (piece.kind === 'caliper') return <Caliper handlers={handlers} display={caliperDisplay}/>
    if (piece.kind === 'loupe') return <Loupe handlers={handlers} reduced={reduced} specimen={pieces.find((item) => item.kind === 'specimen')?.texture} details={details} onDetail={onDetail}/>
    return null
  }
  const renderAttachment = (piece: SurfacePiece) => {
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

/** Luz de teto, fria e larga, de cima e da esquerda; sem lanterna (a bancada não é investigação). */
function Lights() {
  const keyTarget = useMemo(() => new Object3D(), [])
  return <>
    <hemisphereLight args={['#e2e8eb', '#1a1d1f', 1.6]}/>
    <spotLight color="#eef1f2" intensity={62} decay={2} distance={0} position={[-2.4, 2.4, 4.4]} angle={0.75} penumbra={0.85} target={keyTarget} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}/>
    <primitive object={keyTarget} position={[0.3, -0.2, 0]}/>
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

/** Onde a lente está sobre a foto (em coordenadas da foto) e quanto girar o que ela mostra. */
type LensView = { x: number; y: number; rotation: number; shown: number }

/**
 * Lupa: aro escuro, vidro e cabo. Sobre a foto do objeto, o vidro mostra a foto ampliada (a parte
 * que está embaixo dele) e revela os detalhes marcados: eles só aparecem dentro da lente.
 */
function Loupe({ handlers, reduced, specimen, details, onDetail }: { handlers: PieceHandlers; reduced: boolean; specimen?: Texture; details: BenchDetail[]; onDetail: (id: string) => void }) {
  const over = useOverSpecimen('loupe')
  const { groups } = useSurface()
  const lens = useRef<Mesh>(null)
  const view = useRef<LensView>({ x: 0, y: 0, rotation: 0, shown: 0 })
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
    const v = view.current
    v.shown += ((over ? 1 : 0) - v.shown) * (reduced ? 1 : 1 - Math.exp(-delta * 8))
    const mesh = lens.current, photo = groups.current.get('specimen'), self = groups.current.get('loupe')
    if (!mesh || !magnified || !photo || !self) return
    mesh.visible = v.shown > 0.02
    ;(mesh.material as MeshStandardMaterial).opacity = v.shown
    // Ponto da foto sob o centro da lente, em coordenadas da foto.
    mesh.getWorldPosition(world)
    photo.worldToLocal(world)
    v.x = world.x
    v.y = world.y
    const { w, h } = BENCH_SIZE.specimen
    const span = (2 * LENS_RADIUS) / LENS_ZOOM
    magnified.repeat.set(span / w, span / h)
    magnified.offset.set(world.x / w + 0.5 - span / w / 2, world.y / h + 0.5 - span / h / 2)
    // O conteúdo ampliado fica alinhado com a foto, mesmo com a lupa girada.
    v.rotation = photo.rotation.z - self.rotation.z
    mesh.rotation.z = v.rotation
  })
  return (
    <group {...handlers}>
      <group position={[-0.15, 0, 0.03]}>
        <mesh castShadow>
          <torusGeometry args={[LENS_RADIUS, 0.014, 16, 64]}/>
          <Steel color="#1f2224" roughness={0.35} metalness={0.6}/>
        </mesh>
        <mesh>
          <circleGeometry args={[LENS_RADIUS, 48]}/>
          <meshStandardMaterial color="#d6e6ec" transparent opacity={0.16} roughness={0.05} metalness={0.1}/>
        </mesh>
        {magnified && (
          <mesh ref={lens} position={[0, 0, 0.0005]} visible={false}>
            <circleGeometry args={[LENS_RADIUS - 0.004, 48]}/>
            <meshStandardMaterial map={magnified} roughness={0.35} transparent opacity={0}/>
          </mesh>
        )}
        {details.map((detail) => <LensSticker key={detail.id} detail={detail} view={view} onDetail={onDetail}/>)}
        {/* Brilho do vidro. */}
        <mesh position={[-0.04, 0.05, 0.003]} rotation={[0, 0, 0.6]}>
          <planeGeometry args={[0.1, 0.018]}/>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.22}/>
        </mesh>
      </group>
      {/* Haste de metal presa ao aro e cabo de madeira. */}
      <mesh castShadow position={[0.04, 0, 0.03]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.1, 16]}/>
        <Steel/>
      </mesh>
      <mesh castShadow position={[0.19, 0, 0.03]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.024, 0.02, 0.2, 24]}/>
        <meshStandardMaterial color="#5a3a26" roughness={0.6}/>
      </mesh>
    </group>
  )
}

const STICKER_RADIUS = 0.04

/**
 * Adesivo numerado de um detalhe, visto pela lente: fica no ponto ampliado correspondente e só
 * aparece quando cabe dentro do vidro. Clicar abre a leitura daquele detalhe.
 */
function LensSticker({ detail, view, onDetail }: { detail: BenchDetail; view: RefObject<LensView>; onDetail: (id: string) => void }) {
  const mesh = useRef<Mesh>(null)
  const down = useRef<{ x: number; y: number } | null>(null)
  const { w, h } = BENCH_SIZE.specimen
  const px = (SPECIMEN_PHOTO.x + SPECIMEN_PHOTO.w * detail.x / 100 - 0.5) * w
  const py = (0.5 - (SPECIMEN_PHOTO.y + SPECIMEN_PHOTO.h * detail.y / 100)) * h
  useFrame(() => {
    const m = mesh.current, v = view.current
    if (!m) return
    const dx = (px - v.x) * LENS_ZOOM, dy = (py - v.y) * LENS_ZOOM
    m.visible = Math.hypot(dx, dy) < LENS_RADIUS - STICKER_RADIUS * 0.6 && v.shown > 0.5
    const cos = Math.cos(v.rotation), sin = Math.sin(v.rotation)
    m.position.set(dx * cos - dy * sin, dx * sin + dy * cos, 0.002)
    m.scale.setScalar(Math.max(0.01, (v.shown - 0.5) * 2))
  })
  return (
    <mesh
      ref={mesh} visible={false}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => { if (!event.object.visible) return; event.stopPropagation(); down.current = { x: event.clientX, y: event.clientY } }}
      onPointerUp={(event: ThreeEvent<PointerEvent>) => {
        if (!down.current) return
        event.stopPropagation()
        if (Math.hypot(event.clientX - down.current.x, event.clientY - down.current.y) < 5) onDetail(detail.id)
        down.current = null
      }}
    >
      <circleGeometry args={[STICKER_RADIUS, 32]}/>
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

/** Enfeite fixo na borda da bancada: um rolo de fita crepe (não interage). */
function Decor(): ReactNode {
  return <group position={[-1.45, -0.98, 0.025]}>
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
}
