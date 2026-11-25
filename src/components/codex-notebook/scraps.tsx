import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import { seededRandom } from './notebook-contents'
import styles from './notebook.module.css'

/**
 * Collage pieces for the notebook pages: tape, polaroids, torn notes, tickets, stamps, stickers,
 * clips, cut-out letters and hand-drawn marks. Pages are laid out on a fixed 600 × 820 sheet, so
 * every piece is placed with `x`, `y` (top-left, in sheet pixels) and an optional rotation.
 */
export interface Placement {
  x: number
  y: number
  /** Rotation in degrees. */
  r?: number
  w?: number
  z?: number
}

function place({ x, y, r = 0, w, z }: Placement, extra?: CSSProperties): CSSProperties {
  return { left: x, top: y, width: w, zIndex: z, transform: r ? `rotate(${r}deg)` : undefined, ...extra }
}

export type TapeColor = 'cream' | 'blue' | 'rose' | 'green'

export function Tape({ color = 'cream', length = 90, ...at }: Placement & { color?: TapeColor; length?: number }) {
  return <span aria-hidden className={styles.tape} data-color={color} style={place(at, { width: length })}/>
}

export function Polaroid({ src, caption, href, icon, date, ...at }: Placement & { src?: string; caption: string; href?: string; icon?: string; date?: string }) {
  const body = <>
    <span className={styles.polaroidPhoto}>
      {src
        // Asset thumbnails are served by our own route; next/image adds nothing for these.
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" decoding="async" draggable={false}/>
        : <span className={styles.polaroidSketch}>{icon && <EntityTypeIcon name={icon}/>}</span>}
    </span>
    <span className={styles.polaroidCaption}>{caption}</span>
    {date && <span className={styles.polaroidDate}>{date}</span>}
  </>
  return href
    ? <Link href={href} className={`${styles.piece} ${styles.polaroid} ${styles.interactive}`} style={place(at)}>{body}</Link>
    : <span className={`${styles.piece} ${styles.polaroid}`} style={place(at)}>{body}</span>
}

export function TornNote({ paper = 'grid', children, ...at }: Placement & { paper?: 'grid' | 'lined' | 'plain' | 'yellow'; children: ReactNode }) {
  return <div className={`${styles.piece} ${styles.tornNote}`} data-paper={paper} style={place(at)}>{children}</div>
}

export function Ticket({ title, lines, serial, href, ...at }: Placement & { title: string; lines: string[]; serial: string; href?: string }) {
  const body = <>
    <span className={styles.ticketSerial}>{serial}</span>
    <span className={styles.ticketBody}>
      <strong>{title}</strong>
      {lines.map((line) => <small key={line}>{line}</small>)}
    </span>
  </>
  return href
    ? <Link href={href} className={`${styles.piece} ${styles.ticket} ${styles.interactive}`} style={place(at)}>{body}</Link>
    : <span className={`${styles.piece} ${styles.ticket}`} style={place(at)}>{body}</span>
}

/** Round postmark with text set along its ring. */
export function Postmark({ text, center, ...at }: Placement & { text: string; center: string }) {
  const id = `postmark-${text.replace(/\W/g, '')}`
  return <svg aria-hidden className={`${styles.piece} ${styles.postmark}`} style={place(at)} viewBox="0 0 120 120">
    <defs><path id={id} d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0"/></defs>
    <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="2"/>
    <circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="1.2"/>
    <text fontSize="11" letterSpacing="2.5" fill="currentColor"><textPath href={`#${id}`}>{text}</textPath></text>
    <text x="60" y="66" textAnchor="middle" fontSize="16" fill="currentColor">{center}</text>
    {[0, 1, 2, 3].map((line) => <path key={line} d={`M118 ${44 + line * 10} q 18 -6 36 0 t 36 0`} stroke="currentColor" strokeWidth="1.4" fill="none"/>)}
  </svg>
}

export function StarSticker({ tone = 'brass', ...at }: Placement & { tone?: 'brass' | 'red' | 'paper' }) {
  return <span aria-hidden className={`${styles.piece} ${styles.star}`} data-tone={tone} style={place(at)}/>
}

export function Paperclip(at: Placement) {
  return <svg aria-hidden className={`${styles.piece} ${styles.paperclip}`} style={place(at)} viewBox="0 0 30 90">
    <path d="M10 22 V70 a8 8 0 0 0 16 0 V14 a11 11 0 0 0 -22 0 V64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
  </svg>
}

/** A hand-drawn arrow, for "look here" marks next to links. */
export function HandArrow({ flip, ...at }: Placement & { flip?: boolean }) {
  return <svg aria-hidden className={`${styles.piece} ${styles.handArrow}`} style={place(at, flip ? { scale: '-1 1' } : undefined)} viewBox="0 0 90 60">
    <path d="M4 50 C 24 54, 52 46, 72 16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
    <path d="M58 18 L 73 13 L 76 30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
}

/** A title made of letters cut from different magazines, each on its own scrap. */
export function CutoutTitle({ text, seed, size = 46, ...at }: Placement & { text: string; seed: string; size?: number }) {
  const next = seededRandom(seed)
  const words = text.split(' ')
  return <span aria-label={text} role="img" className={`${styles.piece} ${styles.cutout}`} style={place(at, { fontSize: size })}>
    {words.map((word, wordIndex) => <span key={wordIndex} className={styles.cutoutWord}>
      {[...word].map((letter, index) => <span
        key={index}
        aria-hidden
        className={styles.cutoutLetter}
        data-paper={Math.floor(next() * 5)}
        data-face={Math.floor(next() * 3)}
        style={{ transform: `rotate(${(next() - 0.5) * 12}deg) translateY(${(next() - 0.5) * 6}px)` }}
      >{letter}</span>)}
    </span>)}
  </span>
}

/** Handwritten text placed on the sheet. */
export function Handwriting({ children, size = 26, tone = 'ink', ...at }: Placement & { children: ReactNode; size?: number; tone?: 'ink' | 'soft' | 'red' }) {
  return <div className={`${styles.piece} ${styles.handwriting}`} data-tone={tone} style={place(at, { fontSize: size })}>{children}</div>
}

/** Typewritten label, like a strip of label tape. */
export function TypeLabel({ children, dark, ...at }: Placement & { children: ReactNode; dark?: boolean }) {
  return <span className={`${styles.piece} ${styles.typeLabel}`} data-dark={dark || undefined} style={place(at)}>{children}</span>
}

/** Coloured index tabs stuck to the page edge, as on a planner. */
export function StickyFlags(at: Placement) {
  return <span aria-hidden className={`${styles.piece} ${styles.stickyFlags}`} style={place(at)}>
    <span data-color="rose"/><span data-color="cream"/><span data-color="blue"/>
  </span>
}

/** A link written by hand, with a marker swipe behind it on hover. */
export function HandLink({ href, children, size = 26, ...at }: Placement & { href: string; children: ReactNode; size?: number }) {
  return <Link href={href} className={`${styles.piece} ${styles.handLink} ${styles.interactive}`} style={place(at, { fontSize: size })}>{children}</Link>
}
