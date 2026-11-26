import { NotebookLoader } from '@/components/codex-notebook/notebook-loader'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

/** Polaroids a record-type spread can hold. */
const RECENT_PER_TYPE = 4
const RECENT_OVERALL = 6

export default async function HomePage(props: PageProps<'/codex'>) {
  const { pagina } = await props.searchParams
  const world = await getCurrentWorld()
  const entities = await getWorldRepository().listEntities(world.id)
  const newestFirst = [...entities].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const toRecord = (entity: (typeof entities)[number]) => ({ id: entity.id, title: entity.title, coverAssetId: entity.coverAssetId })

  const types = world.entityTypes
    .filter((type) => type.showInSidebar)
    .map((type) => {
      const ofType = newestFirst.filter((entity) => entity.type === type.id)
      return {
        id: type.id,
        label: type.label,
        pluralLabel: type.pluralLabel,
        icon: type.icon,
        count: ofType.length,
        recent: ofType.slice(0, RECENT_PER_TYPE).map(toRecord),
      }
    })
  const labelByType = new Map(world.entityTypes.map((type) => [type.id, type.label]))

  return <NotebookLoader
    initialSpread={typeof pagina === 'string' ? pagina : undefined}
    types={types}
    world={{
      name: world.name,
      description: world.description,
      recordCount: entities.length,
      createdYear: world.createdAt.slice(0, 4),
      recent: newestFirst.slice(0, RECENT_OVERALL).map((entity) => ({
        ...toRecord(entity),
        typeLabel: labelByType.get(entity.type) ?? 'Registro',
        href: `/entity/${entity.id}`,
      })),
    }}
  />
}
