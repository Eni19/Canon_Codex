import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { EntityCard } from '@/components/entities/entity-card'
import { PageContainer } from '@/components/wiki/page-container'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export default async function AllEntitiesPage() {
  const world = await getCurrentWorld()
  const entities = await getWorldRepository().listEntities(world.id)
  const entityTypeById = new Map(world.entityTypes.map((type) => [type.id, type]))

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: world.name, href: '/codex' }, { label: 'Todos os conteúdos' }]} />
      <h1 className="mt-3 font-serif text-2xl font-medium">Todos os conteúdos</h1>

      {entities.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">Nenhuma entidade criada ainda.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {entities.map((entity) => {
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

