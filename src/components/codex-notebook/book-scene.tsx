'use client'

import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  BackSide, BufferAttribute, BufferGeometry, CanvasTexture, Color, FrontSide, PerspectiveCamera, PlaneGeometry,
  Quaternion, RepeatWrapping, Vector3, type DirectionalLight, type Group, type Mesh, type MeshBasicMaterial, type Texture,
} from 'three'
import { bendProfile, BEND_SEGMENTS, blockHeights, BOARD, BLOCK, PAGE_DEPTH, PAGE_WIDTH } from './book-geometry'
import { paintCover, paintDesk, paintEndpaper, paintLeather, paintPageEdges, type NotebookPalette } from './book-textures'

/** Size of the index paper on the desk, in world units and in CSS pixels of its HTML. */
export const INDEX_WIDTH = 0.34
export const INDEX_DEPTH = 0.52
export const INDEX_PX = { width: 340, height: 520 }
/** Where the index paper lies once pulled out: on the desk, to the right of the open book. */
const INDEX_ON_DESK = new Vector3(PAGE_WIDTH + 0.3, 0.0015, 0.04)
const INDEX_DESK_TURN = -0.05
/** Textured surfaces are not tinted: the picture already carries the paper colour. */
const UNTINTED = new Color(1, 1, 1)

export interface TurnState {
  dir: 'next' | 'prev'
}

/** Live values the scene reads every frame, written by the notebook without re-rendering. */
export interface SceneMotion {
  /** Leaf position while a page turns: 0 flat on the right, 1 flat on the left. */
  progress: number
  /** 0 closed on the desk … 1 open with the camera overhead. */
  open: number
}

/** DOM overlays the scene keeps aligned with the pages and the index paper. */
export interface OverlayTargets {
  left: HTMLElement | null
  right: HTMLElement | null
  index: HTMLElement | null
}

export interface BookSceneProps {
  palette: NotebookPalette
  worldName: string
  recordLine: string
  fonts: { serif: string; type: string }
  turn: TurnState | null
  motion: RefObject<SceneMotion>
  overlays: RefObject<OverlayTargets>
  textures: {
    left: Texture | null
    right: Texture | null
    front: Texture | null
    back: Texture | null
    index: Texture | null
  }
  onOpenRequest: () => void
}

export default function BookScene(props: BookSceneProps) {
  return (
    <Canvas flat shadows dpr={[1, 2]} camera={{ fov: 30, near: 0.02, far: 30, position: [0, 0.85, 0.95] }} gl={{ antialias: true, alpha: true }}>
      <Scene {...props}/>
    </Canvas>
  )
}

const smooth = (t: number) => t * t * (3 - 2 * t)
const segment = (t: number, start: number, length: number) => smooth(Math.min(1, Math.max(0, (t - start) / length)))

