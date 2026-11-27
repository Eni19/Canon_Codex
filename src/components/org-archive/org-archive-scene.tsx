'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { MeshStandardMaterial, Object3D, type Group, type Texture } from 'three'
import { SurfaceBoard, SurfaceCanvas, type SurfacePiece } from '@/components/surface-3d/surface-board'
import type { SurfaceLayout } from '@/domain/canvas/surfaceLayout'
import { BOX, BOX_INTERIOR, DESK, clampToArchive, restHeight, type ArchiveItemKind } from '@/domain/organizations/archiveBox'
import { paintCardboard, paintDesk } from './archive-textures'

export type ArchivePiece = SurfacePiece & { kind: ArchiveItemKind }

export interface OrgArchiveSceneProps {
  pieces: ArchivePiece[]
  layout: SurfaceLayout
  focusId: string | null
  reduced: boolean
  open: boolean
  raisedIds: ReadonlySet<string>
  lid: { top: Texture; inside: Texture }
  onToggleLid: () => void
  onLidHover: (hovering: boolean) => void
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

export default function OrgArchiveScene(props: OrgArchiveSceneProps) {
  return <SurfaceCanvas background="#15110d"><ArchiveScene {...props}/></SurfaceCanvas>
}

function ArchiveScene({ pieces, layout, focusId, reduced, open, raisedIds, lid, onToggleLid, onLidHover, onDrop, onSelect, onBackground, onShown, onCursor }: OrgArchiveSceneProps) {
  const desk = useMemo(() => paintDesk(), [])
  useEffect(() => () => desk.dispose(), [desk])
  return (
    <SurfaceBoard
      surface={DESK} pieces={pieces} layout={layout} focusId={focusId} reduced={reduced}
      clamp={(piece, x, y) => clampToArchive(piece.kind as ArchiveItemKind, x, y)}
      onDrop={onDrop} onSelect={onSelect} onBackground={onBackground} onShown={onShown} onCursor={onCursor}
      surfaceMaterial={<meshStandardMaterial map={desk} roughness={0.62} metalness={0}/>}
      restZ={(_, x, y, order) => restHeight(x, y, order)} liftZ={LIFT} raisedIds={raisedIds} focusFill={0.66}
    >
      <Lights/>
      <ArchiveBox open={open} reduced={reduced} lid={lid} onToggle={onToggleLid} onHover={onLidHover}/>
      {/* Chão escuro em volta da mesa, para ela não flutuar no vazio. */}
      <mesh position={[0, 0, -0.02]} receiveShadow>
        <planeGeometry args={[DESK.width * 2.4, DESK.height * 2.6]}/>
        <meshStandardMaterial color="#120e0a" roughness={0.95}/>
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

/**
 * Caixa-arquivo de papelão: fundo, quatro paredes e a tampa presa pela borda de trás. Clicar na
 * tampa abre ou fecha; a tampa gira com uma sobra de movimento, como papelão de verdade.
 */
function ArchiveBox({ open, reduced, lid, onToggle, onHover }: { open: boolean; reduced: boolean; lid: { top: Texture; inside: Texture }; onToggle: () => void; onHover: (hovering: boolean) => void }) {
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

  const t = BOX.wall, h = BOX.depth
  const walls: Array<{ size: [number, number, number]; at: [number, number] }> = [
    { size: [BOX.w, t, h], at: [BOX.x, BOX.y + BOX.h / 2 - t / 2] },
    { size: [BOX.w, t, h], at: [BOX.x, BOX.y - BOX.h / 2 + t / 2] },
    { size: [t, BOX.h - t * 2, h], at: [BOX.x - BOX.w / 2 + t / 2, BOX.y] },
    { size: [t, BOX.h - t * 2, h], at: [BOX.x + BOX.w / 2 - t / 2, BOX.y] },
  ]
  const lidW = BOX.w + 0.03, lidH = BOX.h + 0.03
  const click = (event: ThreeEvent<PointerEvent>) => { if (event.button !== 0) return; event.stopPropagation(); onToggle() }
  return <group>
    <mesh position={[BOX_INTERIOR.x, BOX_INTERIOR.y, 0.004]} receiveShadow>
      <planeGeometry args={[BOX_INTERIOR.w, BOX_INTERIOR.h]}/>
      <meshStandardMaterial map={floor} color="#8d7454" roughness={0.95}/>
    </mesh>
    {walls.map((wall, i) => <mesh key={i} position={[wall.at[0], wall.at[1], h / 2]} castShadow receiveShadow>
      <boxGeometry args={wall.size}/>
      <meshStandardMaterial map={cardboard} roughness={0.92}/>
    </mesh>)}
    <group ref={hinge} position={[BOX.x, BOX.y + BOX.h / 2 + 0.015, h]}>
      <mesh
        position={[0, -lidH / 2, 0.0125]} material={lidMaterials} castShadow receiveShadow
        onPointerDown={click}
        onPointerOver={(event) => { event.stopPropagation(); onHover(true) }}
        onPointerOut={() => onHover(false)}
      >
        <boxGeometry args={[lidW, lidH, 0.025]}/>
      </mesh>
    </group>
  </group>
}
