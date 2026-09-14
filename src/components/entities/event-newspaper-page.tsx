import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays, MapPin, Pencil, UsersRound } from 'lucide-react'
import { BacklinksPanel } from './backlinks-panel'
import { RelationsPanel } from './relations-panel'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { assetVariantUrl } from '@/lib/assetUrl'
import type { EntityPageProps } from './entity-page'
import styles from './event-newspaper.module.css'

function text(value: unknown) { return typeof value === 'string' && value.trim() ? value : '' }
function ids(value: unknown) { return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [] }

export function EventNewspaperPage({ entity, entityType, worldName, content, entityTitleById, backlinks, relationTargetOptions }: EntityPageProps) {
  const date = text(entity.properties.eventDate)
  const status = text(entity.properties.eventStatus)
  const locationIds = [...new Set([text(entity.properties.location), ...ids(entity.properties.relatedLocations)].filter(Boolean))]
  const participantIds = ids(entity.properties.participants)

  return <div className={styles.newsstand}><main className={styles.paper}>
    <div className={styles.toolbar}><Breadcrumbs items={[{ label: worldName, href: '/codex' }, { label: entityType.pluralLabel, href: `/${entityType.id}` }, { label: entity.title }]} /><Button asChild variant="outline" size="sm"><Link replace href={`/entity/${entity.id}/edit`}><Pencil className="size-4" />Editar</Link></Button></div>
    <header className={styles.masthead}><div className={styles.kicker}>EDIÇÃO EXTRAORDINÁRIA · ARQUIVO DE EVENTOS</div><div className={styles.brand}>CANON CODEX</div><div className={styles.issue}><span>{date || 'DATA NÃO REGISTRADA'}</span><span>{status || entity.status || 'REGISTRO ABERTO'}</span></div></header>
    <section className={styles.headline}><h1>{entity.title}</h1>{entity.aliases.length > 0 && <p>{entity.aliases.join(' · ')}</p>}</section>
    <div className={styles.factLine}>
      {date && <span><CalendarDays />{date}</span>}
      {locationIds.map((id) => <Link key={id} href={`/entity/${id}`}><MapPin />{entityTitleById[id] ?? 'Local registrado'}</Link>)}
      {participantIds.length > 0 && <span><UsersRound />{participantIds.length} participante{participantIds.length === 1 ? '' : 's'}</span>}
    </div>

    <div className={styles.columns}>
      {entity.coverAssetId && <figure className={styles.newsPhoto}><div><Image src={assetVariantUrl(entity.coverAssetId, 'original')} alt="" fill sizes="(min-width: 900px) 30vw, 100vw" className="object-contain" priority /></div><figcaption>Imagem associada ao registro de {entity.title}.</figcaption></figure>}
      <article className={styles.story}><ContentRenderer content={content} /></article>
      <aside className={styles.sidebar}>
        <section><h2>Participantes</h2>{participantIds.length ? participantIds.map((id) => <Link key={id} href={`/entity/${id}`}>{entityTitleById[id] ?? 'Registro relacionado'}</Link>) : <p>Nenhum participante registrado.</p>}</section>
        {entity.tags.length > 0 && <section><h2>Índice</h2><p>{entity.tags.join(' · ')}</p></section>}
      </aside>
    </div>
    <footer className={styles.footer}><section><h2>Registros relacionados</h2><RelationsPanel entityId={entity.id} relations={entity.relations} entityTitleById={entityTitleById} targetOptions={relationTargetOptions} /></section><section><h2>Citações em outros arquivos</h2><BacklinksPanel backlinks={backlinks} /></section></footer>
  </main></div>
}

