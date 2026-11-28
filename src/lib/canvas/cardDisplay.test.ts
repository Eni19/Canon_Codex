import { afterEach, describe, expect, it, vi } from 'vitest'
import { CARD_TEXTURE_STORAGE_KEY, cardDisplayFor, getCardDisplay, readCardTextureSetting, subscribeCardDisplay, writeCardTextureSetting } from './cardDisplay'

const plain = { moreContrast: false, forcedColors: false }

describe('cardDisplayFor', () => {
  it('scales textures by the chosen strength', () => {
    expect(cardDisplayFor('normal', plain)).toEqual({ textureScale: 1, strongOutline: false })
    expect(cardDisplayFor('subtle', plain)).toEqual({ textureScale: 0.5, strongOutline: false })
    expect(cardDisplayFor('off', plain)).toEqual({ textureScale: 0, strongOutline: false })
  })

  it('drops textures and strengthens outlines in high-contrast modes, whatever the setting', () => {
    for (const system of [{ moreContrast: true, forcedColors: false }, { moreContrast: false, forcedColors: true }]) {
      expect(cardDisplayFor('normal', system)).toEqual({ textureScale: 0, strongOutline: true })
    }
  })
})

describe('card texture setting', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('reads normal without storage, or with an unknown or unreadable value', () => {
    expect(readCardTextureSetting()).toBe('normal')
    vi.stubGlobal('localStorage', { getItem: () => 'loud' })
    expect(readCardTextureSetting()).toBe('normal')
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') } })
    expect(readCardTextureSetting()).toBe('normal')
  })

  it('saves the setting and tells subscribers', () => {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) })
    const listener = vi.fn()
    const unsubscribe = subscribeCardDisplay(listener)
    writeCardTextureSetting('subtle')
    expect(stored.get(CARD_TEXTURE_STORAGE_KEY)).toBe('subtle')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getCardDisplay().textureScale).toBe(0.5)
    unsubscribe()
    writeCardTextureSetting('normal')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps working when storage refuses to save', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('quota') } })
    writeCardTextureSetting('off')
    expect(getCardDisplay().textureScale).toBe(0)
    writeCardTextureSetting('normal')
  })
})
