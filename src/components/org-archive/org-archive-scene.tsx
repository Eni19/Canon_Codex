'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { MeshStandardMaterial, Object3D, type Group, type Texture } from 'three'
import { SurfaceBoard, SurfaceCanvas, useSurface, type PieceHandlers, type SurfacePiece } from '@/components/surface-3d/surface-board'
import type { SurfaceLayout } from '@/domain/canvas/surfaceLayout'
import { ARCHIVE_SIZE, ARCHIVE_THICKNESS, BOX, BOX_INTERIOR, DESK, clampBox, clampToArchive, restHeights, type ArchiveItemKind, type BoxAt } from '@/domain/organizations/archiveBox'
import { paintCardboard, paintCloth, paintDesk } from './archive-textures'

export type ArchivePiece = SurfacePiece & { kind: ArchiveItemKind }

export interface OrgArchiveSceneProps {
  pieces: ArchivePiece[]
  layout: SurfaceLayout
  focusId: string | null
  reduced: boolean
  open: boolean
  raisedIds: ReadonlySet<string>
  /** Documentos que acompanham a caixa sem atraso enquanto ela é arrastada. */
  carriedIds: ReadonlySet<string>
  /** Onde está a caixa na mesa. */
  box: BoxAt
  lid: { top: Texture; inside: Texture }
  /** Abertura atual do livro de registro e a página pintada sob demanda (0 = folha de rosto). */
  ledgerSpread: number
  ledgerPage: (page: number) => Texture
  /** Envelopes do maço de correspondência, de cima para baixo. */
  envelopes: Texture[]
  onToggleLid: () => void
  onBoxHover: (hovering: boolean) => void
  /** A caixa está sendo arrastada até `at` (a cada movimento) e foi solta. */
  onBoxMove: (at: BoxAt) => void
  onBoxDrop: (at: BoxAt) => void
  onDrop: (id: string, x: number, y: number) => void
  onSelect: (id: string) => void
  onBackground: () => void
  onShown?: () => void
  onCursor?: (cursor: string) => void
}

/** Ângulo da tampa aberta: passa da vertical e fica deitada para trás, mostrando o avesso (o índice). */
const LID_OPEN = -2.3
/** Altura erguida: acima da borda da caixa, para o papel nunca atravessar a parede. */
const LIFT = BOX.depth + 0.14
/** Tampo inteiro em relação à área de trabalho: cobre a vista mais afastada, numa textura só. */
const TABLETOP = 2.4
const DRAG_THRESHOLD = 5

export default function OrgArchiveScene(props: OrgArchiveSceneProps) {
  return <SurfaceCanvas background="#15110d"><ArchiveScene {...props}/></SurfaceCanvas>
}

function ArchiveScene({ pieces, layout, focusId, reduced, open, raisedIds, carriedIds, box, lid, ledgerSpread, ledgerPage, envelopes, onToggleLid, onBoxHover, onBoxMove, onBoxDrop, onDrop, onSelect, onBackground, onShown, onCursor }: OrgArchiveSceneProps) {
  // Um tampo só, pintado no tamanho todo: sem emendas entre a área de trabalho e o resto da mesa.
  const tabletop = useMemo(() => paintDesk(4096, Math.round(4096 * DESK.height / DESK.width), Math.round(6 * TABLETOP)), [])
  useEffect(() => () => tabletop.dispose(), [tabletop])
  // Altura de repouso de cada documento: empilhado na caixa ou rente à mesa (por cima de outro, só a espessura dele).
  const heights = useMemo(() => restHeights(pieces.flatMap((piece) => layout[piece.id] ? [{ id: piece.id, kind: piece.kind, ...layout[piece.id] }] : []), box), [box, layout, pieces])
  const renderPiece = (piece: SurfacePiece, handlers: PieceHandlers) => {
    if (piece.kind === 'ledger') return <Ledger handlers={handlers} spread={ledgerSpread} page={ledgerPage} reduced={reduced}/>
    if (piece.kind === 'accordion') return <Accordion handlers={handlers} texture={piece.texture}/>
    if (piece.kind === 'letters') return <Letters handlers={handlers} envelopes={envelopes}/>
    return null
  }
  const renderAttachment = (piece: SurfacePiece) => piece.kind === 'charter' ? <WaxSeal/> : null
  return (
    <SurfaceBoard
      surface={DESK} pieces={pieces} layout={layout} focusId={focusId} reduced={reduced}
      clamp={(piece, x, y) => clampToArchive(piece.kind as ArchiveItemKind, x, y, box)}
      onDrop={onDrop} onSelect={onSelect} onBackground={onBackground} onShown={onShown} onCursor={onCursor}
      // A área de trabalho só recebe os cliques; quem aparece é o tampo inteiro, logo abaixo.
      surfaceMaterial={<meshBasicMaterial transparent opacity={0} depthWrite={false}/>}
      restZ={(piece) => heights[piece.id] ?? 0.0012} liftZ={LIFT} raisedIds={raisedIds} instantIds={carriedIds} focusFill={0.66} fitScale={1.25}
      renderPiece={renderPiece} renderAttachment={renderAttachment}
    >
      <Lights/>
      <ArchiveBox open={open} reduced={reduced} lid={lid} box={box} onToggle={onToggleLid} onHover={onBoxHover} onMove={onBoxMove} onDrop={onBoxDrop}/>
      <mesh position={[0, 0, -0.0005]} receiveShadow>
        <planeGeometry args={[DESK.width * TABLETOP, DESK.height * TABLETOP]}/>
        <meshStandardMaterial map={tabletop} roughness={0.62} metalness={0}/>
      </mesh>
    </SurfaceBoard>
  )
}

