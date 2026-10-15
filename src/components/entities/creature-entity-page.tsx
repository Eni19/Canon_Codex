import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Pencil, PawPrint } from 'lucide-react'
import { BacklinksPanel } from './backlinks-panel'
import { Gallery } from './gallery'
import { PageScrollLock } from './page-scroll-lock'
import { RelationsPanel } from './relations-panel'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { assetVariantUrl } from '@/lib/assetUrl'
import { formatDateFieldValue } from '@/domain/worlds/calendar-date'
import type { EntityPageProps } from './entity-page'
import styles from './creature-entity-page.module.css'

function value(value: unknown) { return typeof value === 'string' && value.trim() ? value : '—' }

export function CreatureEntityPage({ entity, entityType, worldName, content, entityTitleById, backlinks, relationTargetOptions, calendar }: EntityPageProps) {
  const imageStyle = entity.properties.imagePresentation === 'Retrato' ? 'Retrato' : 'Contorno'
  const fields = ['creatureKind', 'classification', 'dangerLevel', 'habitat'].flatMap((key) => {
    const property = entityType.properties.find((candidate) => candidate.key === key)
    return property ? [property] : []
  })

  return <div data-character-theme={entity.theme ?? 'amber'} className={styles.shell}>
    <PageScrollLock />
    <main className={styles.page}>
      <header className={styles.header}>
        <div><Breadcrumbs items={[{ label: worldName, href: '/codex' }, { label: entityType.pluralLabel, href: `/${entityType.id}` }, { label: entity.title }]} />
          <div className={styles.identity}><PawPrint className="size-5 text-primary" /><div><span className={styles.eyebrow}>REGISTRO DE CRIATURA</span><h1>{entity.title}</h1></div></div>
          {(entity.status || entity.tags.length > 0) && <div className={styles.badges}>{entity.status && <Badge variant="outline">{entity.status}</Badge>}{entity.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div>}
        </div>
        <Button asChild variant="outline" size="sm"><Link replace href={`/entity/${entity.id}/edit`}><Pencil className="size-4" />Editar</Link></Button>
      </header>

      <div className={styles.composition}>
        <section className={styles.information}>
          <dl className={styles.properties}>{fields.map((property) => { const raw = entity.properties[property.key]; const text = property.kind === 'date' ? formatDateFieldValue(calendar, raw) || '—' : value(raw); return <div key={property.key}><dt>{property.label}</dt><dd>{property.kind === 'reference' && text !== '—' ? <Link href={`/entity/${text}`}>{entityTitleById[text] ?? 'Referência indisponível'}</Link> : text}</dd></div> })}</dl>
          <div className={styles.localScroll} tabIndex={0} aria-label="Conteúdo da criatura">
            <Section title="Registro"><ContentRenderer content={content} /></Section>
            {entity.galleryAssetIds?.length ? <Section title="Galeria"><Gallery assetIds={entity.galleryAssetIds} /></Section> : null}
            <Section title="Relacionado"><RelationsPanel entityId={entity.id} relations={entity.relations} entityTitleById={entityTitleById} targetOptions={relationTargetOptions} /></Section>
            <Section title="Backlinks"><BacklinksPanel backlinks={backlinks} /></Section>
          </div>
        </section>

        <aside className={`${styles.visual} ${imageStyle === 'Retrato' ? styles.portrait : styles.silhouette}`} aria-label={`Imagem da criatura em formato de ${imageStyle.toLowerCase()}`}>
          {imageStyle === 'Contorno' && <div className={styles.glow} aria-hidden="true" />}
          <div className={styles.imageFrame}>
            {entity.coverAssetId ? <Image src={assetVariantUrl(entity.coverAssetId, 'original')} alt="" fill sizes="(min-width: 900px) 48vw, 100vw" quality={90} className={styles.image} priority /> : <div className={styles.fallback}><PawPrint className="size-20" /><span>Imagem não registrada</span></div>}
          </div>
          {imageStyle === 'Retrato' && <div className={styles.photoCaption}><span>ARQUIVO FOTOGRÁFICO</span><b>{entity.title}</b></div>}
        </aside>
      </div>
    </main>
  </div>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.section}><h2><span />{title}</h2>{children}</section>
}

