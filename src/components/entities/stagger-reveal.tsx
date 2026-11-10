'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { animate, stagger } from 'animejs'

/**
 * Plays one entrance for every `[data-reveal-item]` inside, in the order given by the attribute's
 * value (ties keep document order): a short rise with an exponential ease-out. Runs before paint so
 * nothing flashes; leaves no inline styles behind; skipped under reduced motion or when disabled.
 */
export function StaggerReveal({ children, className, enabled = true }: { children: ReactNode; className?: string; enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-reveal-item]') ?? [])
      .map((element, index) => ({ element, index, order: Number(element.dataset.revealItem) || 0 }))
      .sort((a, b) => a.order - b.order || a.index - b.index)
      .map(({ element }) => element)
    if (items.length === 0) return
    for (const item of items) item.style.opacity = '0'
    const animation = animate(items, {
      opacity: { from: 0, to: 1, duration: 380, ease: 'outQuad' },
      translateY: { from: 8, to: 0, duration: 620, ease: 'outExpo' },
      delay: stagger(45, { start: 80 }),
      // An inline transform would trap fixed-position popovers inside these sections.
      onComplete: () => items.forEach((item) => { item.style.removeProperty('transform'); item.style.removeProperty('opacity') }),
    })
    return () => { animation.revert() }
  }, [enabled])

  return <div ref={ref} className={className}>{children}</div>
}
