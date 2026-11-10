import { notFound } from 'next/navigation'
import { createEntityAction } from '@/app/actions/entities'
import { EntityEditor } from '@/components/entities/entity-editor/entity-editor'
import { getEntityEditorData } from '@/services/entities/getEntityEditorData'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export default async function NewEntityPage(props: PageProps<'/[entityType]/new'>) {
  const { entityType: entityTypeId } = await props.params
  const world = await getCurrentWorld()
  const entityType = world.entityTypes.find((type) => type.id === entityTypeId)
  if (!entityType) notFound()

  const data = await getEntityEditorData(world, entityType, null)
  return (
    <EntityEditor
      mode="create"
      entityType={entityType}
      worldName={world.name}
      calendar={world.calendar}
      hasOriginEvent={Boolean(world.originEventId)}
      data={data}
      action={createEntityAction}
    />
  )
}
