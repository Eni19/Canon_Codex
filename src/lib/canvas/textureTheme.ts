import type { TextureId } from '@/domain/entities/entityVisual'
import { textureOpacity, type Rgb } from './colorContrast'
import { entityTexturePatterns } from './entityTextures'

/**
 * How card textures (ADR-011) are drawn on the current theme, shared by the relationship graph and
 * the boards. The ink is the darker of the page's background and text colours, so a texture always
 * darkens the card; each texture's opacity comes from `textureOpacity`, so no text on the card drops
 * below 4.5:1.
 */
export type TextureTheme = {
  readonly ink: string
  readonly inkRgb: Rgb
  readonly cardRgb: Rgb
  readonly textRgbs: readonly Rgb[]
  readonly opacity: Map<TextureId, number>
}

/** Contrast between the strongest texel of a texture and the plain card. */
export const TEXTURE_TARGET_CONTRAST = 1.2

/** A CSS colour as 8-bit sRGB, read back from a 1×1 canvas so any colour syntax works. */
export function cssColorToRgb(color: string, probe: CanvasRenderingContext2D | null): Rgb {
  if (!probe) return [0, 0, 0]
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = '#000'; probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

const brightness = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** Reads the colours a texture depends on; call again when the theme changes. */
export function readTextureTheme({ card, background, foreground, texts }: { card: string; background: string; foreground: string; texts: readonly string[] }): TextureTheme {
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const backgroundRgb = cssColorToRgb(background, probe), foregroundRgb = cssColorToRgb(foreground, probe)
  const darkBackground = brightness(backgroundRgb) < brightness(foregroundRgb)
  return {
    ink: darkBackground ? background : foreground,
    inkRgb: darkBackground ? backgroundRgb : foregroundRgb,
    cardRgb: cssColorToRgb(card, probe),
    textRgbs: texts.map((text) => cssColorToRgb(text, probe)),
    opacity: new Map(),
  }
}

/** The pattern of `texture` and the opacity to draw it with on `theme`, or null for none. */
export function texturePaint(theme: TextureTheme, texture: TextureId, target: CanvasRenderingContext2D, dpr: number) {
  const tile = entityTexturePatterns.get(target, texture, theme.ink, dpr)
  if (!tile) return null
  let opacity = theme.opacity.get(texture)
  if (opacity === undefined) {
    opacity = textureOpacity({ card: theme.cardRgb, ink: theme.inkRgb, texts: theme.textRgbs, peak: tile.peak, target: TEXTURE_TARGET_CONTRAST })
    theme.opacity.set(texture, opacity)
  }
  return opacity > 0 ? { pattern: tile.pattern, opacity } : null
}
