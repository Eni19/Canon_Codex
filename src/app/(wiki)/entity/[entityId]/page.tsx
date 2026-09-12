import { EntityReadScreen } from '@/components/entities/entity-read-screen'
import { PageProjectionButton } from '@/components/projection/page-projection-button'

export default async function EntityReadPage(props: PageProps<'/entity/[entityId]'>) {
  const { entityId } = await props.params

  return (
    <>
      <EntityReadScreen entityId={entityId} />
      <PageProjectionButton entityId={entityId} />
    </>
  )
}
