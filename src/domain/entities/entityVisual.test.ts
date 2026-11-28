import { describe, expect, it } from 'vitest'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import {
  ENTITY_SILHOUETTES,
  ENTITY_TEXTURES,
  ENTITY_VISUAL_CATALOG,
  NEUTRAL_ENTITY_VISUAL,
  SILHOUETTE_LABELS,
  TEXTURE_LABELS,
  entityVisualFor,
} from './entityVisual'

const seedTypeIds = createDefaultWorldSeed().entityTypes.map((type) => type.id)
const catalog = Object.entries(ENTITY_VISUAL_CATALOG)

describe('entity visual catalog', () => {
  it('covers exactly the types of the seed world', () => {
    expect(Object.keys(ENTITY_VISUAL_CATALOG).sort()).toEqual([...seedTypeIds].sort())
    expect(seedTypeIds).toHaveLength(17)
  })

  it('gives every seed type its own silhouette and its own texture', () => {
    const silhouettes = catalog.map(([, visual]) => visual.silhouette)
    const textures = catalog.map(([, visual]) => visual.texture)
    expect(new Set(silhouettes).size).toBe(catalog.length)
    expect(new Set(textures).size).toBe(catalog.length)
  })

  it('never reuses the neutral card for a catalogued type', () => {
    for (const [typeId, visual] of catalog) {
      expect(visual.silhouette, typeId).not.toBe(NEUTRAL_ENTITY_VISUAL.silhouette)
      expect(visual.texture, typeId).not.toBe(NEUTRAL_ENTITY_VISUAL.texture)
    }
  })

  it('uses only known silhouettes and textures, and every one of them', () => {
    const used = new Set(catalog.map(([, visual]) => visual.silhouette))
    used.add(NEUTRAL_ENTITY_VISUAL.silhouette)
    expect([...used].sort()).toEqual([...ENTITY_SILHOUETTES].sort())
    const textures = new Set(catalog.map(([, visual]) => visual.texture))
    textures.add(NEUTRAL_ENTITY_VISUAL.texture)
    expect([...textures].sort()).toEqual([...ENTITY_TEXTURES].sort())
  })

  it('cannot be changed at runtime', () => {
    expect(Object.isFrozen(ENTITY_VISUAL_CATALOG)).toBe(true)
    expect(Object.isFrozen(ENTITY_VISUAL_CATALOG.character)).toBe(true)
    expect(Object.isFrozen(NEUTRAL_ENTITY_VISUAL)).toBe(true)
  })
})

describe('entityVisualFor', () => {
  it('returns the catalogued visual of a seed type', () => {
    expect(entityVisualFor('character')).toEqual({ silhouette: 'badge', texture: 'photoGrain' })
    expect(entityVisualFor('event')).toEqual({ silhouette: 'flag', texture: 'diagonalHatch' })
  })

  it('falls back to the neutral card for any type outside the catalog', () => {
    for (const typeId of ['customType', 'Character', '', 'constructor', '__proto__', 'toString']) {
      expect(entityVisualFor(typeId), typeId).toBe(NEUTRAL_ENTITY_VISUAL)
    }
  })
})

describe('legend names', () => {
  it('names every silhouette and texture once', () => {
    for (const labels of [SILHOUETTE_LABELS, TEXTURE_LABELS]) {
      const names = Object.values(labels)
      expect(names.every((name) => name.trim().length > 0)).toBe(true)
      expect(new Set(names).size).toBe(names.length)
    }
    expect(Object.keys(SILHOUETTE_LABELS).sort()).toEqual([...ENTITY_SILHOUETTES].sort())
    expect(Object.keys(TEXTURE_LABELS).sort()).toEqual([...ENTITY_TEXTURES].sort())
  })
})
