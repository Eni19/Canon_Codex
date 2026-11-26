import { RelationshipView } from '@/components/relations/relationship-view'
import { buildRelationshipGraph } from '@/domain/relations/relationshipGraph'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export default async function RelationshipsPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  const world = await getCurrentWorld()
  const repo = getWorldRepository()
  const data = await Promise.all([repo.listEntities(world.id), repo.getGraphSettings(world.id)]).catch(() => null)
  if (!data) {
    return <section className="absolute inset-0 grid place-content-center gap-2 p-4 text-center">
      <h1 className="text-xl">Relacionamentos</h1>
      <p role="alert">Não foi possível carregar o grafo.</p>
      <form action="/relationships"><button className="text-primary underline">Tentar novamente</button></form>
    </section>
  }
  const [entities, settings] = data
  const graph = buildRelationshipGraph(entities)
  const { entity } = await searchParams
  const typeLabels = Object.fromEntries(world.entityTypes.map((type) => [type.id, type.label]))
  return <RelationshipView key={world.id} entities={graph.entities} relations={graph.relations} initialFocus={entity} initialSettings={settings} typeLabels={typeLabels} />
}
