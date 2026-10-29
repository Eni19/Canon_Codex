import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { BacklinksPanel } from './backlinks-panel'
import { CreatureComposition, CreatureSection, CreatureVisual, creaturePresentation, creatureProperties } from './creature-composition'
import { Gallery } from './gallery'
import { PageScrollLock } from './page-scroll-lock'
import { RelationsPanel } from './relations-panel'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { defaultCoverFraming, readCoverFraming } from '@/domain/entities/coverFraming'
import type { EntityPageProps } from './entity-page'
import styles from './creature-entity-page.module.css'

export function CreatureEntityPage({ entity, entityType, worldName, content, entityTitleById, backlinks, relationTargetOptions, calendar }: EntityPageProps) {
  return <div data-character-theme={entity.theme ?? 'amber'} className={styles.shell}>
    <PageScrollLock />
    <CreatureComposition
      breadcrumbs={<Breadcrumbs items={[{ label: worldName, href: '/codex' }, { label: entityType.pluralLabel, href: `/${entityType.id}` }, { label: entity.title }]} />}
      action={<Button asChild variant="outline" size="sm"><Link replace href={`/entity/${entity.id}/edit`}><Pencil className="size-4" />Editar</Link></Button>}
      title={entity.title}
      status={entity.status}
      tags={entity.tags}
      properties={creatureProperties(entityType, entity.properties, calendar, entityTitleById)}
      sections={<>
        <CreatureSection title="Registro"><ContentRenderer content={content} /></CreatureSection>
        {entity.galleryAssetIds?.length ? <CreatureSection title="Galeria"><Gallery assetIds={entity.galleryAssetIds} /></CreatureSection> : null}
        <CreatureSection title="Relacionado"><RelationsPanel entityId={entity.id} relations={entity.relations} entityTitleById={entityTitleById} targetOptions={relationTargetOptions} /></CreatureSection>
        <CreatureSection title="Backlinks"><BacklinksPanel backlinks={backlinks} /></CreatureSection>
      </>}
      visual={<CreatureVisual
        title={entity.title}
        coverAssetId={entity.coverAssetId}
        presentation={creaturePresentation(entity.properties.imagePresentation)}
        framing={readCoverFraming(entity.properties.coverFraming, defaultCoverFraming(entityType))}
      />}
    />
  </div>
}
