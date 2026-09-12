import { EntityReadScreen } from '@/components/entities/entity-read-screen'
import { SimplePageProjection } from '@/components/projection/simple-page-projection'

export default async function EntityProjectionPage(props: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await props.params

  return (
    <SimplePageProjection>
      <EntityReadScreen entityId={entityId} />
    </SimplePageProjection>
  )
}
