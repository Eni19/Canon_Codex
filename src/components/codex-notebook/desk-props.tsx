'use client'

import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator, type Texture } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { DESK_SIZE, PAD, paintDesk, paintPad, type NotebookPalette } from './book-textures'

/**
 * The desk under the notebook: dark walnut, a green felt pad with a sewn edge and a fountain pen by
 * the book. Everything is drawn in code, in the notebook's
 * own colours (`--nb-*`), and placed in the margins the open view leaves free.
 */
export function Desk({ palette }: { palette: NotebookPalette }) {
  const { gl } = useThree()
  const desk = useMemo(() => paintDesk(palette), [palette])
  const pad = useMemo(() => paintPad(palette), [palette])
  // Soft reflections for the glossy things only (lacquer, brass), from a generated room:
  // nothing is downloaded, and the paper and leather keep their plain lighting.
  const environment = useMemo(() => {
    const generator = new PMREMGenerator(gl)
    const texture = generator.fromScene(new RoomEnvironment(), 0.04).texture
    generator.dispose()
    return texture
  }, [gl])
  useEffect(() => () => environment.dispose(), [environment])

  return <group>
    <mesh position={[PAD.x, -0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={(event) => event.stopPropagation()}>
      <planeGeometry args={[DESK_SIZE.width, DESK_SIZE.depth]}/>
      <meshStandardMaterial map={desk} roughness={0.6}/>
    </mesh>
    <mesh position={[PAD.x, -0.001, 0]} receiveShadow>
      <boxGeometry args={[PAD.width, 0.002, PAD.depth]}/>
      <meshStandardMaterial map={pad} roughness={0.95}/>
    </mesh>

    <FountainPen palette={palette} environment={environment} position={[-0.69, 0.01]} angle={Math.PI / 2 + 0.06}/>
  </group>
}

/**
 * A capped fountain pen in dark lacquer with brass rings and clip, lying on the felt. Built along y
 * from the end of the barrel (0) to the top of the cap, then laid down and turned to `angle`.
 */
function FountainPen({ palette, environment, position, angle }: {
  palette: NotebookPalette
  environment: Texture
  position: [number, number]
  angle: number
}) {
  const { color } = palette
  const radius = 0.0115
  const length = 0.43
  const lacquer = <meshPhysicalMaterial color={color.pen} roughness={0.32} clearcoat={0.8} clearcoatRoughness={0.2} envMap={environment} envMapIntensity={0.3}/>
  const brass = <meshStandardMaterial color={color.brass} metalness={0.65} roughness={0.42} envMap={environment} envMapIntensity={0.5}/>
  const part = (key: string, y: number, top: number, bottom: number, height: number, material: React.ReactNode) =>
    <mesh key={key} position={[0, y, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[top, bottom, height, 40]}/>
      {material}
    </mesh>

  // Modelled slender, then scaled to a real pen beside this notebook: about 13 cm long, 1 cm thick.
  const girth = 1.7
  const stretch = 1.22
  return <group position={[position[0], radius * girth, position[1]]} rotation={[0, angle, 0]}>
    <group rotation={[0, 0, Math.PI / 2]} position={[(length * stretch) / 2, 0, 0]} scale={[girth, stretch, girth]}>
      <mesh position={[0, 0.004, 0]} scale={[1, 0.7, 1]} castShadow>
        <sphereGeometry args={[0.0094, 24, 12]}/>
        {lacquer}
      </mesh>
      {part('barrel', 0.115, 0.0104, 0.0094, 0.222, lacquer)}
      {part('lip', 0.229, radius + 0.0003, radius + 0.0003, 0.007, brass)}
      {part('cap', 0.325, radius, radius, 0.186, lacquer)}
      {part('band', 0.405, radius + 0.0004, radius + 0.0004, 0.012, brass)}
      <mesh position={[0, 0.418, 0]} scale={[1, 0.55, 1]} castShadow>
        <sphereGeometry args={[radius, 24, 12]}/>
        {lacquer}
      </mesh>
      <mesh position={[0, 0.424, 0]} castShadow>
        <sphereGeometry args={[0.0045, 16, 8]}/>
        {brass}
      </mesh>
      {/* The clip, on the side facing up. */}
      <mesh position={[radius + 0.0012, 0.35, 0]} castShadow>
        <boxGeometry args={[0.0024, 0.11, 0.0042]}/>
        {brass}
      </mesh>
      <mesh position={[radius + 0.0016, 0.297, 0]} castShadow>
        <sphereGeometry args={[0.0028, 12, 8]}/>
        {brass}
      </mesh>
    </group>
  </group>
}
