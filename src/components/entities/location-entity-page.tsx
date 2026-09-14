import Link from 'next/link'
import { MapPin, Pencil, UserRound } from 'lucide-react'
import { ContentRenderer } from '@/components/editor/content-renderer'
import { LocationBlueprint } from '@/components/entities/location-blueprint'
import { PropertyDisplayList } from '@/components/entities/property-display-list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { LocationPointsSchema } from '@/domain/entities/locationPoint'
import type { EntityPageProps } from '@/components/entities/entity-page'
import styles from './location-blueprint.module.css'

export function LocationEntityPage({ entity, entityType, worldName, content, entityTitleById, allEntities, relatedScenes }: EntityPageProps) {
  const parsedPoints = LocationPointsSchema.safeParse(entity.properties.pointsOfInterest)
  const points = parsedPoints.success ? parsedPoints.data : []
  const childLocations = allEntities.filter((candidate) => candidate.type === 'location' && candidate.properties.parentLocation === entity.id)
  const presentCharacters = allEntities.filter((candidate) => candidate.type === 'character' && candidate.properties.currentLocation === entity.id)
  const titleById = { ...entityTitleById, ...Object.fromEntries(allEntities.map((candidate) => [candidate.id, candidate.title])) }
  const visibleProperties = entityType.properties

  return (
    <div data-character-theme={entity.theme ?? 'amber'} className={styles.desk}>
      <div className="mx-auto max-w-[100rem] px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <Breadcrumbs items={[{ label: worldName, href: '/codex' }, { label: entityType.pluralLabel, href: `/${entityType.id}` }, { label: entity.title }]} />
            <div className="mt-3 flex items-center gap-3"><MapPin className="size-5 text-primary" /><h1 className="font-serif text-4xl font-medium uppercase text-primary">{entity.title}</h1>{entity.status && <Badge variant="outline">{entity.status}</Badge>}</div>
          </div>
          <Button asChild variant="outline" size="sm"><Link replace href={`/entity/${entity.id}/edit`}><Pencil className="size-4" />Editar</Link></Button>
        </div>

        <div className={styles.layout}>
          <div className={styles.copy}>
            {visibleProperties.length > 0 && <section className="mb-7"><h2 className={styles.sectionTitle}>Dados do local</h2><PropertyDisplayList properties={visibleProperties} values={entity.properties} entityTitleById={titleById} /></section>}
            <section className="mb-7"><h2 className={styles.sectionTitle}>Registro</h2><ContentRenderer content={content} /></section>
            <section className="mb-7"><h2 className={styles.sectionTitle}>Sub-regiões</h2>
              {childLocations.length ? <div className={styles.cards}>{childLocations.map((child) => <Link key={child.id} href={`/entity/${child.id}`} className={styles.card}><span className="font-serif text-primary">{child.title}</span><p className="mt-1 text-xs text-muted-foreground">Abrir região filha</p></Link>)}</div> : <p className="text-sm text-muted-foreground">Nenhuma sub-região vinculada.</p>}
            </section>
            <section className="mb-7"><h2 className={styles.sectionTitle}>Personagens neste local</h2>
              {presentCharacters.length ? <div className={styles.cards}>{presentCharacters.map((character) => <Link key={character.id} href={`/entity/${character.id}`} className={styles.card}><span className="flex items-center gap-2 font-serif text-primary"><UserRound className="size-4" />{character.title}</span></Link>)}</div> : <p className="text-sm text-muted-foreground">Nenhum personagem marcado neste local.</p>}
            </section>
            <section className="mb-7"><h2 className={styles.sectionTitle}>Cenas</h2>
              {relatedScenes.length ? <div className={styles.cards}>{relatedScenes.map((scene) => <Link key={scene.id} href={`/scenes/${scene.id}`} className={styles.card}><span className="flex items-center gap-2 font-serif text-primary">{scene.title}</span><p className="mt-1 text-xs text-muted-foreground">Abrir no Scene Runner</p></Link>)}</div> : <p className="text-sm text-muted-foreground">Nenhuma cena preparada neste local.</p>}
            </section>
          </div>
          <aside className={styles.boardSlot}><LocationBlueprint coverAssetId={entity.coverAssetId} points={points} titleById={titleById} /></aside>
        </div>
      </div>
    </div>
  )
}