function Scene({ palette, worldName, recordLine, fonts, turn, motion, overlays, textures, onOpenRequest }: BookSceneProps) {
  const { color } = palette
  const cover = useMemo(() => paintCover(palette, worldName, recordLine, fonts.serif, fonts.type), [palette, worldName, recordLine, fonts])
  const endpaper = useMemo(() => paintEndpaper(palette), [palette])
  const leather = useMemo(() => paintLeather(palette), [palette])
  const desk = useMemo(() => paintDesk(palette), [palette])
  const edges = useMemo(() => paintPageEdges(palette), [palette])

  const book = useRef<Group>(null)
  const hinge = useRef<Group>(null)
  const indexPaper = useRef<Group>(null)
  const light = useRef<DirectionalLight>(null)
  const { left: leftBlock, right: rightBlock } = blockHeights()
  const leftY = BOARD + leftBlock + 0.0008
  const rightY = BOARD + rightBlock + 0.0008

  useLayoutEffect(() => {
    const target = light.current?.target
    if (!target) return
    target.position.set(0.2, 0, 0)
    target.updateMatrixWorld()
  }, [])

  // Cover pose, book slide, index paper and camera all follow the single `open` value.
  useFrame(() => {
    const open = motion.current.open
    const paper = segment(open, 0, 0.45)
    const lid = segment(open, 0.25, 0.55)
    if (book.current) book.current.position.x = (-PAGE_WIDTH / 2) * (1 - lid)
    if (hinge.current) {
      hinge.current.rotation.z = Math.PI * lid
      hinge.current.position.y = BOARD + BLOCK + BOARD / 2 + (BOARD / 2 - (BOARD + BLOCK + BOARD / 2)) * lid
    }
    const sheet = indexPaper.current
    if (sheet && book.current) {
      // Closed, the paper lies on the cover; it slides off to the desk as the book opens.
      const onCover = new Vector3(0.05, BOARD * 2 + BLOCK + 0.002, 0.16)
      sheet.position.lerpVectors(onCover, INDEX_ON_DESK, paper)
      sheet.position.y += Math.sin(Math.PI * paper) * 0.06
      sheet.rotation.y = 0.04 + (INDEX_DESK_TURN - 0.04) * paper
    }
  })

  return <>
    <CameraRig motion={motion} overlays={overlays} leftY={leftY} rightY={rightY}/>
    <hemisphereLight args={[color.paper, color['desk-deep'], 0.45]}/>
    <directionalLight
      ref={light}
      color={color.card}
      intensity={1.5}
      position={[-0.9, 2.2, 1.1]}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.01}
      shadow-camera-left={-1.4}
      shadow-camera-right={1.6}
      shadow-camera-top={1}
      shadow-camera-bottom={-1}
    />
    <pointLight color={color.brass} intensity={0.35} position={[0.4, 0.9, -0.6]} distance={3} decay={1.6}/>

    {/* The walnut desk the notebook lies on; it also catches the book's soft shadow. */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={(event) => event.stopPropagation()}>
      <planeGeometry args={[8, 8]}/>
      <meshStandardMaterial map={desk} roughness={0.85}/>
    </mesh>

    <group ref={book}>
      <group onClick={(event) => { event.stopPropagation(); if (motion.current.open < 0.01) onOpenRequest() }}>
        {/* Back cover, under everything. */}
        <mesh position={[PAGE_WIDTH / 2, BOARD / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[PAGE_WIDTH + 0.012, BOARD, PAGE_DEPTH + 0.016]}/>
          <meshStandardMaterial map={leather} roughness={0.72}/>
        </mesh>
        {/* Page blocks: read pages pile up on the left. */}
        <PageBlock x={PAGE_WIDTH / 2} height={rightBlock} edges={edges} paper={color.paper}/>
        {/* Spine, kept below both page surfaces so it never shows as a strip between the pages. */}
        <mesh position={[0, (BOARD + Math.min(leftBlock, rightBlock)) / 2, 0]} castShadow>
          <boxGeometry args={[0.014, BOARD + Math.min(leftBlock, rightBlock), PAGE_DEPTH + 0.016]}/>
          <meshStandardMaterial map={leather} roughness={0.72}/>
        </mesh>
        {/* Front cover, on its hinge: leather outside, endpaper inside. */}
        <group ref={hinge} position={[0, BOARD + BLOCK + BOARD / 2, 0]}>
          <mesh position={[PAGE_WIDTH / 2 + 0.006, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[PAGE_WIDTH + 0.012, BOARD, PAGE_DEPTH + 0.016]}/>
            {[color['cover-deep'], color['cover-deep']].map((tint, i) => <meshStandardMaterial key={i} attach={`material-${i}`} color={tint} roughness={0.7}/>)}
            <meshStandardMaterial attach="material-2" map={cover} roughness={0.62}/>
            <meshStandardMaterial attach="material-3" map={endpaper} roughness={0.85}/>
            <meshStandardMaterial attach="material-4" color={color['cover-deep']} roughness={0.7}/>
            <meshStandardMaterial attach="material-5" color={color['cover-deep']} roughness={0.7}/>
          </mesh>
          {/* The left half of the pages is bound to the cover, as in a real notebook: it turns over with
              it when the book opens and lies exactly where the open book's left side is, so nothing is
              swapped (and nothing flickers) when the cover lands. */}
          <group position={[0, -(BOARD * 1.5 + leftBlock), 0]}>
            <PageBlock x={PAGE_WIDTH / 2} height={leftBlock} edges={edges} paper={color.paper}/>
          </group>
          <LeftPage texture={textures.left} paper={color.paper} y={-(BOARD / 2 + leftBlock + 0.0008)}/>
        </group>
        <PagePlane x={PAGE_WIDTH / 2} y={rightY} texture={textures.right} paper={color.paper} visible/>
        {turn && <TurningPage motion={motion} rightY={rightY} leftY={leftY} front={textures.front} back={textures.back} paper={color.paper}/>}
        <LeafShadows motion={motion} leftY={leftY} rightY={rightY} active={turn !== null}/>
      </group>
    </group>

    <group ref={indexPaper}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <planeGeometry args={[INDEX_WIDTH, INDEX_DEPTH]}/>
        <meshBasicMaterial key={textures.index?.uuid ?? 'blank'} map={textures.index} color={textures.index ? UNTINTED : color.card}/>
      </mesh>
    </group>
  </>
}

/**
 * Page surfaces are unlit, and the whole scene is drawn without tone mapping (`flat`), so a page's
 * picture shows exactly the colours of its HTML: swapping one for the other no longer changes the
 * light. Depth on the moving page comes from per-vertex shading instead (see TurningPage).
 */
function pageGeometry(mirrorU: boolean, mirrorV: boolean) {
  const geometry = new PlaneGeometry(PAGE_WIDTH, PAGE_DEPTH)
  const uv = geometry.getAttribute('uv') as BufferAttribute
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, mirrorU ? 1 - uv.getX(i) : uv.getX(i), mirrorV ? 1 - uv.getY(i) : uv.getY(i))
  }
  return geometry
}

