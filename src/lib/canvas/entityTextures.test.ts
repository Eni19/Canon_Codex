import { describe, expect, it, vi } from 'vitest'
import { ENTITY_TEXTURES } from '@/domain/entities/entityVisual'
import { MAX_TILE_SIZE, TEXTURE_TILES, createTexturePatterns } from './entityTextures'

/** A 2D context that only counts drawing calls and reports a fixed peak opacity. */
function fakeContext() {
  const calls = { draw: 0 }
  const context = new Proxy({} as Record<string, unknown>, {
    get(target, key) {
      if (key === 'calls') return calls
      if (key === 'getImageData') return (_x: number, _y: number, w: number, h: number) => {
        const data = new Uint8ClampedArray(w * h * 4); data[3] = 153; return { data }
      }
      if (key in target) return target[key as string]
      return () => { if (['stroke', 'fill', 'fillRect'].includes(key as string)) calls.draw++ }
    },
    set(target, key, value) { target[key as string] = value; return true },
  })
  return context as unknown as CanvasRenderingContext2D & { calls: typeof calls }
}
function setup(limit?: number) {
  const created: { width: number; height: number; context: ReturnType<typeof fakeContext> }[] = []
  const createCanvas = vi.fn((width: number, height: number) => {
    const canvas = { width, height, context: fakeContext(), getContext: () => canvas.context }
    created.push(canvas)
    return canvas
  })
  const target = { createPattern: vi.fn(() => ({})) } as unknown as CanvasRenderingContext2D
  return { cache: createTexturePatterns({ createCanvas, ...(limit ? { limit } : {}) }), created, target }
}

describe('texture tiles', () => {
  it('has a small tile for every texture but none', () => {
    expect(Object.keys(TEXTURE_TILES).sort()).toEqual(ENTITY_TEXTURES.filter((id) => id !== 'none').sort())
    for (const { width, height } of Object.values(TEXTURE_TILES)) {
      expect(width).toBeLessThanOrEqual(MAX_TILE_SIZE)
      expect(height).toBeLessThanOrEqual(MAX_TILE_SIZE)
    }
  })

  it('paints something on every tile, scaled to the pixel ratio', () => {
    const { cache, created, target } = setup()
    for (const texture of Object.keys(TEXTURE_TILES) as (keyof typeof TEXTURE_TILES)[]) {
      expect(cache.get(target, texture, '#000', 2)?.peak, texture).toBeCloseTo(0.6, 5)
      const canvas = created[created.length - 1]
      expect(canvas.context.calls.draw, texture).toBeGreaterThan(0)
      expect(canvas.width).toBe(TEXTURE_TILES[texture].width * 2)
    }
  })
})

describe('createTexturePatterns', () => {
  it('paints one tile per texture, ink and pixel ratio and reuses it', () => {
    const { cache, created, target } = setup()
    const first = cache.get(target, 'grid', '#111', 2)
    expect(cache.get(target, 'grid', '#111', 2)).toBe(first)
    expect(cache.get(target, 'grid', '#111', 2.0001)).toBe(first)
    expect(created).toHaveLength(1)
    cache.get(target, 'grid', '#222', 2)
    cache.get(target, 'grid', '#111', 1)
    expect(created).toHaveLength(3)
  })

  it('draws nothing for the neutral texture', () => {
    const { cache, created, target } = setup()
    expect(cache.get(target, 'none', '#111', 1)).toBeNull()
    expect(created).toHaveLength(0)
  })

  it('keeps at most `limit` tiles, dropping the least recently used', () => {
    const { cache, created, target } = setup(2)
    const grid = cache.get(target, 'grid', '#111', 1)
    cache.get(target, 'fur', '#111', 1)
    cache.get(target, 'grid', '#111', 1)
    cache.get(target, 'cells', '#111', 1)
    expect(cache.size).toBe(2)
    expect(cache.get(target, 'grid', '#111', 1)).toBe(grid)
    cache.get(target, 'fur', '#111', 1)
    expect(created).toHaveLength(4)
  })

  it('does not pile up tiles over twenty theme and screen switches', () => {
    const { cache, target } = setup()
    for (let i = 0; i < 20; i++) for (const texture of Object.keys(TEXTURE_TILES) as (keyof typeof TEXTURE_TILES)[]) {
      cache.get(target, texture, i % 2 ? '#111' : '#eee', i % 3 ? 1 : 2)
    }
    expect(cache.size).toBeLessThanOrEqual(Object.keys(TEXTURE_TILES).length * 2)
  })
})
