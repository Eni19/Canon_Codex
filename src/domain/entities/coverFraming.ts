import { z } from 'zod'

/**
 * How a cover image sits in its frame, stored at `properties.coverFraming`. `x`/`y` move the
 * image by a percentage of the frame's own width/height; `scale` zooms from the point each page
 * anchors its image (its CSS `transform-origin`: top center for characters, bottom right or
 * center for creatures). Each type's default reproduces its original fixed presentation.
 */
export const CoverFramingSchema = z.object({
  x: z.number().min(-100).max(100),
  y: z.number().min(-100).max(100),
  scale: z.number().min(0.5).max(3),
})
export type CoverFraming = z.infer<typeof CoverFramingSchema>

/** Character portraits: top-anchored with a 1.4× zoom, the original fixed presentation. */
export const DEFAULT_COVER_FRAMING: CoverFraming = { x: 0, y: 0, scale: 1.4 }
/** Creatures show the whole image (object-fit: contain), so their default is no zoom. */
const UNSCALED_COVER_FRAMING: CoverFraming = { x: 0, y: 0, scale: 1 }

export const COVER_FRAMING_LIMITS = { offset: 100, minScale: 0.5, maxScale: 3 } as const

export function defaultCoverFraming(type: { id: string }): CoverFraming {
  return type.id === 'creature' ? UNSCALED_COVER_FRAMING : DEFAULT_COVER_FRAMING
}

export function readCoverFraming(value: unknown, fallback: CoverFraming = DEFAULT_COVER_FRAMING): CoverFraming {
  const parsed = CoverFramingSchema.safeParse(value)
  return parsed.success ? parsed.data : fallback
}

export function isDefaultCoverFraming(framing: CoverFraming, fallback: CoverFraming = DEFAULT_COVER_FRAMING): boolean {
  return framing.x === fallback.x && framing.y === fallback.y && framing.scale === fallback.scale
}

/** CSS transform for the image; translate is unscaled, then the zoom grows from the CSS origin. */
export function coverFramingTransform(framing: CoverFraming): string {
  return `translate(${framing.x}%, ${framing.y}%) scale(${framing.scale})`
}
