import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { BacklinksPanel } from '@/components/entities/backlinks-panel'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import { Gallery } from '@/components/entities/gallery'
import { PortraitEntityPage } from '@/components/entities/portrait-entity-page'
import { LocationEntityPage } from '@/components/entities/location-entity-page'
import { EvidenceBoardPage } from '@/components/entities/evidence-board-page'
import { OrganizationDossierPage } from '@/components/entities/organization-dossier-page'
import { CreatureEntityPage } from '@/components/entities/creature-entity-page'
import { EventNewspaperPage } from '@/components/entities/event-newspaper-page'
import { ArtifactEntityPage } from '@/components/entities/artifact-entity-page'
import { CosmologyEntityPage } from '@/components/entities/cosmology-entity-page'
import { TaleEntityPage } from '@/components/entities/tale-entity-page'
import { ConceptEntityPage } from '@/components/entities/concept-entity-page'
import { SpeciesGuidePage } from '@/components/entities/species-guide-page'
import { NaturalSciencePage } from '@/components/entities/natural-science-page'
import { PropertyDisplayList } from '@/components/entities/property-display-list'
import { RelationsPanel, type RelationTargetOption } from '@/components/entities/relations-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { PageContainer } from '@/components/wiki/page-container'
import type { ContentDocument } from '@/domain/content/contentDocument'
import type { Entity } from '@/domain/entities/entity'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import type { Calendar } from '@/domain/worlds/calendar'
import { assetVariantUrl } from '@/lib/assetUrl'
import type { Backlink } from '@/repositories/contracts/worldRepository'
import type { SceneSummary } from '@/domain/scenes/scene'

export interface EntityPageProps {
  entity: Entity
  entityType: EntityTypeDefinition
  worldName: string
  content: ContentDocument
  entityTitleById: Record<string, string>
  backlinks: Backlink[]
  relationTargetOptions: RelationTargetOption[]
  allEntities: Entity[]
  relatedScenes: SceneSummary[]
  calendar: Calendar
}

export function EntityPage(props: EntityPageProps) {
  const { entity, entityType, worldName, content, entityTitleById, backlinks, relationTargetOptions, calendar } = props
  const blocks = entityType.layout

  if (entity.type === 'location') return <LocationEntityPage {...props} />
  if (entity.type === 'evidence') return <EvidenceBoardPage {...props} />
  if (entity.type === 'organization') return <OrganizationDossierPage {...props} />
  if (entity.type === 'creature') return <CreatureEntityPage {...props} />
  if (entity.type === 'event') return <EventNewspaperPage {...props} />
  if (entity.type === 'artifact') return <ArtifactEntityPage {...props} />
  if (entity.type === 'cosmology') return <CosmologyEntityPage {...props} />
  if (entity.type === 'tale') return <TaleEntityPage {...props} />
  if (entity.type === 'concept') return <ConceptEntityPage {...props} />
  if (entity.type === 'species') return <SpeciesGuidePage {...props} />
  if (entity.type === 'naturalScience') return <NaturalSciencePage {...props} />

  // Portrait-driven types get a bespoke wide layout (art dominant, everything flanking it) —
  // see PortraitEntityPage and design-inspiration/style-notes.md — instead of the generic stack.
  if (blocks.includes('portraitHero')) {
    return <PortraitEntityPage {...props} />
  }

  return (
    <PageContainer className="max-w-3xl">
      {blocks.includes('header') && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Breadcrumbs
              items={[
                { label: worldName, href: '/codex' },
                { label: entityType.pluralLabel, href: `/${entityType.id}` },
                { label: entity.title },
              ]}
            />
            <div className="mt-2 flex items-center gap-2">
              <EntityTypeIcon name={entityType.icon} className="size-4 shrink-0 text-muted-foreground" />
              <h1 className="font-serif text-3xl font-medium text-balance">{entity.title}</h1>
              {entity.status && <Badge variant="outline">{entity.status}</Badge>}
            </div>
            {entity.aliases.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">também conhecido(a) como {entity.aliases.join(', ')}</p>
            )}
            {entity.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {entity.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link replace href={`/entity/${entity.id}/edit`}>
              <Pencil className="size-4" />
              Editar
            </Link>
          </Button>
        </div>
      )}

      {blocks.includes('hero') && entity.coverAssetId && (
        <div className="relative mt-6 aspect-21/9 w-full overflow-hidden rounded-lg border border-border bg-muted">
          <Image
            src={assetVariantUrl(entity.coverAssetId, 'original')}
            alt=""
            fill
            sizes="768px"
            className="object-cover"
            priority
          />
        </div>
      )}

      {blocks.includes('properties') && entityType.properties.length > 0 && (
        <Section title="Propriedades" className="mt-6">
          <PropertyDisplayList properties={entityType.properties} values={entity.properties} entityTitleById={entityTitleById} calendar={calendar} />
        </Section>
      )}

      {blocks.includes('content') && (
        <Section title="Conteúdo" className="mt-6">
          <ContentRenderer content={content} />
        </Section>
      )}

      {blocks.includes('gallery') && entity.galleryAssetIds && entity.galleryAssetIds.length > 0 && (
        <Section title="Galeria" className="mt-6">
          <Gallery assetIds={entity.galleryAssetIds} />
        </Section>
      )}

      {blocks.includes('relations') && (
        <Section title="Relacionado" className="mt-6">
          <RelationsPanel
            entityId={entity.id}
            relations={entity.relations}
            entityTitleById={entityTitleById}
            targetOptions={relationTargetOptions}
          />
        </Section>
      )}

      {blocks.includes('backlinks') && (
        <Section title="Backlinks" className="mt-6">
          <BacklinksPanel backlinks={backlinks} />
        </Section>
      )}
    </PageContainer>
  )
}

function Section({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </div>
  )
}
