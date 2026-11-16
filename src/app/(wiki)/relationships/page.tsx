import { Breadcrumbs } from '@/components/wiki/breadcrumbs'
import { PageContainer } from '@/components/wiki/page-container'
import { RelationshipView } from '@/components/relations/relationship-view'
import { buildRelationshipGraph } from '@/domain/relations/relationshipGraph'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export default async function RelationshipsPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  const world = await getCurrentWorld()
  const repo = getWorldRepository()
  const [entities, settings] = await Promise.all([repo.listEntities(world.id), repo.getGraphSettings(world.id)])
  const graph = buildRelationshipGraph(entities)
  return <PageContainer>
    <Breadcrumbs items={[{ label: world.name, href: '/codex' }, { label: 'Relacionamentos' }]} />
    <h1 className="mt-3 font-serif text-2xl font-medium">Relacionamentos</h1>
    <RelationshipView key={world.id} entities={graph.entities} relations={graph.relations} initialFocus={(await searchParams).entity} initialSettings={settings} />
  </PageContainer>
}
