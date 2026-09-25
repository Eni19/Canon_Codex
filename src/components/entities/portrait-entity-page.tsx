import Link from 'next/link'
import type { ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { BacklinksPanel } from '@/components/entities/backlinks-panel'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { Gallery } from '@/components/entities/gallery'
import { PortraitHero } from '@/components/entities/portrait-hero'
import { ViewportPortrait } from '@/components/entities/viewport-portrait'
import { PortraitAttributes, type PortraitAttribute } from '@/components/entities/portrait-attributes'
import { PageScrollLock } from '@/components/entities/page-scroll-lock'
import { RelationsPanel, type RelationTargetOption } from '@/components/entities/relations-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import type { ContentDocument } from '@/domain/content/contentDocument'
import type { Entity } from '@/domain/entities/entity'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import { formatDateFieldValue } from '@/domain/worlds/calendar-date'
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
  const headerKeys = ['profile', 'affiliation', 'occupation']
  const headerProperties = headerKeys.flatMap((key) => entityType.properties.filter((property) => property.key === key))
  const attributes: PortraitAttribute[] = [
    { key: 'aliases', label: 'Apelidos', value: entity.aliases.join(', ') || '—' },
    ...['age', 'species', 'originLocation', 'firstAppearance'].flatMap((key) => {
      const property = entityType.properties.find((candidate) => candidate.key === key)
      if (!property) return []
      const raw = entity.properties[key]
      const value = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : ''
      return [{
        key,
        label: property.label,
        value: property.kind === 'reference' && value ? entityTitleById[value] ?? 'Referência indisponível' : value || '—',
        href: property.kind === 'reference' && value && entityTitleById[value] ? `/entity/${value}` : undefined,
      }]
    }),
  ]

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
      <div className={styles.composition}>
        <div aria-hidden="true" className={styles.rule} />
        {/* The two header groups share a baseline; the portrait paints over the rule. */}
        <div className={styles.identity}>
          <h1 className={`font-serif font-medium text-primary uppercase ${styles.name}`}>{entity.title}</h1>
        </div>
        <div className={styles.metadata}>
          {(entity.status || entity.tags.length > 0) && (
            <div className={styles.badges}>
              {entity.status && <Badge variant="outline">{entity.status}</Badge>}
              {entity.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
            </div>
          )}
        </div>
        <div className={styles.details}>
          {blocks.includes('content') && (
            <Section title="Conteúdo">
              <div className={styles.storyScroll} tabIndex={0} aria-label="Conteúdo do personagem">
                <ContentRenderer content={content} />
              </div>
            </Section>
          )}
        </div>

        <ViewportPortrait className={styles.portrait}>
          <PortraitAttributes attributes={attributes}>
          <PortraitHero
            coverAssetId={entity.coverAssetId}
            fallbackIcon={entityType.icon}
            className={styles.art}
          />
          </PortraitAttributes>
        </ViewportPortrait>

          <dl className={styles.summary}>
            {headerProperties.map((property) => {
              const value = entity.properties[property.key]
              const text = property.kind === 'date' ? formatDateFieldValue(calendar, value) || '—' : typeof value === 'string' && value.trim() ? value : '—'
              return (
                <div key={property.key} className="min-w-0 max-w-full">
                  <dt className="mb-1 text-xs tracking-wider text-muted-foreground uppercase">{property.label}</dt>
                  <dd className={`font-serif break-words ${property.key === 'profile' ? 'bg-primary px-2 py-1 font-semibold text-primary-foreground uppercase' : 'py-1'}`}>
                    {property.kind === 'reference' && text !== '—' ? (
                      <Link href={`/entity/${text}`} className="text-primary hover:underline">{entityTitleById[text] ?? 'Referência indisponível'}</Link>
                    ) : text}
                  </dd>
                </div>
              )
            })}
          </dl>
        <div className={styles.content}>
          {blocks.includes('gallery') && entity.galleryAssetIds && entity.galleryAssetIds.length > 0 && (
            <Section title="Galeria">
              <Gallery assetIds={entity.galleryAssetIds} />
            </Section>
          )}

          {blocks.includes('relations') && (
            <Section title="Relacionado">
              <RelationsPanel
                entityId={entity.id}
                relations={entity.relations}
                entityTitleById={entityTitleById}
                targetOptions={relationTargetOptions}
              />
            </Section>
          )}

          <Section title="Personalidade">
            <div className={styles.personalityBox}>
              {typeof entity.properties.personality === 'string' && entity.properties.personality.trim()
                ? entity.properties.personality
                : 'Nenhuma descrição de personalidade.'}
            </div>
          </Section>

          {blocks.includes('backlinks') && (
            <Section title="Backlinks">
              <BacklinksPanel backlinks={backlinks} />
            </Section>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </div>
  )
}

