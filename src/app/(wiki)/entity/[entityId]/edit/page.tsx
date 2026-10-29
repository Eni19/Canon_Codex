import { notFound } from 'next/navigation'
import { deleteEntityAction, updateEntityAction } from '@/app/actions/entities'
import { EntityEditor } from '@/components/entities/entity-editor/entity-editor'
import { getWorldRepository } from '@/repositories'
import { getEntityEditorData } from '@/services/entities/getEntityEditorData'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export default async function EditEntityPage(props: PageProps<'/entity/[entityId]/edit'>) {
  const { entityId } = await props.params
  const world = await getCurrentWorld()
  const entity = await getWorldRepository().getEntity(world.id, entityId)
  if (!entity) notFound()
  const entityType = world.entityTypes.find((type) => type.id === entity.type)
  if (!entityType) notFound()

  const data = await getEntityEditorData(world, entityType, entity)
  return (
    <EntityEditor
      mode="edit"
      entityType={entityType}
      entity={entity}
      worldName={world.name}
      calendar={world.calendar}
      hasOriginEvent={Boolean(world.originEventId)}
      data={data}
      action={updateEntityAction.bind(null, entity.id)}
      deleteAction={deleteEntityAction.bind(null, entity.id, entityType.id)}
    />
  )
}
