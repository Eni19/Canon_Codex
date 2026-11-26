import { describe, expect, it } from 'vitest'
import { baseZoom, cameraForBounds, constrainCamera, interpolateCamera, pageToScreen, screenToPage, viewportPageBounds, wheelCamera } from '@/domain/canvas/camera'

const viewport = { w: 1000, h: 600 }
const constraints = { bounds: { x: 0, y: 0, w: 2000, h: 1000 }, padding: 40 }
const wheel = { deltaX: 0, deltaY: 0, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }

describe('câmera da cena', () => {
  it('enquadra o fundo inteiro com margem e centraliza', () => {
    const z = baseZoom(viewport, constraints)
    expect(z).toBeCloseTo(0.46)
    const camera = constrainCamera({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, viewport, constraints, true)
    const view = viewportPageBounds(camera, viewport)
    expect(view.x + view.w / 2).toBeCloseTo(1000)
    expect(view.y + view.h / 2).toBeCloseTo(500)
  })

  it('limita o zoom entre 5% e 8× do enquadramento', () => {
    const z = baseZoom(viewport, constraints)
    const current = constrainCamera({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, viewport, constraints, true)
    expect(constrainCamera({ ...current, z: 100 }, current, viewport, constraints).z).toBeCloseTo(8 * z)
    expect(constrainCamera({ ...current, z: 0.0001 }, current, viewport, constraints).z).toBeCloseTo(0.05 * z)
  })

  it('não deixa arrastar o fundo para fora da vista quando ele é maior que a tela', () => {
    const camera = constrainCamera({ x: 500, y: 500, z: 2 }, { x: 0, y: 0, z: 2 }, viewport, constraints)
    expect(camera.x).toBeCloseTo(40 / 2)
    expect(camera.y).toBeCloseTo(40 / 2)
    const far = constrainCamera({ x: -5000, y: -5000, z: 2 }, camera, viewport, constraints)
    expect(pageToScreen({ x: 2000, y: 1000 }, far).x).toBeCloseTo(viewport.w - 40)
    expect(pageToScreen({ x: 2000, y: 1000 }, far).y).toBeCloseTo(viewport.h - 40)
  })

  it('mantém centralizado quando o fundo cabe na tela', () => {
    const z = baseZoom(viewport, constraints) / 2
    const camera = constrainCamera({ x: 999, y: -999, z }, { x: 0, y: 0, z }, viewport, constraints)
    const center = screenToPage({ x: viewport.w / 2, y: viewport.h / 2 }, camera)
    expect(center.x).toBeCloseTo(1000)
    expect(center.y).toBeCloseTo(500)
  })

  it('rola com a roda e aproxima com Ctrl mantendo o ponto sob o cursor', () => {
    const camera = { x: 0, y: 0, z: 1 }
    expect(wheelCamera(camera, { ...wheel, deltaY: 50 }, { x: 0, y: 0 }, false)).toEqual({ x: 0, y: -50, z: 1 })
    expect(wheelCamera(camera, { ...wheel, deltaY: 50, shiftKey: true }, { x: 0, y: 0 }, false)).toEqual({ x: -50, y: 0, z: 1 })
    const anchor = { x: 300, y: 200 }
    const zoomed = wheelCamera(camera, { ...wheel, deltaY: -100, ctrlKey: true }, anchor, false)
    expect(zoomed.z).toBeCloseTo(1.1)
    expect(screenToPage(anchor, zoomed).x).toBeCloseTo(screenToPage(anchor, camera).x)
    expect(screenToPage(anchor, zoomed).y).toBeCloseTo(screenToPage(anchor, camera).y)
  })

  it('anima o enquadramento do início ao fim', () => {
    const from = { x: 0, y: 0, z: 1 }
    const to = cameraForBounds(constraints.bounds, viewport, 40)
    expect(interpolateCamera(from, to, viewport, 0)).toEqual(from)
    const end = interpolateCamera(from, to, viewport, 1)
    expect(end.z).toBeCloseTo(to.z)
    expect(end.x).toBeCloseTo(to.x)
  })
})
