import { notFound } from 'next/navigation'
import { createEntityAction } from '@/app/actions/entities'
import { EntityEditor } from '@/components/entities/entity-editor/entity-editor'
import { getEntityEditorData } from '@/services/entities/getEntityEditorData'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'
import { CalendarExactDateSchema, exactDateToOrdinal, type CalendarExactDate } from '@/domain/worlds/calendar-exact-date'

export default async function NewEntityPage(props: PageProps<'/[entityType]/new'>) {
  const { entityType: entityTypeId } = await props.params
  const query = await props.searchParams
  const world = await getCurrentWorld()
  const entityType = world.entityTypes.find((type) => type.id === entityTypeId)
  if (!entityType) notFound()

  let selectedDate: CalendarExactDate | undefined
  if (entityTypeId === 'event' && typeof query.date === 'string') {
    if (query.worldId !== world.id) return <p role="alert">O mundo ativo mudou. Volte ao calendário e escolha o dia novamente.</p>
    try {
      selectedDate = CalendarExactDateSchema.parse(JSON.parse(query.date))
      exactDateToOrdinal(world.calendar, selectedDate)
    } catch {
      return <p role="alert">A data selecionada não existe no calendário atual. Volte ao calendário e escolha outro dia.</p>
    }
  }

  const data = await getEntityEditorData(world, entityType, null)
  return (
    <EntityEditor
      mode="create"
      entityType={entityType}
      worldName={world.name}
      worldId={world.id}
      calendar={world.calendar}
      campaignToday={world.campaignToday}
      initialEventDate={selectedDate ?? world.campaignToday ?? undefined}
      initialTitle={entityTypeId === 'event' && query.sessionNote === '1' ? 'Nota de sessão' : undefined}
      hasOriginEvent={Boolean(world.originEventId)}
      data={data}
      action={createEntityAction}
    />
  )
}
