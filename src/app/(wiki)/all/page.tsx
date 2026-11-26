import Link from 'next/link'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { EntityCard } from '@/components/entities/entity-card'
import { PageContainer } from '@/components/wiki/page-container'
import { collectTags, filterByTags, tagKey } from '@/domain/entities/entityTags'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

type Query = { tag?: string | string[] }

const tagUrl = (tags: string[]) => tags.length ? `/all?${new URLSearchParams(tags.map((tag) => ['tag', tag]))}` : '/all'

export default async function AllEntitiesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [world, query] = await Promise.all([getCurrentWorld(), searchParams])
  const entities = await getWorldRepository().listEntities(world.id)
  const entityTypeById = new Map(world.entityTypes.map((type) => [type.id, type]))
  const requested = query.tag === undefined ? [] : Array.isArray(query.tag) ? query.tag : [query.tag]
  const selected = requested.filter((tag, index) => tag.trim() && requested.findIndex((other) => tagKey(other) === tagKey(tag)) === index)
  const selectedKeys = new Set(selected.map(tagKey))
  const visible = filterByTags(entities, selected)
  // Etiquetas oferecidas: as que ainda restringem o resultado atual, mais as já escolhidas.
  const available = collectTags(visible).filter(({ tag }) => !selectedKeys.has(tagKey(tag)))

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: world.name, href: '/codex' }, { label: 'Todos os conteúdos' }]} />
      <h1 className="mt-3 font-serif text-2xl font-medium">Todos os conteúdos</h1>

      {(selected.length > 0 || available.length > 0) && (
        <nav aria-label="Filtrar por etiquetas" className="mt-4 space-y-2 text-sm">
          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Filtrando por</span>
              {selected.map((tag) => (
                <Link key={tag} href={tagUrl(selected.filter((item) => item !== tag))} aria-label={`Remover etiqueta ${tag}`}
                  className="rounded-full border border-primary bg-primary/10 px-3 py-1">
                  {tag} <span aria-hidden="true">×</span>
                </Link>
              ))}
              <Link href="/all" className="underline underline-offset-4">Limpar</Link>
            </div>
          )}
          {available.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label={selected.length ? 'Refinar por outra etiqueta' : 'Etiquetas'}>
              {available.slice(0, 40).map(({ tag, count }) => (
                <li key={tag}>
                  <Link href={tagUrl([...selected, tag])} aria-label={`Filtrar por ${tag}, ${count} ${count === 1 ? 'registro' : 'registros'}`}
                    className="inline-block rounded-full border px-3 py-1 hover:bg-muted">
                    {tag} <span className="text-muted-foreground">{count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>
      )}

      {selected.length > 0 && <p role="status" className="mt-4 text-sm text-muted-foreground">{visible.length === 1 ? '1 registro' : `${visible.length} registros`} com {selected.length === 1 ? 'esta etiqueta' : 'estas etiquetas'}.</p>}

      {entities.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">Nenhuma entidade criada ainda.</p>
      ) : visible.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">Nenhum registro tem todas as etiquetas escolhidas.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((entity) => {
            const entityType = entityTypeById.get(entity.type)
            return entityType ? (
              <EntityCard key={entity.id} entity={entity} entityType={entityType} showTypeLabel />
            ) : null
          })}
        </div>
      )}
    </PageContainer>
  )
}
