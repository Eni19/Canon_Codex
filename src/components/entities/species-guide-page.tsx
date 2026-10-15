import Image from 'next/image'
import Link from 'next/link'
import { Dna, Pencil } from 'lucide-react'
import { BacklinksPanel } from '@/components/entities/backlinks-panel'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { PropertyDisplayList } from '@/components/entities/property-display-list'
import { RelationsPanel } from '@/components/entities/relations-panel'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import type { EntityPageProps } from '@/components/entities/entity-page'
import type { PropertyDefinition } from '@/domain/entities/entityType'
import { assetVariantUrl } from '@/lib/assetUrl'
import styles from './species-guide-page.module.css'

const FACT_KEYS = ['classification', 'originLocation', 'habitats', 'languages', 'traits', 'lifespan', 'population']
const CONNECTION_KEYS = ['relatedSpecies', 'relatedOrganizations']

function hasValue(value: unknown) {
  return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== ''
}

function selectProperties(properties: PropertyDefinition[], keys: string[], values: Record<string, unknown>) {
  return keys.flatMap((key) => {
    const property = properties.find((candidate) => candidate.key === key)
    return property && hasValue(values[key]) ? [property] : []
  })
}

function prose(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function SpeciesGuidePage({ entity, entityType, worldName, content, entityTitleById, backlinks, relationTargetOptions, calendar }: EntityPageProps) {
  const recordKind = prose(entity.properties.recordKind) || 'Espécie'
  const facts = selectProperties(entityType.properties, FACT_KEYS, entity.properties)
  const connections = selectProperties(entityType.properties, CONNECTION_KEYS, entity.properties)
  const socialStructure = prose(entity.properties.socialStructure)
  const customs = prose(entity.properties.customs)

  return <main className={styles.guide}>
    <article className={styles.sheet}>
      <header className={styles.header}>
        <div><Breadcrumbs items={[{ label: worldName, href: '/codex' }, { label: entityType.pluralLabel, href: `/${entityType.id}` }, { label: entity.title }]} />
          <p className={styles.eyebrow}><Dna />GUIA ANTROPOLÓGICO · {recordKind}</p>
          <h1>{entity.title}</h1>
          {entity.aliases.length > 0 && <p className={styles.aliases}>{entity.aliases.join(' · ')}</p>}
        </div>
        <Button asChild variant="outline" size="sm"><Link replace href={`/entity/${entity.id}/edit`}><Pencil className="size-4" />Editar</Link></Button>
      </header>

      <section className={styles.profile}>
        <figure>
          <div className={styles.imageArea}>{entity.coverAssetId ? <Image src={assetVariantUrl(entity.coverAssetId, 'original')} alt={entity.title} fill sizes="(min-width: 900px) 42vw, 92vw" className={styles.image} priority unoptimized /> : <div className={styles.noImage}><Dna /><span>Representação não registrada</span></div>}</div>
          <figcaption><span>REGISTRO VISUAL</span><strong>{recordKind}</strong></figcaption>
        </figure>
        <div className={styles.facts}>
          <div className={styles.sectionLabel}><span>01</span><p>Identificação</p></div>
          <PropertyDisplayList properties={facts} values={entity.properties} entityTitleById={entityTitleById} calendar={calendar} columns={2} />
          {entity.tags.length > 0 && <div className={styles.tags}>{entity.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
        </div>
      </section>

      <div className={styles.bodyGrid}>
        <div className={styles.reading}>
          {content.pages.map((page, index) => <section key={page.id}><div className={styles.sectionLabel}><span>{String(index + 2).padStart(2, '0')}</span><h2>{page.title}</h2></div><ContentRenderer content={{ ...content, pages: [page] }} /></section>)}
          {socialStructure && <section><div className={styles.sectionLabel}><span>—</span><h2>Estrutura social</h2></div><p className={styles.prose}>{socialStructure}</p></section>}
          {customs && <section><div className={styles.sectionLabel}><span>—</span><h2>Costumes e tradições</h2></div><p className={styles.prose}>{customs}</p></section>}
        </div>
        <aside className={styles.references}>
          {connections.length > 0 && <section><h2>Associações</h2><PropertyDisplayList properties={connections} values={entity.properties} entityTitleById={entityTitleById} calendar={calendar} columns={1} /></section>}
          <section><h2>Relações</h2><RelationsPanel entityId={entity.id} relations={entity.relations} entityTitleById={entityTitleById} targetOptions={relationTargetOptions} /></section>
          <section><h2>Referências cruzadas</h2><BacklinksPanel backlinks={backlinks} /></section>
        </aside>
      </div>
    </article>
  </main>
}
