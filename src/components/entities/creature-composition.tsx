import Image from 'next/image'
import Link from 'next/link'
import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { PawPrint } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { assetVariantUrl } from '@/lib/assetUrl'
import { coverFramingTransform, type CoverFraming } from '@/domain/entities/coverFraming'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import { formatDateFieldValue } from '@/domain/worlds/calendar-date'
import type { Calendar } from '@/domain/worlds/calendar'
import styles from './creature-entity-page.module.css'

/**
 * The creature page's layout, shared by the real page and the framing preview in the editor
 * (same idea as PortraitComposition), so the preview is the page itself.
 */
export function CreatureComposition({ breadcrumbs, action, title, status, tags, properties, sections, visual }: {
  breadcrumbs: ReactNode
  action: ReactNode
  title: string
  status?: string
  tags: string[]
  properties: CreatureProperty[]
  sections: ReactNode
  visual: ReactNode
}) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>{breadcrumbs}
          <div className={styles.identity}><PawPrint className="size-5 text-primary" /><div><span className={styles.eyebrow}>REGISTRO DE CRIATURA</span><h1>{title}</h1></div></div>
          {(status || tags.length > 0) && <div className={styles.badges}>{status && <Badge variant="outline">{status}</Badge>}{tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div>}
        </div>
        {action}
      </header>

      <div className={styles.composition}>
        <section className={styles.information}>
          <dl className={styles.properties}>{properties.map((property) => <div key={property.key}><dt>{property.label}</dt><dd>{property.href ? <Link href={property.href}>{property.text}</Link> : property.text}</dd></div>)}</dl>
          <div className={styles.localScroll} tabIndex={0} aria-label="Conteúdo da criatura">{sections}</div>
        </section>
        {visual}
      </div>
    </main>
  )
}

export interface CreatureProperty { key: string; label: string; text: string; href?: string }

const PROPERTY_KEYS = ['creatureKind', 'classification', 'dangerLevel', 'habitat']

/** Sheet facts beside the content; works from stored properties or live form values. */
export function creatureProperties(entityType: EntityTypeDefinition, values: Record<string, unknown>, calendar: Calendar, titleById: Record<string, string>): CreatureProperty[] {
  return PROPERTY_KEYS.flatMap((key) => entityType.properties.filter((property) => property.key === key)).map((property) => {
    const raw = values[property.key]
    const text = property.kind === 'date' ? formatDateFieldValue(calendar, raw) : typeof raw === 'string' ? raw.trim() : ''
    const isReference = property.kind === 'reference' && Boolean(text)
    return {
      key: property.key,
      label: property.label,
      text: isReference ? titleById[text] ?? 'Referência indisponível' : text || '—',
      href: isReference && titleById[text] ? `/entity/${text}` : undefined,
    }
  })
}

export type CreaturePresentation = 'Retrato' | 'Contorno'
export const creaturePresentation = (value: unknown): CreaturePresentation => value === 'Retrato' ? 'Retrato' : 'Contorno'

/**
 * The creature image: a glowing silhouette anchored bottom-right, or a framed photograph.
 * `framing` moves/zooms it from that anchor; `interaction` lets the editor's preview make it
 * draggable without the page knowing about editing.
 */
export function CreatureVisual({ title, coverAssetId, presentation, framing, interaction }: {
  title: string
  coverAssetId?: string
  presentation: CreaturePresentation
  framing: CoverFraming
  interaction?: HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }
}) {
  const { className: interactionClass, ...interactionProps } = interaction ?? {}
  return (
    <aside
      {...interactionProps}
      className={`${styles.visual} ${presentation === 'Retrato' ? styles.portrait : styles.silhouette} ${interactionClass ?? ''}`}
      aria-label={interaction?.['aria-label'] ?? `Imagem da criatura em formato de ${presentation.toLowerCase()}`}
    >
      {presentation === 'Contorno' && <div className={styles.glow} aria-hidden="true" />}
      <div className={styles.imageFrame}>
        {coverAssetId
          ? <Image src={assetVariantUrl(coverAssetId, 'original')} alt="" fill sizes="(min-width: 900px) 48vw, 100vw" quality={90} className={styles.image} style={{ transform: coverFramingTransform(framing) }} data-framing-target draggable={false} priority />
          : <div className={styles.fallback}><PawPrint className="size-20" /><span>Imagem não registrada</span></div>}
      </div>
      {presentation === 'Retrato' && <div className={styles.photoCaption}><span>ARQUIVO FOTOGRÁFICO</span><b>{title}</b></div>}
    </aside>
  )
}

export function CreatureSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.section}><h2><span />{title}</h2>{children}</section>
}
