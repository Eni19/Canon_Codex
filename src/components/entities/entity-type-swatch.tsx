'use client'

import { useEffect, useRef } from 'react'
import { traceSilhouette } from '@/domain/canvas/entitySilhouettes'
import { entityVisualFor, SILHOUETTE_LABELS, TEXTURE_LABELS } from '@/domain/entities/entityVisual'
import { getCardDisplay, subscribeCardDisplay } from '@/lib/canvas/cardDisplay'
import { readTextureTheme, texturePaint } from '@/lib/canvas/textureTheme'
import { EntityTypeIcon } from './entity-type-icon'

const WIDTH = 72, HEIGHT = 28

/** The card of a record type in miniature: its silhouette and texture, drawn like the canvases. */
export function EntityTypeSwatch({ typeId }: { typeId: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(WIDTH * dpr); canvas.height = Math.round(HEIGHT * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const style = getComputedStyle(canvas)
      const token = (name: string) => style.getPropertyValue('--' + name).trim()
      const card = token('surface-raised'), text = token('foreground')
      const display = getCardDisplay()
      const { silhouette, texture } = entityVisualFor(typeId)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, WIDTH, HEIGHT)
      const path = new Path2D()
      traceSilhouette(path, silhouette, 1.5, 1.5, WIDTH - 3, HEIGHT - 3)
      ctx.fillStyle = card; ctx.fill(path)
      const paint = display.textureScale > 0
        ? texturePaint(readTextureTheme({ card, background: token('background'), foreground: text, texts: [text] }), texture, ctx, dpr) : null
      if (paint) { ctx.globalAlpha = paint.opacity * display.textureScale; ctx.fillStyle = paint.pattern; ctx.fill(path); ctx.globalAlpha = 1 }
      ctx.strokeStyle = display.strongOutline ? text : token('muted-foreground')
      ctx.lineWidth = display.strongOutline ? 2 : 1
      ctx.stroke(path)
    }
    draw()
    const theme = new MutationObserver(draw)
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    const unsubscribe = subscribeCardDisplay(draw)
    return () => { theme.disconnect(); unsubscribe() }
  }, [typeId])
  return <canvas ref={ref} aria-hidden="true" style={{ width: WIDTH, height: HEIGHT }} className="shrink-0" />
}

/**
 * Legend of the record types on a canvas (WCAG G111): each type's card in miniature, its icon and
 * name, and the shape and texture in words, so the legend itself does not rely on sight of colour.
 */
export function EntityTypeLegend({ types }: { types: Array<{ id: string; label: string; icon: string }> }) {
  if (!types.length) return null
  return <section aria-labelledby="entity-type-legend" className="space-y-2">
    <h3 id="entity-type-legend" className="font-medium">Tipos de registro</h3>
    <ul className="space-y-1.5">
      {types.map((type) => {
        const { silhouette, texture } = entityVisualFor(type.id)
        return <li key={type.id} className="flex items-center gap-2.5">
          <EntityTypeSwatch typeId={type.id} />
          <EntityTypeIcon name={type.icon} className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block wrap-anywhere">{type.label}</span>
            <span className="block text-xs text-muted-foreground">{SILHOUETTE_LABELS[silhouette]} · {TEXTURE_LABELS[texture]}</span>
          </span>
        </li>
      })}
    </ul>
  </section>
}
