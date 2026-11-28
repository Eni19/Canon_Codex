import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { entityTypeIconComponent } from './entity-type-icon'

/**
 * The Lucide icon of a record type as a small bitmap a canvas can draw (graph and boards, ADR-011).
 * Each icon is rasterized once per colour: drawing the SVG image on every card of a large board
 * cost more than the rest of the card.
 */
const SIZE = 64
const MAX_BITMAPS = 64
const bitmaps = new Map<string, HTMLCanvasElement>()
const pending = new Map<string, Set<() => void>>()

/** The bitmap, or null while it loads; `onReady` runs once it can be drawn. */
export function typeIconBitmap(name: string, color: string, onReady: () => void): HTMLCanvasElement | null {
  const key = name + '|' + color
  const bitmap = bitmaps.get(key)
  if (bitmap) return bitmap
  let waiting = pending.get(key)
  if (waiting) { waiting.add(onReady); return null }
  waiting = new Set([onReady])
  pending.set(key, waiting)
  const svg = renderToStaticMarkup(createElement(entityTypeIconComponent(name))).replaceAll('currentColor', color)
  const image = new Image()
  image.onload = () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE })
    canvas.getContext('2d')?.drawImage(image, 0, 0, SIZE, SIZE)
    if (bitmaps.size >= MAX_BITMAPS) bitmaps.clear()
    bitmaps.set(key, canvas)
    const callbacks = pending.get(key)
    pending.delete(key)
    callbacks?.forEach((callback) => callback())
  }
  image.onerror = () => { pending.delete(key) }
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return null
}
