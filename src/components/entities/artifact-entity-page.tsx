'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Archive, Crosshair, Gem, Pencil, Ruler } from 'lucide-react'
import { useState } from 'react'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { BacklinksPanel } from '@/components/entities/backlinks-panel'
import { RelationsPanel } from '@/components/entities/relations-panel'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { ArtifactDetailsSchema } from '@/domain/entities/artifactDetail'
import { assetVariantUrl } from '@/lib/assetUrl'
import type { EntityPageProps } from './entity-page'
import styles from './artifact-catalog.module.css'

const FIELD_KEYS = ['artifactType', 'origin', 'period', 'materials', 'dimensions', 'condition', 'acquisition', 'currentLocation', 'owner']

function displayValue(value: unknown, titleById: Record<string, string>) {
  if (typeof value === 'string') return titleById[value] ?? value
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').map((item) => titleById[item] ?? item).join(', ')
  return '—'
}

export function ArtifactEntityPage({ entity, entityType, worldName, content, entityTitleById, backlinks, relationTargetOptions }: EntityPageProps) {
  const parsedDetails = ArtifactDetailsSchema.safeParse(entity.properties.artifactDetails)
  const details = parsedDetails.success ? parsedDetails.data : []
  const [activeId, setActiveId] = useState<string | null>(details[0]?.id ?? null)
  const activeDetail = details.find((detail) => detail.id === activeId)
  const registration = typeof entity.properties.registrationNumber === 'string' && entity.properties.registrationNumber.trim()
    ? entity.properties.registrationNumber
    : `CC-${entity.id.slice(0, 8).toUpperCase()}`
  const fields = FIELD_KEYS.flatMap((key) => {
    const definition = entityType.properties.find((property) => property.key === key)
    if (!definition) return []
    return [{ key, label: definition.label, value: displayValue(entity.properties[key], entityTitleById) }]
  })

  return <div className={styles.museum}>
    <div className={styles.worktop}>
      <header className={styles.header}>
        <div><Breadcrumbs items={[{ label: worldName, href: '/codex' }, { label: entityType.pluralLabel, href: `/${entityType.id}` }, { label: entity.title }]}/><p className={styles.eyebrow}><Archive />Coleção catalogada · {registration}</p><h1>{entity.title}</h1>{entity.aliases.length > 0 && <p className={styles.aliases}>{entity.aliases.join(' · ')}</p>}</div>
        <Button asChild variant="outline" size="sm"><Link href={`/entity/${entity.id}/edit`}><Pencil className="size-4" />Editar</Link></Button>
      </header>

      <section className={styles.catalogGrid}>
        <aside className={styles.catalogCard}>
          <div className={styles.cardHeading}><span>CC</span><div><small>Ficha de catalogação</small><strong>{registration}</strong></div></div>
          <dl>{fields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
          {entity.tags.length > 0 && <div className={styles.tags}>{entity.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
        </aside>

        <figure className={styles.photoPlate}>
          <div className={styles.photoHeader}><span>Registro fotográfico</span><span>{registration}</span></div>
          <div className={styles.photoArea}>
            <div className={styles.measureVertical}><i/><i/><i/><i/><i/></div>
            {entity.coverAssetId ? <Image src={assetVariantUrl(entity.coverAssetId, 'original')} alt={entity.title} fill sizes="(min-width: 1100px) 54vw, 90vw" className={styles.objectPhoto} priority/> : <div className={styles.noPhoto}><Gem/><span>Objeto ainda não fotografado</span></div>}
            {details.map((detail, index) => <button key={detail.id} type="button" aria-label={detail.label} aria-pressed={activeId === detail.id} onClick={() => setActiveId(detail.id)} className={styles.hotspot} data-active={activeId === detail.id} style={{ left: `${detail.x}%`, top: `${detail.y}%` }}>{index + 1}</button>)}
          </div>
          <div className={styles.scale}><Ruler/><div><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><span>escala de referência</span></div>
          <figcaption><span>FIG. {registration}</span><strong>{entity.title}</strong><span>Imagem técnica · sem escala garantida</span></figcaption>
        </figure>

        <aside className={styles.detailPanel}>
          <div className={styles.detailHeading}><Crosshair/><div><small>Leitura material</small><h2>Detalhes do objeto</h2></div></div>
          {details.length ? <ol>{details.map((detail, index) => <li key={detail.id} data-active={activeId === detail.id}><button type="button" onClick={() => setActiveId(detail.id)}><span>{index + 1}</span><strong>{detail.label}</strong></button>{activeId === detail.id && <p>{detail.description || 'Sem anotação adicional.'}</p>}</li>)}</ol> : <p className={styles.emptyDetails}>Nenhum detalhe físico foi catalogado.</p>}
          {activeDetail && <div className={styles.activeSlip}><span>Observação selecionada</span><strong>{activeDetail.label}</strong><p>{activeDetail.description || 'Sem anotação adicional.'}</p></div>}
        </aside>
      </section>

      <section className={styles.notesGrid}>
        <div className={styles.report}><div className={styles.reportHeading}><span>RELATÓRIO DE CONSERVAÇÃO</span><small>{registration}</small></div>{content.pages.map((page) => <article key={page.id}><h2>{page.title}</h2><ContentRenderer content={{ ...content, pages: [page] }}/></article>)}</div>
        <aside className={styles.archiveNotes}><section><h2>Relações de acervo</h2><RelationsPanel entityId={entity.id} relations={entity.relations} entityTitleById={entityTitleById} targetOptions={relationTargetOptions}/></section><section><h2>Referências cruzadas</h2><BacklinksPanel backlinks={backlinks}/></section></aside>
      </section>
    </div>
  </div>
}

