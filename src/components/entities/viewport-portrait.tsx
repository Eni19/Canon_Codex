'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'

/** Measures the remaining viewport below the portrait, including a wrapping page toolbar. */
export function ViewportPortrait({ children, className }: { children: ReactNode; className: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    let frame = 0
    function measure() {
      if (!element) return
      const top = Math.max(0, element.getBoundingClientRect().top)
      element.style.setProperty('--portrait-viewport-height', `${Math.max(0, window.innerHeight - top)}px`)
    }
    function scheduleMeasure() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    measure()
    const observer = new ResizeObserver(scheduleMeasure)
    observer.observe(element)
    if (element.parentElement) observer.observe(element.parentElement)
    window.addEventListener('resize', scheduleMeasure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
      cancelAnimationFrame(frame)
    }
  }, [])

  return <div ref={ref} className={className}>{children}</div>
}
