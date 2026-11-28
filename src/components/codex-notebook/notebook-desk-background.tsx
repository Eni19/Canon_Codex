'use client'

import dynamic from 'next/dynamic'
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { readNotebookPalette, type NotebookPalette } from './book-textures'

const OpenDeskScene = dynamic(() => import('./book-scene').then(module => module.OpenDeskScene), { ssr: false })

export function NotebookDeskStage({ className, backgroundClass, overlayClass, fitOverlay = true, children }: {
  className: string
  backgroundClass: string
  overlayClass: string
  fitOverlay?: boolean
  children: ReactNode
}) {
  const host = useRef<HTMLDivElement>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const [palette, setPalette] = useState<NotebookPalette | null>(null)
  const background = useCallback((element: HTMLDivElement | null) => {
    if (element) setPalette(readNotebookPalette(element))
  }, [])

  useLayoutEffect(() => {
    if (!fitOverlay) return
    const stage = host.current
    const content = overlay.current
    if (!stage || !content) return
    const fit = () => {
      const scale = Math.min(stage.clientWidth / content.offsetWidth, stage.clientHeight / content.offsetHeight)
      content.style.setProperty('--desk-scale', String(scale))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [fitOverlay])

  return <div ref={host} className={className}>
    <div aria-hidden="true" className={backgroundClass} ref={background}>
      {palette && <OpenDeskScene palette={palette}/>}
    </div>
    <div ref={overlay} className={overlayClass}>{children}</div>
  </div>
}