/** Luz quente de luminária de mesa, de cima e da esquerda, e um preenchimento fraco do ambiente. */
function Lights() {
  const target = useMemo(() => new Object3D(), [])
  return <>
    <hemisphereLight args={['#f3e3c8', '#1a120a', 1.15]}/>
    <spotLight color="#ffdcae" intensity={70} decay={2} distance={0} position={[-2.6, 2.1, 4.3]} angle={0.8} penumbra={0.9} target={target} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}/>
    <primitive object={target} position={[0, -0.1, 0]}/>
  </>
}

type BoxGesture = { pointerId: number; startX: number; startY: number; offset: { x: number; y: number }; moved: boolean; onLid: boolean; at: BoxAt }

/**
 * Caixa-arquivo de papelão: fundo, quatro paredes e a tampa presa pela borda de trás. Clicar na
 * tampa abre ou fecha (a tampa gira com uma sobra de movimento, como papelão de verdade); arrastar
 * qualquer parte da caixa a leva pela mesa.
 */
function ArchiveBox({ open, reduced, lid, box, onToggle, onHover, onMove, onDrop }: {
  open: boolean; reduced: boolean; lid: { top: Texture; inside: Texture }; box: BoxAt
  onToggle: () => void; onHover: (hovering: boolean) => void; onMove: (at: BoxAt) => void; onDrop: (at: BoxAt) => void
}) {
  const cardboard = useMemo(() => paintCardboard('caixa'), [])
  const floor = useMemo(() => paintCardboard('fundo'), [])
  const lidMaterials = useMemo(() => {
    const side = new MeshStandardMaterial({ map: cardboard, roughness: 0.92 })
    return [side, side, side, side, new MeshStandardMaterial({ map: lid.top, roughness: 0.88 }), new MeshStandardMaterial({ map: lid.inside, roughness: 0.9 })]
  }, [cardboard, lid])
  useEffect(() => () => { cardboard.dispose(); floor.dispose(); for (const material of new Set(lidMaterials)) material.dispose() }, [cardboard, floor, lidMaterials])

  const hinge = useRef<Group>(null)
  const angle = useRef({ value: open ? LID_OPEN : 0, speed: 0 })
  useFrame((_, delta) => {
    const g = hinge.current
    if (!g) return
    const target = open ? LID_OPEN : 0
    const a = angle.current
    if (reduced) { a.value = target; a.speed = 0 }
    else {
      // Mola amortecida: a tampa passa um pouco do ponto e volta.
      const step = Math.min(delta, 1 / 30)
      a.speed += ((target - a.value) * 70 - a.speed * 11) * step
      a.value += a.speed * step
    }
    g.rotation.x = a.value
  })

  // Arraste da caixa: segue o ponteiro na mesa; sem sair do lugar, um clique na tampa abre ou fecha.
  const { onSurface } = useSurface()
  const gesture = useRef<BoxGesture | null>(null)
  const latest = useRef({ onSurface, onMove, onDrop, onToggle })
  useEffect(() => { latest.current = { onSurface, onMove, onDrop, onToggle } })
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const g = gesture.current
      if (!g || g.pointerId !== event.pointerId) return
      if (!g.moved && Math.hypot(event.clientX - g.startX, event.clientY - g.startY) < DRAG_THRESHOLD) return
      g.moved = true
      const hit = latest.current.onSurface(event.clientX, event.clientY)
      if (!hit) return
      g.at = clampBox(hit.x - g.offset.x, hit.y - g.offset.y)
      latest.current.onMove(g.at)
    }
    const up = (event: PointerEvent) => {
      const g = gesture.current
      if (!g || g.pointerId !== event.pointerId) return
      gesture.current = null
      if (g.moved) latest.current.onDrop(g.at)
      else if (g.onLid) latest.current.onToggle()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
  }, [])
  const grab = (event: ThreeEvent<PointerEvent>, onLid: boolean) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const hit = onSurface(event.clientX, event.clientY)
    if (!hit) return
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, offset: { x: hit.x - box.x, y: hit.y - box.y }, moved: false, onLid, at: box }
  }
  const grabBox = (event: ThreeEvent<PointerEvent>) => grab(event, false)
  const grabLid = (event: ThreeEvent<PointerEvent>) => grab(event, true)
  const hover = {
    onPointerOver: (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); onHover(true) },
    onPointerOut: () => onHover(false),
  }

  const t = BOX.wall, h = BOX.depth
  const walls: Array<{ size: [number, number, number]; at: [number, number] }> = [
    { size: [BOX.w, t, h], at: [0, BOX.h / 2 - t / 2] },
    { size: [BOX.w, t, h], at: [0, -BOX.h / 2 + t / 2] },
    { size: [t, BOX.h - t * 2, h], at: [-BOX.w / 2 + t / 2, 0] },
    { size: [t, BOX.h - t * 2, h], at: [BOX.w / 2 - t / 2, 0] },
  ]
  const lidW = BOX.w + 0.03, lidH = BOX.h + 0.03
  return <group position={[box.x, box.y, 0]}>
    <mesh position={[0, 0, 0.004]} receiveShadow onPointerDown={grabBox} {...hover}>
      <planeGeometry args={[BOX_INTERIOR.w, BOX_INTERIOR.h]}/>
      <meshStandardMaterial map={floor} color="#8d7454" roughness={0.95}/>
    </mesh>
    {walls.map((wall, i) => <mesh key={i} position={[wall.at[0], wall.at[1], h / 2]} castShadow receiveShadow onPointerDown={grabBox} {...hover}>
      <boxGeometry args={wall.size}/>
      <meshStandardMaterial map={cardboard} roughness={0.92}/>
    </mesh>)}
    <group ref={hinge} position={[0, BOX.h / 2 + 0.015, h]}>
      <mesh position={[0, -lidH / 2, 0.0125]} material={lidMaterials} castShadow receiveShadow onPointerDown={grabLid} {...hover}>
        <boxGeometry args={[lidW, lidH, 0.025]}/>
      </mesh>
    </group>
  </group>
}

