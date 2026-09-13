import Image from 'next/image'
import Link from 'next/link'
import { Microscope, Pencil, Stethoscope } from 'lucide-react'
import { BacklinksPanel } from '@/components/entities/backlinks-panel'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { PropertyDisplayList } from '@/components/entities/property-display-list'
import { RelationsPanel } from '@/components/entities/relations-panel'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import type { EntityPageProps } from '@/components/entities/entity-page'
import type { PropertyDefinition } from '@/domain/entities/entityType'
import { assetVariantUrl } from '@/lib/assetUrl'
import styles from './natural-science-page.module.css'

const SHORT_FIELDS = ['scientificName', 'habitat', 'distribution', 'notableProperties', 'toxicity', 'affectedSystem', 'transmission', 'symptoms', 'progression']
const LINK_FIELDS = ['relatedEntries']

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

export function NaturalSciencePage({ entity, entityType, worldName, content, entityTitleById, backlinks, relationTargetOptions }: EntityPageProps) {
  const discipline = prose(entity.properties.discipline) === 'Medicina' ? 'Medicina' : 'Natureza'
  const subtype = prose(entity.properties.scienceSubtype) || 'Registro não classificado'
  const facts = selectProperties(entityType.properties, SHORT_FIELDS, entity.properties)
  const connections = selectProperties(entityType.properties, LINK_FIELDS, entity.properties)
  const uses = prose(entity.properties.uses)
  const treatment = prose(entity.properties.treatment)
  const Icon = discipline === 'Medicina' ? Stethoscope : Microscope

  return <main className={styles.atlas} data-discipline={discipline === 'Medicina' ? 'medicine' : 'nature'}>
    <article className={styles.sheet}>
      <header className={styles.header}>
        <div><Breadcrumbs items={[{ label: worldName, href: '/codex' }, { label: entityType.pluralLabel, href: `/${entityType.id}` }, { label: entity.title }]} />
          <p className={styles.eyebrow}><Icon />{discipline.toUpperCase()} · {subtype.toUpperCase()}</p>
          <h1>{entity.title}</h1>
          {prose(entity.properties.scientificName) && <p className={styles.scientificName}>{prose(entity.properties.scientificName)}</p>}
        </div>
        <Button asChild variant="outline" size="sm"><Link href={`/entity/${entity.id}/edit`}><Pencil className="size-4" />Editar</Link></Button>
      </header>

      <section className={styles.plate}>
        <figure>
          <div className={styles.imageArea}>{entity.coverAssetId ? <Image src={assetVariantUrl(entity.coverAssetId, 'original')} alt={entity.title} fill sizes="(min-width: 900px) 50vw, 92vw" className={styles.image} priority unoptimized /> : <div className={styles.noImage}><Icon /><span>Ilustração não registrada</span></div>}</div>
          <figcaption><span>PRANCHA 01</span><strong>{subtype}</strong><span>{discipline}</span></figcaption>
        </figure>
        <aside className={styles.observations}>
          <div className={styles.sectionHeading}><span>Dados principais</span><i /></div>
          {facts.length > 0 ? <PropertyDisplayList properties={facts} values={entity.properties} entityTitleById={entityTitleById} columns={2} /> : <p className={styles.empty}>Nenhuma propriedade específica foi registrada.</p>}
          {entity.tags.length > 0 && <div className={styles.tags}>{entity.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
        </aside>
      </section>

      <div className={styles.bodyGrid}>
        <div className={styles.report}>
          {content.pages.map((page) => <section key={page.id}><div className={styles.sectionHeading}><span>{page.title}</span><i /></div><ContentRenderer content={{ ...content, pages: [page] }} /></section>)}
          {uses && <section><div className={styles.sectionHeading}><span>Usos e aplicações</span><i /></div><p>{uses}</p></section>}
          {treatment && <section><div className={styles.sectionHeading}><span>Tratamento ou manejo</span><i /></div><p>{treatment}</p></section>}
        </div>
        <aside className={styles.references}>
          {connections.length > 0 && <section><h2>Registros relacionados</h2><PropertyDisplayList properties={connections} values={entity.properties} entityTitleById={entityTitleById} columns={1} /></section>}
          <section><h2>Relações</h2><RelationsPanel entityId={entity.id} relations={entity.relations} entityTitleById={entityTitleById} targetOptions={relationTargetOptions} /></section>
          <section><h2>Referências cruzadas</h2><BacklinksPanel backlinks={backlinks} /></section>
        </aside>
      </div>
    </article>
  </main>
}
