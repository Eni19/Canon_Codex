import { notFound } from 'next/navigation'
import { EntityPage } from '@/components/entities/entity-page'
import { getSceneRepository, getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export async function EntityReadScreen({ entityId }: { entityId: string }) {
  const world = await getCurrentWorld()
  const repo = getWorldRepository()
  const entity = await repo.getEntity(world.id, entityId)
  if (!entity) notFound()
  const entityType = world.entityTypes.find((type) => type.id === entity.type)
  if (!entityType) notFound()

  const [content, backlinks] = await Promise.all([
    repo.getContent(world.id, entity.id),
    repo.getBacklinks(world.id, entity.id),
  ])

  const referencedIds = new Set<string>()
  for (const property of entityType.properties) {
    if (property.kind !== 'reference' && property.kind !== 'referenceList') continue
    const value = entity.properties[property.key]
    if (typeof value === 'string') referencedIds.add(value)
    if (Array.isArray(value)) value.forEach((id) => typeof id === 'string' && referencedIds.add(id))
  }
  for (const relation of entity.relations) referencedIds.add(relation.targetId)

  const entityTitleById: Record<string, string> = {}
  await Promise.all(
    [...referencedIds].map(async (id) => {
      const referenced = await repo.getEntity(world.id, id)
      if (referenced) entityTitleById[id] = referenced.title
    }),
  )

  const typeLabelById = new Map(world.entityTypes.map((type) => [type.id, type.label]))
  const allEntities = await repo.listEntities(world.id)
  const relationTargetOptions = allEntities
    .filter((candidate) => candidate.id !== entity.id)
    .map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      typeLabel: typeLabelById.get(candidate.type) ?? candidate.type,
    }))
  const relatedScenes = entity.type === 'location'
    ? (await getSceneRepository().listScenes(world.id)).filter((scene) => scene.background.locationId === entity.id)
    : []

  return (
    <EntityPage
      entity={entity}
      entityType={entityType}
      worldName={world.name}
      content={content}
      entityTitleById={entityTitleById}
      backlinks={backlinks}
      relationTargetOptions={relationTargetOptions}
      allEntities={allEntities}
      relatedScenes={relatedScenes}
      calendar={world.calendar}
    />
  )
}
