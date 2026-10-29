import 'server-only'
import { emptyContentDocument, type ContentDocument } from '@/domain/content/contentDocument'
import type { Entity } from '@/domain/entities/entity'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import type { World } from '@/domain/worlds/world'
import type { ReferenceOption } from '@/components/entities/property-field'
import type { LocationPointTarget } from '@/components/entities/location-points-editor'
import { getWorldRepository } from '@/repositories'

export interface EntityEditorData {
  referenceOptionsByKey: Record<string, ReferenceOption[]>
  initialSelections: Record<string, string[]>
  pointTargets: LocationPointTarget[]
  content: ContentDocument
}

/** Everything the entity form needs besides the record itself; `entity` is null when creating. */
export async function getEntityEditorData(world: World, entityType: EntityTypeDefinition, entity: Entity | null): Promise<EntityEditorData> {
  const repo = getWorldRepository()
  const allEntities = await repo.listEntities(world.id)
  const typeLabels = new Map(world.entityTypes.map((type) => [type.id, type.label]))

  const referenceOptionsByKey: Record<string, ReferenceOption[]> = {}
  const initialSelections: Record<string, string[]> = {}
  for (const property of entityType.properties) {
    if (property.kind !== 'reference' && property.kind !== 'referenceList') continue
    if (property.kind === 'referenceList') {
      const raw = entity?.properties[property.key]
      initialSelections[property.key] = Array.isArray(raw) ? raw.filter((value): value is string => typeof value === 'string') : []
    }
    if (!property.refType) continue
    referenceOptionsByKey[property.key] = allEntities
      .filter((candidate) => candidate.type === property.refType && candidate.id !== entity?.id)
      .sort((left, right) => left.title.localeCompare(right.title, 'pt-BR'))
      .map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        subtitle: typeLabels.get(candidate.type),
        imageAssetId: candidate.coverAssetId ?? candidate.galleryAssetIds?.[0],
        imagePosition: candidate.type === 'character' || candidate.type === 'creature' ? 'top' as const : 'center' as const,
      }))
  }

  const pointTargets: LocationPointTarget[] = entityType.id === 'location'
    ? allEntities
        .filter((candidate) => candidate.type === 'evidence' || candidate.type === 'document')
        .map((candidate) => ({ id: candidate.id, title: candidate.title, type: candidate.type as 'evidence' | 'document' }))
    : []

  const content = entity ? await repo.getContent(world.id, entity.id) : emptyContentDocument()
  return { referenceOptionsByKey, initialSelections, pointTargets, content }
}
