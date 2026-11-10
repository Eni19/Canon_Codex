'use client'

import type { ReactNode } from 'react'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { CreatureComposition, CreatureSection, CreatureVisual, creaturePresentation, creatureProperties } from '@/components/entities/creature-composition'
import { PortraitAttributesCard } from '@/components/entities/portrait-attributes'
import { PortraitComposition, PortraitSection, portraitAttributes, portraitSummary } from '@/components/entities/portrait-composition'
import { PortraitHero } from '@/components/entities/portrait-hero'
import { useFramingArt, type FramingPreviewSnapshot } from '@/components/entities/entity-editor/cover-framing-studio'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import type { CoverFraming } from '@/domain/entities/coverFraming'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import type { Calendar } from '@/domain/worlds/calendar'
import portraitStyles from '../portrait-entity-page.module.css'
import creatureStyles from '../creature-entity-page.module.css'

/**
 * The real page compositions, filled with the form's current values, for the framing studio.
 * Sections that need saved data (relations, backlinks) are left out; they do not move the image.
 */
export interface FramingPreviewProps {
  framing: CoverFraming
  coverAssetId: string
  entityType: EntityTypeDefinition
  worldName: string
  calendar: Calendar
  titleById: Record<string, string>
  snapshot: FramingPreviewSnapshot
}

const previewBadge = <span className="inline-flex h-7 shrink-0 items-center rounded-md border border-border px-2.5 text-[0.8rem] text-muted-foreground">Prévia da página</span>

function previewBreadcrumbs({ worldName, entityType, snapshot }: FramingPreviewProps): ReactNode {
  return <Breadcrumbs items={[{ label: worldName, href: '/codex' }, { label: entityType.pluralLabel, href: `/${entityType.id}` }, { label: snapshot.title }]}/>
}

export function CharacterFramingPreview(props: FramingPreviewProps) {
  const { framing, coverAssetId, entityType, calendar, titleById, snapshot } = props
  const { className: artClass, ...artProps } = useFramingArt()
  return (
    <div className="h-full px-4 pt-6 sm:px-8 sm:pt-8">
      <div className={portraitStyles.page}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">{previewBreadcrumbs(props)}{previewBadge}</div>
        <PortraitComposition
          reveal={false}
          title={snapshot.title}
          status={snapshot.status}
          tags={snapshot.tags}
          summary={portraitSummary(entityType, snapshot.properties, calendar, titleById)}
          details={<PortraitSection title="Conteúdo"><div className={portraitStyles.storyScroll}><ContentRenderer content={snapshot.content}/></div></PortraitSection>}
          portrait={<div {...artProps} className={`relative rounded-sm ${artClass ?? ''}`}><PortraitHero coverAssetId={coverAssetId} fallbackIcon={entityType.icon} className={portraitStyles.art} framing={framing}/></div>}
          content={<>
            <PortraitAttributesCard attributes={portraitAttributes(entityType, snapshot.aliases, snapshot.properties, titleById)}/>
            <PortraitSection title="Personalidade">
              <div className={portraitStyles.personalityBox}>
                {typeof snapshot.properties.personality === 'string' && snapshot.properties.personality.trim() ? snapshot.properties.personality : 'Nenhuma descrição de personalidade.'}
              </div>
            </PortraitSection>
          </>}
        />
      </div>
    </div>
  )
}

export function CreatureFramingPreview(props: FramingPreviewProps) {
  const { framing, coverAssetId, entityType, calendar, titleById, snapshot } = props
  const art = useFramingArt()
  return (
    <div className={creatureStyles.shell}>
      <CreatureComposition
        breadcrumbs={previewBreadcrumbs(props)}
        action={previewBadge}
        title={snapshot.title}
        status={snapshot.status}
        tags={snapshot.tags}
        properties={creatureProperties(entityType, snapshot.properties, calendar, titleById)}
        sections={<CreatureSection title="Registro"><ContentRenderer content={snapshot.content}/></CreatureSection>}
        visual={<CreatureVisual title={snapshot.title} coverAssetId={coverAssetId} presentation={creaturePresentation(snapshot.properties.imagePresentation)} framing={framing} interaction={art}/>}
      />
    </div>
  )
}