/**
 * Livro de registro aberto: capa de percalina e duas páginas. Quando a abertura muda, uma folha gira
 * pela lombada; as páginas de baixo trocam no começo (a que aparece) e no fim (a que a folha cobre).
 */
function Ledger({ handlers, spread, page, reduced }: { handlers: PieceHandlers; spread: number; page: (page: number) => Texture; reduced: boolean }) {
  const cloth = useMemo(() => paintCloth(), [])
  useEffect(() => () => cloth.dispose(), [cloth])
  const [settled, setSettled] = useState(spread)
  const leaf = useRef<Group>(null)
  const progress = useRef({ key: '', t: 0 })
  const flipping = settled !== spread
  const forward = spread > settled
  const { w, h } = ARCHIVE_SIZE.ledger
  const pageW = w / 2 - 0.035, pageH = h - 0.06, z = ARCHIVE_THICKNESS.ledger
  const left = flipping && forward ? page(settled * 2) : page(spread * 2)
  const right = flipping && !forward ? page(settled * 2 + 1) : page(spread * 2 + 1)
  const front = forward ? page(settled * 2 + 1) : page(settled * 2)
  const back = forward ? page(spread * 2) : page(spread * 2 + 1)
  useFrame((_, delta) => {
    if (!flipping) return
    const key = `${settled}>${spread}`
    if (progress.current.key !== key) progress.current = { key, t: 0 }
    progress.current.t = reduced ? 1 : Math.min(1, progress.current.t + delta / 0.6)
    const eased = 1 - Math.pow(1 - progress.current.t, 3)
    if (leaf.current) leaf.current.rotation.y = forward ? -Math.PI * eased : -Math.PI * (1 - eased)
    if (progress.current.t >= 1) setSettled(spread)
  })
  const offset = pageW / 2 + 0.012
  return <group>
    <mesh position={[0, 0, 0.012]} castShadow receiveShadow onPointerDown={handlers.onPointerDown} onPointerOver={handlers.onPointerOver} onPointerOut={handlers.onPointerOut}>
      <boxGeometry args={[w, h, 0.024]}/>
      <meshStandardMaterial map={cloth} roughness={0.85}/>
    </mesh>
    {/* Bloco de páginas de cada lado, um pouco mais alto que a capa. */}
    {[-1, 1].map((side) => <mesh key={side} position={[side * offset, 0, z - 0.006]} receiveShadow onPointerDown={handlers.onPointerDown} onPointerOver={handlers.onPointerOver} onPointerOut={handlers.onPointerOut}>
      <boxGeometry args={[pageW, pageH, 0.012]}/>
      <meshStandardMaterial color="#e6dcc6" roughness={0.95}/>
    </mesh>)}
    <mesh position={[-offset, 0, z + 0.0005]} receiveShadow>
      <planeGeometry args={[pageW, pageH]}/>
      <meshStandardMaterial map={left} roughness={0.92}/>
    </mesh>
    <mesh position={[offset, 0, z + 0.0005]} receiveShadow>
      <planeGeometry args={[pageW, pageH]}/>
      <meshStandardMaterial map={right} roughness={0.92}/>
    </mesh>
    {flipping && <group ref={leaf} position={[0, 0, z + 0.002]} rotation={[0, forward ? 0 : -Math.PI, 0]}>
      <mesh position={[offset, 0, 0]} castShadow>
        <planeGeometry args={[pageW, pageH]}/>
        <meshStandardMaterial map={front} roughness={0.92}/>
      </mesh>
      <mesh position={[offset, 0, -0.0008]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[pageW, pageH]}/>
        <meshStandardMaterial map={back} roughness={0.92}/>
      </mesh>
    </group>}
  </group>
}