/**
 * The left page, bound to the inside of the cover. It faces down while the book is closed and, turned
 * over with the cover, lies where the open book's left page is. Seen from inside the cover the page is
 * upside down and mirrored; its UVs are turned instead of its texture, so the picture is not copied
 * (a copy is uploaded to the GPU again).
 */
function LeftPage({ texture, paper, y }: { texture: Texture | null; paper: Color; y: number }) {
  const geometry = useMemo(() => pageGeometry(true, true), [])
  return <mesh geometry={geometry} position={[PAGE_WIDTH / 2, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
    <meshBasicMaterial key={texture?.uuid ?? 'blank'} map={texture} color={texture ? UNTINTED : paper}/>
  </mesh>
}

function PageBlock({ x, height, edges, paper }: { x: number; height: number; edges: Texture; paper: Color }) {
  const sideEdges = useMemo(() => {
    const texture = edges.clone()
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.repeat.set(1, Math.max(1, height * 200))
    texture.needsUpdate = true
    return texture
  }, [edges, height])
  if (height < 0.0005) return null
  return <mesh position={[x, BOARD + height / 2, 0]} castShadow receiveShadow>
    <boxGeometry args={[PAGE_WIDTH - 0.004, height, PAGE_DEPTH - 0.004]}/>
    <meshStandardMaterial attach="material-0" map={sideEdges} roughness={0.9}/>
    <meshStandardMaterial attach="material-1" map={sideEdges} roughness={0.9}/>
    <meshStandardMaterial attach="material-2" color={paper} roughness={0.9}/>
    <meshStandardMaterial attach="material-3" color={paper} roughness={0.9}/>
    <meshStandardMaterial attach="material-4" map={sideEdges} roughness={0.9}/>
    <meshStandardMaterial attach="material-5" map={sideEdges} roughness={0.9}/>
  </mesh>
}

function PagePlane({ x, y, texture, paper, visible }: { x: number; y: number; texture: Texture | null; paper: Color; visible: boolean }) {
  return <mesh position={[x, y, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={visible}>
    <planeGeometry args={[PAGE_WIDTH, PAGE_DEPTH]}/>
    {/* Keyed by texture: a material created without a map does not pick one up later. */}
    <meshBasicMaterial key={texture?.uuid ?? 'blank'} map={texture} color={texture ? UNTINTED : paper}/>
  </mesh>
}

/**
 * Shadow the lifted page throws on the page beneath it: a soft gradient from the spine, strongest
 * mid-turn, on whichever side the leaf is hanging over.
 */
function LeafShadows({ motion, leftY, rightY, active }: { motion: RefObject<SceneMotion>; leftY: number; rightY: number; active: boolean }) {
  const gradient = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 4
    const context = canvas.getContext('2d')
    if (context) {
      const fade = context.createLinearGradient(0, 0, 256, 0)
      fade.addColorStop(0, 'rgba(0,0,0,0.85)')
      fade.addColorStop(0.55, 'rgba(0,0,0,0.25)')
      fade.addColorStop(1, 'rgba(0,0,0,0)')
      context.fillStyle = fade
      context.fillRect(0, 0, 256, 4)
    }
    return new CanvasTexture(canvas)
  }, [])
  const geometries = useMemo(() => ({ right: pageGeometry(false, false), left: pageGeometry(true, false) }), [])
  const right = useRef<Mesh>(null)
  const left = useRef<Mesh>(null)
  useFrame(() => {
    const p = motion.current.progress
    const lift = active ? Math.sin(Math.PI * p) : 0
    const setOpacity = (mesh: Mesh | null, value: number) => {
      if (!mesh) return
      ;(mesh.material as MeshBasicMaterial).opacity = value
      mesh.visible = value > 0.002
    }
    setOpacity(right.current, p < 0.5 ? lift * 0.42 : 0)
    setOpacity(left.current, p >= 0.5 ? lift * 0.42 : 0)
  })
  return <>
    <mesh ref={right} geometry={geometries.right} position={[PAGE_WIDTH / 2, rightY + 0.0004, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <meshBasicMaterial map={gradient} transparent depthWrite={false} opacity={0}/>
    </mesh>
    <mesh ref={left} geometry={geometries.left} position={[-PAGE_WIDTH / 2, leftY + 0.0004, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <meshBasicMaterial map={gradient} transparent depthWrite={false} opacity={0}/>
    </mesh>
  </>
}

/**
 * The page in motion: a strip mesh bent along `bendProfile`, printed on both sides. It is unlit like
 * the still pages; each column is darkened by how far it has turned from facing up, which gives the
 * curl its depth without changing the paper's colour when it lands.
 */
function TurningPage({ motion, rightY, leftY, front, back, paper }: {
  motion: RefObject<SceneMotion>; rightY: number; leftY: number; front: Texture | null; back: Texture | null; paper: Color
}) {
  const { frontGeometry, backGeometry } = useMemo(() => {
    const columns = BEND_SEGMENTS + 1
    const position = new BufferAttribute(new Float32Array(columns * 2 * 3), 3)
    const shade = new BufferAttribute(new Float32Array(columns * 2 * 3).fill(1), 3)
    const uvFront = new Float32Array(columns * 2 * 2)
    const uvBack = new Float32Array(columns * 2 * 2)
    const indices: number[] = []
    for (let i = 0; i < columns; i += 1) {
      const u = i / BEND_SEGMENTS
      uvFront.set([u, 1, u, 0], i * 4)
      // The back shows the next page's left side, mirrored so it reads correctly once turned over.
      uvBack.set([1 - u, 1, 1 - u, 0], i * 4)
      if (i < BEND_SEGMENTS) {
        const a = i * 2
        indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3)
      }
    }
    const build = (uv: Float32Array) => {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', position)
      geometry.setAttribute('color', shade)
      geometry.setAttribute('uv', new BufferAttribute(uv, 2))
      geometry.setIndex(indices)
      return geometry
    }
    return { frontGeometry: build(uvFront), backGeometry: build(uvBack) }
  }, [])

  useFrame(() => {
    const points = bendProfile(motion.current.progress, rightY, leftY)
    const position = frontGeometry.getAttribute('position') as BufferAttribute
    const shade = frontGeometry.getAttribute('color') as BufferAttribute
    points.forEach((point, i) => {
      position.setXYZ(i * 2, point.x, point.y, -PAGE_DEPTH / 2)
      position.setXYZ(i * 2 + 1, point.x, point.y, PAGE_DEPTH / 2)
      const from = points[Math.max(0, i - 1)]
      const to = points[Math.min(points.length - 1, i + 1)]
      const facing = Math.abs(Math.cos(Math.atan2(to.y - from.y, to.x - from.x)))
      const light = 0.62 + 0.38 * facing
      shade.setXYZ(i * 2, light, light, light)
      shade.setXYZ(i * 2 + 1, light, light, light)
    })
    position.needsUpdate = true
    shade.needsUpdate = true
  })

  return <>
    {/* Not culled: the leaf moves every frame and always lies within the view. */}
    <mesh geometry={frontGeometry} castShadow frustumCulled={false}>
      <meshBasicMaterial key={front?.uuid ?? 'blank'} map={front} color={front ? UNTINTED : paper} vertexColors side={FrontSide}/>
    </mesh>
    <mesh geometry={backGeometry} frustumCulled={false}>
      <meshBasicMaterial key={back?.uuid ?? 'blank'} map={back} color={back ? UNTINTED : paper} vertexColors side={BackSide}/>
    </mesh>
  </>
}

/**
 * The camera: a three-quarter view of the closed book, which turns a little with the pointer, and a
 * straight overhead view of the open book. Overhead, every page is parallel to the screen, so its
 * HTML can be placed over it with a plain 2D transform (no CSS 3D, which misbehaves in Firefox).
 */
function CameraRig({ motion, overlays, leftY, rightY }: { motion: RefObject<SceneMotion>; overlays: RefObject<OverlayTargets>; leftY: number; rightY: number }) {
  const { camera, size } = useThree()
  // A camera, not a plain Object3D: lookAt points cameras down -z, other objects down +z.
  const helper = useMemo(() => new PerspectiveCamera(), [])
  const closedPose = useMemo(() => ({ position: new Vector3(), quaternion: new Quaternion() }), [])
  const openPose = useMemo(() => ({ position: new Vector3(), quaternion: new Quaternion() }), [])
  const sway = useRef({ x: 0, y: 0 })
  const corner = useMemo(() => new Vector3(), [])

  useFrame((state) => {
    const perspective = camera as PerspectiveCamera
    const open = motion.current.open
    const view = segment(open, 0.2, 0.8)
    // The pointer only sways the closed view; open, the camera holds still so the pages stay crisp.
    sway.current.x += (state.pointer.x * (1 - view) - sway.current.x) * 0.06
    sway.current.y += (state.pointer.y * (1 - view) - sway.current.y) * 0.06

    // Closed: a three-quarter view that drifts with the pointer.
    helper.up.set(0, 1, 0)
    helper.position.set(sway.current.x * 0.035, 1.72 + sway.current.y * 0.015, 0.92)
    helper.lookAt(0, 0.02, 0.04)
    closedPose.position.copy(helper.position)
    closedPose.quaternion.copy(helper.quaternion)

    // Open: straight down, framing the spread and the index paper to its right.
    const aspect = size.width / Math.max(1, size.height)
    const tan = Math.tan((perspective.fov * Math.PI) / 360)
    const spanX = (PAGE_WIDTH * 2 + 0.75) / 2
    const spanZ = (PAGE_DEPTH + 0.12) / 2
    const height = Math.max(spanX / (tan * aspect), spanZ / tan) * 1.04
    const centreX = 0.19
    helper.up.set(0, 0, -1)
    helper.position.set(centreX, height, 0)
    helper.lookAt(helper.position.x, 0, helper.position.z)
    openPose.position.copy(helper.position)
    openPose.quaternion.copy(helper.quaternion)

    camera.position.lerpVectors(closedPose.position, openPose.position, view)
    camera.quaternion.slerpQuaternions(closedPose.quaternion, openPose.quaternion, view)
    camera.updateMatrixWorld()

    // Align the HTML overlays with the pages and the index paper.
    const targets = overlays.current
    const project = (x: number, y: number, z: number) => {
      corner.set(x, y, z).project(camera)
      return { x: ((corner.x + 1) / 2) * size.width, y: ((1 - corner.y) / 2) * size.height }
    }
    const place = (element: HTMLElement | null, topLeft: { x: number; y: number }, topRight: { x: number; y: number }, pixelWidth: number) => {
      if (!element) return
      const angle = Math.atan2(topRight.y - topLeft.y, topRight.x - topLeft.x)
      const scale = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y) / pixelWidth
      // Whole pixels: sub-pixel positions make fine lines (the paper's grid) shimmer.
      element.style.transform = `translate(${Math.round(topLeft.x)}px, ${Math.round(topLeft.y)}px) rotate(${angle.toFixed(4)}rad) scale(${scale.toFixed(4)})`
    }
    place(targets.left, project(-PAGE_WIDTH, leftY, -PAGE_DEPTH / 2), project(0, leftY, -PAGE_DEPTH / 2), 600)
    place(targets.right, project(0, rightY, -PAGE_DEPTH / 2), project(PAGE_WIDTH, rightY, -PAGE_DEPTH / 2), 600)
    if (targets.index) {
      const turnBy = INDEX_DESK_TURN
      const cos = Math.cos(turnBy)
      const sin = Math.sin(turnBy)
      const local = (x: number, z: number) => project(INDEX_ON_DESK.x + x * cos + z * sin, INDEX_ON_DESK.y, INDEX_ON_DESK.z - x * sin + z * cos)
      place(targets.index, local(-INDEX_WIDTH / 2, -INDEX_DEPTH / 2), local(INDEX_WIDTH / 2, -INDEX_DEPTH / 2), INDEX_PX.width)
    }
  }, -1)

  return null
}
