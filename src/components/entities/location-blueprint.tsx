'use client'

import Image from 'next/image'
import Link from 'next/link'
import { animate } from 'animejs'
import { Maximize2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { LocationPoint } from '@/domain/entities/locationPoint'
import { assetVariantUrl } from '@/lib/assetUrl'
import styles from './location-blueprint.module.css'

export function LocationBlueprint({ coverAssetId, points, titleById }: { coverAssetId?: string; points: LocationPoint[]; titleById: Record<string, string> }) {
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(points[0]?.id ?? null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const active = points.find((point) => point.id === activeId)

  const closeViewer = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) { setOpen(false); return }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    animate(viewer, {
      opacity: 0,
      scale: 0.82,
      rotate: '-3deg',
      duration: reduced ? 0 : 300,
      ease: 'inCubic',
      onComplete: () => setOpen(false),
    })
  }, [])

  useEffect(() => {
    if (!open || !viewerRef.current) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const animation = animate(viewerRef.current, { opacity: [0, 1], scale: [0.82, 1], rotate: ['3deg', '0deg'], duration: reduced ? 0 : 480, ease: 'outExpo' })
    return () => { animation.cancel() }
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') closeViewer() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open, closeViewer])

  const board = (expanded: boolean) => (
    <div className={`${styles.board} ${expanded ? styles.viewerBoard : ''}`} onClick={() => { if (!expanded) setOpen(true) }}>
      {coverAssetId ? <Image src={assetVariantUrl(coverAssetId, 'original')} alt="" fill sizes={expanded ? '88vw' : '(min-width: 1024px) 46vw, 100vw'} className={styles.image} priority /> : <div className="grid h-full place-items-center px-8 text-center font-serif text-primary">IMPORTE UMA IMAGEM DO LOCAL PARA INICIAR A PRANCHA</div>}
      {points.map((point, index) => <button key={point.id} type="button" className={styles.pin} style={{ left: `${point.x}%`, top: `${point.y}%` }} onClick={(event) => { event.stopPropagation(); setActiveId(point.id); if (!expanded) setOpen(true) }} aria-label={point.label}>{index + 1}</button>)}
      {!expanded && <span className="absolute right-3 bottom-3 z-4 flex items-center gap-1 bg-background/80 px-2 py-1 text-xs text-primary"><Maximize2 className="size-3" />Abrir prancha</span>}
    </div>
  )

  return (
    <>
      <div>{board(false)}</div>
      {open && <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Prancha do local" onMouseDown={(event) => { if (event.target === event.currentTarget) closeViewer() }}>
        <Button type="button" variant="outline" size="icon" className={styles.close} onClick={closeViewer} aria-label="Fechar prancha"><X className="size-5" /></Button>
        <div ref={viewerRef} className={styles.viewer}>
          {board(true)}
          {active && <article className={styles.legend}>
            <header className={styles.pointHeader}>
              <p className="font-serif text-lg font-semibold uppercase text-primary">{active.label}</p>
              <p className="mt-1 text-sm text-foreground/85">{active.basicDescription ?? active.description ?? 'Sem apresentação.'}</p>
              {active.targetId && <Link href={`/entity/${active.targetId}`} className="mt-2 inline-block text-xs text-primary underline underline-offset-4">Abrir {titleById[active.targetId] ?? 'registro vinculado'}</Link>}
            </header>
            {active.discoveries.length > 0 && <table className={styles.pointTable}>
              <thead><tr><th>Abordagem</th><th>Condição</th><th>Informação</th></tr></thead>
              <tbody>{active.discoveries.map((discovery) => <tr key={discovery.id}><td>{discovery.approach || 'Livre'}</td><td>{discovery.condition || '—'}</td><td>{discovery.information || '—'}</td></tr>)}</tbody>
            </table>}
            {active.contextualDescription && <div className={styles.pointContext}><strong className="text-primary">Notas contextuais</strong><p className="mt-1">{active.contextualDescription}</p></div>}
          </article>}
        </div>
      </div>}
    </>
  )
}