/** Pasta sanfonada: um bloco de papelão com a textura das abas por cima. */
function Accordion({ handlers, texture }: { handlers: PieceHandlers; texture?: Texture }) {
  const { w, h } = ARCHIVE_SIZE.accordion, d = ARCHIVE_THICKNESS.accordion
  const materials = useMemo(() => {
    const side = new MeshStandardMaterial({ color: '#8f6c3e', roughness: 0.92 })
    return [side, side, side, side, new MeshStandardMaterial({ map: texture, roughness: 0.9 }), side]
  }, [texture])
  useEffect(() => () => { for (const material of new Set(materials)) material.dispose() }, [materials])
  return <mesh position={[0, 0, d / 2]} material={materials} castShadow receiveShadow onPointerDown={handlers.onPointerDown} onPointerOver={handlers.onPointerOver} onPointerOut={handlers.onPointerOut}>
    <boxGeometry args={[w, h, d]}/>
  </mesh>
}

/** Maço de correspondência: envelopes empilhados meio tortos, amarrados com barbante em cruz. */
function Letters({ handlers, envelopes }: { handlers: PieceHandlers; envelopes: Texture[] }) {
  const { w, h } = ARCHIVE_SIZE.letters
  // O primeiro envelope fica por cima; os outros vão aparecendo por baixo, cada um mais torto.
  const stack = envelopes.slice(0, 5)
  const top = stack.length * 0.005 + 0.006
  return <group>
    {stack.map((map, k) => <mesh
      key={k}
      position={[(k % 2 ? 1 : -1) * k * 0.012, k * 0.008, 0.004 + (stack.length - 1 - k) * 0.005]}
      rotation={[0, 0, (k % 2 ? -1 : 1) * k * 0.035]}
      castShadow receiveShadow onPointerDown={handlers.onPointerDown} onPointerOver={handlers.onPointerOver} onPointerOut={handlers.onPointerOut}
    >
      <boxGeometry args={[w, h, 0.004]}/>
      <meshStandardMaterial map={map} roughness={0.9}/>
    </mesh>)}
    <mesh position={[0.06, 0, top]} castShadow><boxGeometry args={[w + 0.02, 0.012, 0.006]}/><meshStandardMaterial color="#c8b48a" roughness={0.95}/></mesh>
    <mesh position={[0.06, 0, top + 0.001]} castShadow><boxGeometry args={[0.012, h + 0.02, 0.006]}/><meshStandardMaterial color="#c8b48a" roughness={0.95}/></mesh>
    <mesh position={[0.06, 0, top + 0.006]} castShadow><sphereGeometry args={[0.018, 12, 8]}/><meshStandardMaterial color="#bba57a" roughness={0.95}/></mesh>
  </group>
}

/** Lacre de cera do estatuto, com o anel do sinete e duas pontas de fita por baixo. */
function WaxSeal() {
  const { w, h } = ARCHIVE_SIZE.charter
  return <group position={[w / 2 - 0.17, -h / 2 + 0.17, 0.004]}>
    {[-0.35, 0.35].map((angle) => <mesh key={angle} position={[Math.sin(angle) * 0.05, -0.07, 0.001]} rotation={[0, 0, angle]} receiveShadow>
      <planeGeometry args={[0.035, 0.14]}/>
      <meshStandardMaterial color="#6b1c1a" roughness={0.7}/>
    </mesh>)}
    <mesh position={[0, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[0.068, 0.074, 0.014, 28]}/>
      <meshStandardMaterial color="#8e1f1a" roughness={0.38}/>
    </mesh>
    <mesh position={[0, 0, 0.0155]} castShadow>
      <torusGeometry args={[0.045, 0.006, 8, 28]}/>
      <meshStandardMaterial color="#7a1915" roughness={0.42}/>
    </mesh>
  </group>
}
