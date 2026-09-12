'use client'

import Link from 'next/link'
import { animate, stagger } from 'animejs'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import styles from './portrait-entity-page.module.css'

export interface PortraitAttribute {
  key: string
  label: string
  value: string
  href?: string
}

export function PortraitAttributes({ children, attributes }: { children: ReactNode; attributes: PortraitAttribute[] }) {
  const id = useId()
  const panelRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pinned = useRef(false)
  const focused = useRef(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const panel = panelRef.current
    if (!panel || (!open && panel.style.visibility !== 'visible')) return
    const items = Array.from(panel.querySelectorAll<HTMLElement>('[data-attribute-item]'))
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let cancelled = false
    panel.style.visibility = 'visible'
    // Keep current values when interrupted, allowing a smooth reversal during rapid hovering.
    const animation = animate(open ? items : [...items].reverse(), {
      opacity: open ? 1 : 0,
      translateX: reducedMotion || open ? 0 : 18,
      duration: reducedMotion ? 0 : open ? 380 : 180,
      delay: reducedMotion ? 0 : stagger(open ? 55 : 20),
      ease: open ? 'outCubic' : 'inOutQuad',
      onComplete: () => {
        if (!cancelled && !open) panel.style.visibility = 'hidden'
      },
    })
    return () => { cancelled = true; animation.cancel() }
  }, [open])

  return (
    <div
      className={styles.attributeGroup}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') setOpen(true) }}
      onPointerLeave={() => { if (!pinned.current && !focused.current) setOpen(false) }}
      onFocusCapture={() => { focused.current = true; setOpen(true) }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          focused.current = false
          pinned.current = false
          setOpen(false)
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          triggerRef.current?.focus()
          pinned.current = false
          setOpen(false)
        }
      }}
    >
      {children}
      <button
        ref={triggerRef}
        type="button"
        aria-label="Mostrar atributos do personagem"
        aria-expanded={open}
        aria-controls={id}
        className={styles.attributeTrigger}
        onClick={() => { pinned.current = !pinned.current; setOpen(pinned.current) }}
      >
        <span className={styles.attributeHint}>Atributos</span>
      </button>
      <section ref={panelRef} id={id} aria-label="Atributos do personagem" aria-hidden={!open} inert={!open} data-open={open} className={styles.attributePanel}>
        <h2 data-attribute-item className={styles.attributeTitle}>Atributos</h2>
        <dl className={styles.attributeList}>
          {attributes.map((attribute) => (
            <div key={attribute.key} data-attribute-item className={styles.attributeRow}>
              <dt>{attribute.label}</dt>
              <dd>
                {attribute.href ? (
                  <Link href={attribute.href} className={styles.attributeValue}>{attribute.value}</Link>
                ) : (
                  <span className={attribute.value.length <= 3 ? styles.attributeDiamond : styles.attributeValue}>{attribute.value}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
