import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { BacklinksPanel } from '@/components/entities/backlinks-panel'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { Gallery } from '@/components/entities/gallery'
import { PortraitComposition, PortraitSection, portraitAttributes, portraitSummary } from '@/components/entities/portrait-composition'
import { PortraitHero } from '@/components/entities/portrait-hero'
import { PortraitAttributesCard } from '@/components/entities/portrait-attributes'
import { PageScrollLock } from '@/components/entities/page-scroll-lock'
import { RelationsPanel, type RelationTargetOption } from '@/components/entities/relations-panel'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import type { ContentDocument } from '@/domain/content/contentDocument'
import { readCoverFraming } from '@/domain/entities/coverFraming'
import type { Entity } from '@/domain/entities/entity'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import type { Calendar } from '@/domain/worlds/calendar'
import type { Backlink } from '@/repositories/contracts/worldRepository'
import styles from './portrait-entity-page.module.css'

/**
 * Portrait composition responds to the available content width, including sidebar changes.
 * Header groups share a grid row; the desktop portrait fills the remaining viewport height.
 * See .agents/skills/design-inspiration/style-notes.md.
 */
export function PortraitEntityPage({
  entity,
  entityType,
  worldName,
  content,
  entityTitleById,
  backlinks,
  relationTargetOptions,
  calendar,
}: {
  entity: Entity
  entityType: EntityTypeDefinition
  worldName: string
  content: ContentDocument
  entityTitleById: Record<string, string>
  backlinks: Backlink[]
  relationTargetOptions: RelationTargetOption[]
  calendar: Calendar
}) {
  const blocks = entityType.layout
  const attributes = portraitAttributes(entityType, entity.aliases, entity.properties, entityTitleById)

  return (
    <div data-character-theme={entity.theme ?? 'amber'} className="px-4 pt-6 sm:px-8 sm:pt-8">
      <PageScrollLock />
      <div className={styles.page}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <Breadcrumbs
            items={[
              { label: worldName, href: '/codex' },
              { label: entityType.pluralLabel, href: `/${entityType.id}` },
              { label: entity.title },
            ]}
          />
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link replace href={`/entity/${entity.id}/edit`}>
            <Pencil className="size-4" />
            Editar
          </Link>
        </Button>
      </div>
      <PortraitComposition
        title={entity.title}
        status={entity.status}
        tags={entity.tags}
        summary={portraitSummary(entityType, entity.properties, calendar, entityTitleById)}
        details={blocks.includes('content') && (
          <PortraitSection title="Conteúdo" revealOrder={3}>
            <div className={styles.storyScroll} tabIndex={0} aria-label="Conteúdo do personagem">
              <ContentRenderer content={content} />
            </div>
          </PortraitSection>
        )}
        portrait={
          <PortraitHero
            coverAssetId={entity.coverAssetId}
            fallbackIcon={entityType.icon}
            className={styles.art}
            framing={readCoverFraming(entity.properties.coverFraming)}
          />
        }
        content={<>
          <PortraitAttributesCard attributes={attributes} />

          {blocks.includes('gallery') && entity.galleryAssetIds && entity.galleryAssetIds.length > 0 && (
            <PortraitSection title="Galeria">
              <Gallery assetIds={entity.galleryAssetIds} />
            </PortraitSection>
          )}

          {blocks.includes('relations') && (
            <PortraitSection title="Relacionado">
              <RelationsPanel
                entityId={entity.id}
                relations={entity.relations}
                entityTitleById={entityTitleById}
                targetOptions={relationTargetOptions}
              />
            </PortraitSection>
          )}

          <PortraitSection title="Personalidade">
            <div className={styles.personalityBox}>
              {typeof entity.properties.personality === 'string' && entity.properties.personality.trim()
                ? entity.properties.personality
                : 'Nenhuma descrição de personalidade.'}
            </div>
          </PortraitSection>

          {blocks.includes('backlinks') && (
            <PortraitSection title="Backlinks">
              <BacklinksPanel backlinks={backlinks} />
            </PortraitSection>
          )}
        </>}
      />
      </div>
    </div>
  )
}

