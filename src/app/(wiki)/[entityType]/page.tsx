import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { EntityCatalog } from '@/components/entities/entity-catalog'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/wiki/page-container'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export default async function EntityTypeListingPage(props: PageProps<'/[entityType]'>) {
  const { entityType: entityTypeId } = await props.params
  const world = await getCurrentWorld()
  const entityType = world.entityTypes.find((type) => type.id === entityTypeId)
  if (!entityType) notFound()

  const repo = getWorldRepository()
  const entities = await repo.listEntities(world.id, { type: entityType.id })
  const relatedEntities = entityType.id === 'character'
    ? (await Promise.all([
        repo.listEntities(world.id, { type: 'organization' }),
        repo.listEntities(world.id, { type: 'location' }),
      ])).flat()
    : []

  return (
    <PageContainer className="max-w-6xl">
      <Breadcrumbs items={[{ label: world.name, href: '/codex' }, { label: entityType.pluralLabel }]} />

      <header className="mt-4 flex items-end justify-between gap-4 border-b border-border pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center bg-primary text-primary-foreground [clip-path:polygon(0_0,78%_0,100%_22%,100%_100%,0_100%)]">
            <EntityTypeIcon name={entityType.icon} className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[0.58rem] tracking-[0.18em] text-primary uppercase">Catálogo do arquivo</p>
            <h1 className="truncate font-serif text-3xl font-medium">{entityType.pluralLabel}</h1>
          </div>
        </div>
        <Button asChild size="sm" className="rounded-sm">
          <Link href={`/${entityType.id}/new`}>
            <Plus className="size-4" />
            Nova entidade
          </Link>
        </Button>
      </header>

      {entities.length === 0 ? (
        <div className="mt-8 border border-dashed border-border py-16 text-center">
          <EntityTypeIcon name={entityType.icon} className="mx-auto size-7 text-primary/65" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum(a) {entityType.label.toLowerCase()} criado(a) ainda.</p>
        </div>
      ) : (
        <EntityCatalog entities={entities} relatedEntities={relatedEntities} entityType={entityType} />
      )}
    </PageContainer>
  )
}