import Link from 'next/link'
import type { ReactNode } from 'react'
import type { PortraitAttribute } from '@/components/entities/portrait-attributes'
import { StaggerReveal } from '@/components/entities/stagger-reveal'
import { ViewportPortrait } from '@/components/entities/viewport-portrait'
import { Badge } from '@/components/ui/badge'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import { formatDateFieldValue } from '@/domain/worlds/calendar-date'
import type { Calendar } from '@/domain/worlds/calendar'
import styles from './portrait-entity-page.module.css'

/**
 * The character page's composition, shared by the real page and the framing preview in the
 * editor so the preview is the page itself, not an imitation. Callers fill the slots.
 * Text blocks enter in reading order (name, summary, attributes, story, side sections); the
 * portrait itself does not move. `reveal={false}` turns that off (the framing preview).
 */
export function PortraitComposition({
  title,
  status,
  tags,
  summary,
  details,
  portrait,
  content,
  reveal = true,
}: {
  reveal?: boolean
  title: string
  status?: string
  tags: string[]
  summary: PortraitSummaryItem[]
  details: ReactNode
  portrait: ReactNode
  content: ReactNode
}) {
  return (
    <StaggerReveal className={styles.composition} enabled={reveal}>
      <div aria-hidden="true" className={styles.rule} />
      {/* The two header groups share a baseline; the portrait paints over the rule. */}
      <div className={styles.identity}>
        <h1 data-reveal-item={0} className={`font-serif font-medium text-primary uppercase ${styles.name}`}>{title}</h1>
      </div>
      <div className={styles.metadata}>
        {(status || tags.length > 0) && (
          <div data-reveal-item={1} className={styles.badges}>
            {status && <Badge variant="outline">{status}</Badge>}
            {tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
          </div>
        )}
      </div>
      <div className={styles.details}>{details}</div>

      <ViewportPortrait className={styles.portrait}>{portrait}</ViewportPortrait>

      <dl className={styles.summary}>
        {summary.map((item) => (
          <div key={item.key} data-reveal-item={1} className="min-w-0 max-w-full">
            <dt className="mb-1 text-xs tracking-wider text-muted-foreground uppercase">{item.label}</dt>
            <dd className={`font-serif break-words ${item.emphasized ? 'bg-primary px-2 py-1 font-semibold text-primary-foreground uppercase' : 'py-1'}`}>
              {item.href ? <Link href={item.href} className="text-primary hover:underline">{item.text}</Link> : item.text}
            </dd>
          </div>
        ))}
      </dl>
      <div className={styles.content}>{content}</div>
    </StaggerReveal>
  )
}

export interface PortraitSummaryItem {
  key: string
  label: string
  text: string
  href?: string
  emphasized?: boolean
}

const SUMMARY_KEYS = ['occupation', 'affiliation']

/** Header facts shown beside the portrait; works from stored properties or live form values. */
export function portraitSummary(entityType: EntityTypeDefinition, properties: Record<string, unknown>, calendar: Calendar, titleById: Record<string, string>): PortraitSummaryItem[] {
  return SUMMARY_KEYS.flatMap((key) => entityType.properties.filter((property) => property.key === key)).map((property) => {
    const value = properties[property.key]
    const raw = property.kind === 'date' ? formatDateFieldValue(calendar, value) : typeof value === 'string' ? value.trim() : ''
    const isReference = property.kind === 'reference' && Boolean(raw)
    return {
      key: property.key,
      label: property.label,
      text: isReference ? titleById[raw] ?? 'Referência indisponível' : raw || '—',
      href: isReference && titleById[raw] ? `/entity/${raw}` : undefined,
      emphasized: property.key === 'occupation',
    }
  })
}

/** Attribute rows (aliases, age, species) from stored properties or live form values. */
export function portraitAttributes(entityType: EntityTypeDefinition, aliases: string[], properties: Record<string, unknown>, titleById: Record<string, string>): PortraitAttribute[] {
  return [
    { key: 'aliases', label: 'Apelidos', value: aliases.join(', ') || '—' },
    ...['age', 'species'].flatMap((key) => {
      const property = entityType.properties.find((candidate) => candidate.key === key)
      if (!property) return []
      const raw = properties[key]
      const value = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : ''
      const isReference = property.kind === 'reference' && Boolean(value)
      return [{
        key,
        label: property.label,
        value: isReference ? titleById[value] ?? 'Referência indisponível' : value || '—',
        href: isReference && titleById[value] ? `/entity/${value}` : undefined,
      }]
    }),
  ]
}

/** `revealOrder` places the section in the page's entrance sequence (see PortraitComposition). */
export function PortraitSection({ title, children, revealOrder = 4 }: { title: string; children: ReactNode; revealOrder?: number }) {
  return (
    <div data-reveal-item={revealOrder}>
      <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </div>
  )
}
