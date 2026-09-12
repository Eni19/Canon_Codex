import Image from 'next/image'
import Link from 'next/link'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import { Badge } from '@/components/ui/badge'
import type { Entity } from '@/domain/entities/entity'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import { assetVariantUrl } from '@/lib/assetUrl'

export function EntityCard({
  entity,
  entityType,
  showTypeLabel = false,
  contextLabel,
}: {
  entity: Entity
  entityType: EntityTypeDefinition
  showTypeLabel?: boolean
  contextLabel?: string
}) {
  return (
    <Link
      href={`/entity/${entity.id}`}
      className="group flex flex-col overflow-hidden rounded-sm border border-border bg-surface transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="relative aspect-4/3 w-full shrink-0 bg-muted">
        {entity.coverAssetId ? (
          <Image
            src={assetVariantUrl(entity.coverAssetId, 'thumbnail')}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, 240px"
            className="object-cover"
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
        {contextLabel && <span className="truncate text-[0.6rem] tracking-wide text-primary uppercase">{contextLabel}</span>}
        <h3 className="font-serif text-base leading-snug font-medium text-balance">{entity.title}</h3>
        {entity.tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-1">
            {entity.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
