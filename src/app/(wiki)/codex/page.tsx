import Link from 'next/link'
import { ArrowRight, Clock3, Layers3 } from 'lucide-react'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import { PageContainer } from '@/components/wiki/page-container'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'
import styles from './codex-home.module.css'

const principalIds = new Set(['character', 'location', 'organization', 'creature', 'artifact', 'cosmology', 'species', 'naturalScience'])

export default async function HomePage() {
  const world = await getCurrentWorld()
  const entities = await getWorldRepository().listEntities(world.id)
  const visibleTypes = world.entityTypes.filter((type) => type.showInSidebar)
  const countsByType = new Map<string, number>()
  for (const entity of entities) countsByType.set(entity.type, (countsByType.get(entity.type) ?? 0) + 1)

  const principal = visibleTypes.filter((type) => principalIds.has(type.id))
  const archives = visibleTypes.filter((type) => !principalIds.has(type.id))
  const typeById = new Map(world.entityTypes.map((type) => [type.id, type]))
  const recent = [...entities].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6)

  return (
    <PageContainer className="max-w-6xl">
      <div className={styles.home}>
        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>Arquivo ativo · Canon Codex</p>
            <h1>{world.name}</h1>
            <p className={styles.description}>{world.description || 'Um arquivo em construção, pronto para receber os registros deste universo.'}</p>
          </div>
          <div className={styles.summary}>
            <div><small>Registros</small><strong>{String(entities.length).padStart(2, '0')}</strong></div>
            <div><small>Categorias</small><strong>{String(visibleTypes.length).padStart(2, '0')}</strong></div>
            <Link href="/all">Abrir índice completo<ArrowRight /></Link>
          </div>
        </header>

        <div className={styles.workspace}>
          <main className={styles.index}>
            <div className={styles.sectionHeading}><span><Layers3 />Índice do arquivo</span><i /></div>
            <CategorySection label="Registros principais" types={principal} counts={countsByType} />
            {archives.length > 0 && <CategorySection label="Narrativas e ocorrências" types={archives} counts={countsByType} />}
          </main>

          <aside className={styles.recent}>
            <header><Clock3 /><div><small>Movimentação do arquivo</small><h2>Registros recentes</h2></div></header>
            {recent.length > 0 ? <ol>{recent.map((entity, index) => {
              const type = typeById.get(entity.type)
              return <li key={entity.id}>
                <Link href={`/entity/${entity.id}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span><small>{type?.label ?? 'Registro'}</small><strong>{entity.title}</strong></span>
                  <ArrowRight />
                </Link>
              </li>
            })}</ol> : <p className={styles.emptyRecent}>Os registros recém-criados aparecerão aqui.</p>}
          </aside>
        </div>
      </div>
    </PageContainer>
  )
}

function CategorySection({ label, types, counts }: { label: string; types: EntityTypeDefinition[]; counts: Map<string, number> }) {
  if (types.length === 0) return null
  return <section className={styles.categorySection}>
    <h2>{label}</h2>
    <div>{types.map((type, index) => <Link key={type.id} href={`/${type.id}`} className={styles.categoryRow}>
      <span className={styles.categoryNumber}>{String(index + 1).padStart(2, '0')}</span>
      <span className={styles.categoryIcon}><EntityTypeIcon name={type.icon} /></span>
      <span className={styles.categoryName}><strong>{type.pluralLabel}</strong><small>{counts.get(type.id) ?? 0} {counts.get(type.id) === 1 ? 'registro' : 'registros'}</small></span>
      <span className={styles.categoryArrow}><ArrowRight /></span>
    </Link>)}</div>
  </section>
}
