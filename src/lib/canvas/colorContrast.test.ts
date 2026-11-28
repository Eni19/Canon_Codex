import { describe, expect, it } from 'vitest'
import { contrastRatio, mixRgb, textureOpacity, type Rgb } from './colorContrast'

const white: Rgb = [255, 255, 255], black: Rgb = [0, 0, 0]

describe('contrastRatio', () => {
  it('follows WCAG 2', () => {
    expect(contrastRatio(white, black)).toBeCloseTo(21, 5)
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5)
    expect(contrastRatio([118, 118, 118], white)).toBeCloseTo(4.54, 2)
    expect(contrastRatio(white, white)).toBe(1)
  })
})

describe('textureOpacity', () => {
  it('stops where the strongest texel reaches the target contrast', () => {
    const card: Rgb = [40, 38, 35], ink: Rgb = [10, 10, 10]
    const opacity = textureOpacity({ card, ink, texts: [[235, 233, 228]], peak: 0.9, target: 1.15 })
    expect(opacity).toBeGreaterThan(0)
    expect(opacity).toBeLessThan(1)
    expect(contrastRatio(mixRgb(card, ink, 0.9 * opacity), card)).toBeCloseTo(1.15, 3)
  })

  it('never takes a text below 4.5:1', () => {
    const text: Rgb = [112, 112, 112]
    expect(contrastRatio(text, white)).toBeGreaterThan(4.5)
    const opacity = textureOpacity({ card: white, ink: [20, 20, 20], texts: [[20, 20, 20], text], peak: 1, target: 2 })
    expect(contrastRatio(text, mixRgb(white, [20, 20, 20], opacity))).toBeGreaterThanOrEqual(4.5 - 1e-6)
    expect(contrastRatio(mixRgb(white, [20, 20, 20], opacity), white)).toBeLessThan(2)
  })

  it('does not lower a text that is already below 4.5:1 on the plain card', () => {
    const card: Rgb = [70, 70, 70], text: Rgb = [140, 140, 140]
    expect(contrastRatio(text, card)).toBeLessThan(4.5)
    // A lighter ink would move texels towards the text.
    const opacity = textureOpacity({ card, ink: [200, 200, 200], texts: [text], peak: 1, target: 1.3 })
    expect(contrastRatio(text, mixRgb(card, [200, 200, 200], opacity))).toBeGreaterThanOrEqual(contrastRatio(text, card) - 1e-6)
  })

  it('is full strength when even the full tile stays under the target, and zero without texels', () => {
    expect(textureOpacity({ card: white, ink: [250, 250, 250], texts: [black], peak: 1, target: 1.5 })).toBe(1)
    expect(textureOpacity({ card: white, ink: black, texts: [black], peak: 0, target: 1.5 })).toBe(0)
  })
})
