'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'

const DURATION = 150
const EASING = 'cubic-bezier(0.2, 0, 0.38, 0.9)'
const MAX_ENTERING_CARDS = 8

export function timelineScrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
}

/** WikiShell scrolls its main region; embedded views may have a different scroll owner. */
export function timelineScrollContainer(element: HTMLElement | null): HTMLElement | null {
  for (let parent = element?.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent
  }
  return null
}

/** No retained copies of cards, timers, stagger, or animation of offscreen pages. */
export function useTimelineMotion(root: RefObject<HTMLElement | null>, context: string, revision: string) {
  const previous = useRef<{ context: string; ids: Set<string> } | null>(null)
  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    const cards = [...element.querySelectorAll<HTMLElement>('[data-appearance-id]')]
    const prior = previous.current
    previous.current = { context, ids: new Set(cards.map((card) => card.dataset.appearanceId!)) }
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (preference.matches || typeof element.animate !== 'function') return

    const animations: Animation[] = []
    if (prior && prior.context !== context) {
      // One fade for a changed selection, even when the page contains fifty cards.
      animations.push(element.animate([{ opacity: 0.65 }, { opacity: 1 }], { duration: 110, easing: EASING }))
    } else {
      const axis = element.querySelector<HTMLElement>('[data-timeline-axis]')?.getBoundingClientRect()
      let count = 0
      for (const card of cards) {
        if (count >= MAX_ENTERING_CARDS) break
        if (prior?.ids.has(card.dataset.appearanceId!)) continue
        const rect = card.getBoundingClientRect()
        if (rect.bottom <= Math.max(0, axis?.top ?? 0) || rect.top >= Math.min(window.innerHeight, axis?.bottom ?? window.innerHeight) || rect.right <= (axis?.left ?? 0) || rect.left >= (axis?.right ?? window.innerWidth)) continue
        animations.push(card.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: DURATION, easing: EASING }))
        count++
      }
    }
    const cancel = () => animations.forEach((animation) => animation.cancel())
    preference.addEventListener('change', cancel)
    return () => { cancel(); preference.removeEventListener('change', cancel) }
  }, [root, context, revision])
}

export async function animateTimelineRemoval(card: HTMLElement | null) {
  if (!card || window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof card.animate !== 'function') return
  const animation = card.animate([{ opacity: 1 }, { opacity: 0.35 }], { duration: 110, easing: EASING })
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const cancel = () => animation.cancel()
  preference.addEventListener('change', cancel)
  try { await animation.finished } catch { /* Preference changes and unmounts may cancel a fade. */ }
  finally { animation.cancel(); preference.removeEventListener('change', cancel) }
}
