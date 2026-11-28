import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BookOpen } from 'lucide-react'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import { Badge } from '@/components/ui/badge'
import type { Entity } from '@/domain/entities/entity'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import { assetVariantUrl } from '@/lib/assetUrl'
import { cn } from '@/lib/utils'
import styles from './entity-card.module.css'

/**
 * Types whose pictures are full figures (portraits of characters, creatures): the card is taller and
 * shows the whole picture instead of cropping it, so the body is not cut off.
 */
const FULL_FIGURE_TYPES = new Set(['character', 'creature'])

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function EntityCard({
  entity,
  entityType,
  showTypeLabel = false,
  contextLabel,
  variant,
}: {
  entity: Entity
  entityType: EntityTypeDefinition
  showTypeLabel?: boolean
  contextLabel?: string
  variant?: 'portrait'
}) {
  if (entityType.id === 'concept') {
    const summary = text(entity.properties.summary)
    const category = text(entity.properties.category)
    return <Link href={`/entity/${entity.id}`} className={styles.conceptCard}>
      <header><span><BookOpen />CONCEITO</span>{category && <em>{category}</em>}</header>
      <h3>{entity.title}</h3>
      {summary && <p>{summary}</p>}
      <footer><span>{entity.status || entity.tags.slice(0, 2).join(' · ') || 'Referência'}</span><ArrowRight /></footer>
    </Link>
  }

  const fullFigure = FULL_FIGURE_TYPES.has(entityType.id)
  const Title = variant === 'portrait' ? 'h4' : 'h3'
  const tall = entityType.id === 'tale' || fullFigure
  const picture = entity.coverAssetId ? assetVariantUrl(entity.coverAssetId, entityType.id === 'tale' ? 'original' : 'thumbnail') : null

  return (
    <Link
      href={`/entity/${entity.id}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-sm border border-border bg-surface transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none',
        variant === 'portrait' && styles.albumPortrait,
      )}
    >
      <div className={`relative w-full shrink-0 overflow-hidden bg-muted ${tall ? 'aspect-3/4' : 'aspect-4/3'}`}>
        {picture && fullFigure ? (
          <>
            {/* The same picture, blurred and dimmed, fills the space the whole figure leaves free. */}
            <Image src={picture} alt="" fill sizes="(max-width: 640px) 50vw, 240px" className="scale-110 object-cover opacity-45 blur-xl" unoptimized aria-hidden/>
            <Image src={picture} alt="" fill sizes="(max-width: 640px) 50vw, 240px" className="object-contain" unoptimized/>
          </>
        ) : picture ? (
          <Image
            src={picture}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, 240px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <EntityTypeIcon name={entityType.icon} className="size-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {showTypeLabel && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <EntityTypeIcon name={entityType.icon} className="size-3.5" />
            <span>{entityType.label}</span>
          </div>
        )}
        {contextLabel && <span data-context-label className="truncate text-[0.6rem] tracking-wide text-primary uppercase">{contextLabel}</span>}
        <Title className="font-serif text-base leading-snug font-medium text-balance [overflow-wrap:anywhere]">{entity.title}</Title>
        {entity.tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-1">
            {entity.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>)}
          </div>
        )}
      </div>
    </Link>
  )
}
