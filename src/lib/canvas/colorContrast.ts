/**
 * WCAG contrast arithmetic for canvas drawing, on 8-bit sRGB colours. Used to pick how strongly a
 * card texture is drawn (ADR-011): visible enough to read, never enough to hurt the card's text.
 */
export type Rgb = readonly [number, number, number]

/** WCAG 2 relative luminance of an sRGB colour. */
export function relativeLuminance([r, g, b]: Rgb) {
  const channel = (value: number) => {
    const v = value / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2 contrast ratio, from 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/** `over` drawn on `base` with opacity `alpha` (source-over). */
export const mixRgb = (base: Rgb, over: Rgb, alpha: number): Rgb =>
  [0, 1, 2].map((i) => base[i] + (over[i] - base[i]) * alpha) as unknown as Rgb

/** WCAG 1.4.3: normal text against its background. */
export const MIN_TEXT_CONTRAST = 4.5

/**
 * The opacity (0 to 1) for a texture drawn in `ink` over `card`, whose strongest texel has opacity
 * `peak` at full strength. The strongest texel should reach `target` contrast against the card, but
 * every text drawn on the card keeps at least 4.5:1 against it, or, for a text already below that on
 * the plain card, does not lose contrast at all.
 */
export function textureOpacity({ card, ink, texts, peak, target }: { card: Rgb; ink: Rgb; texts: readonly Rgb[]; peak: number; target: number }) {
  if (peak <= 0 || target <= 1) return 0
  const texel = (opacity: number) => mixRgb(card, ink, peak * opacity)
  const textOk = (opacity: number) => texts.every((text) => {
    const floor = Math.min(MIN_TEXT_CONTRAST, contrastRatio(text, card))
    return contrastRatio(text, texel(opacity)) >= floor - 1e-9
  })
  // Both checks change monotonically with the opacity, so a bisection finds each bound.
  const search = (ok: (opacity: number) => boolean) => {
    if (ok(1)) return 1
    let low = 0, high = 1
    for (let i = 0; i < 24; i++) { const mid = (low + high) / 2; if (ok(mid)) low = mid; else high = mid }
    return low
  }
  const visible = contrastRatio(texel(1), card) <= target ? 1 : (() => {
    let low = 0, high = 1
    for (let i = 0; i < 24; i++) { const mid = (low + high) / 2; if (contrastRatio(texel(mid), card) < target) low = mid; else high = mid }
    return high
  })()
  return Math.min(visible, search(textOk))
}
