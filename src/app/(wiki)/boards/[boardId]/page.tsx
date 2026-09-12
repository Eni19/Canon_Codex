import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { InvestigationBoard } from '@/components/boards/investigation-board'
import type { BoardEntitySummary } from '@/components/boards/board-types'
import { getBoardRepository, getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

function firstText(properties: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = properties[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
}

export default async function BoardPage({ params }: PageProps<'/boards/[boardId]'>) {
  await connection()
  const { boardId } = await params
  const world = await getCurrentWorld()
  const [board, entities] = await Promise.all([
    getBoardRepository().getBoard(world.id, boardId),
    getWorldRepository().listEntities(world.id),
  ])
  if (!board) notFound()
  const typeById = new Map(world.entityTypes.map((type) => [type.id, type]))
  const entityById = new Map(entities.map((entity) => [entity.id, entity]))
  const summaries: BoardEntitySummary[] = entities.map((entity) => {
    const type = typeById.get(entity.type)
    const fields = (type?.properties ?? []).flatMap((property) => {
      const raw = entity.properties[property.key]
      if (raw === undefined || raw === null || raw === '') return []
      let value: string | undefined
      if (typeof raw === 'boolean') value = raw ? 'Sim' : 'Não'
      else if (typeof raw === 'string') value = entityById.get(raw)?.title ?? raw
      else if (typeof raw === 'number') value = String(raw)
      else if (Array.isArray(raw)) {
        const readable = raw.flatMap((item) => typeof item === 'string' ? [entityById.get(item)?.title ?? item] : typeof item === 'number' ? [String(item)] : [])
        value = readable.join(', ')
      }
      if (!value?.trim()) return []
      return [{ label: property.label, value, wide: property.kind === 'textarea' || value.length > 70 }]
    }).slice(0, 8)
    return {
      id: entity.id,
      type: entity.type,
      typeLabel: type?.label ?? entity.type,
      typeIcon: type?.icon ?? 'Circle',
      title: entity.title,
      subtitle: firstText(entity.properties, ['occupation', 'profile', 'classification', 'locationType', 'organizationType', 'eventType', 'phenomenonType', 'species']),
      thumbnailAssetId: entity.coverAssetId,
      status: entity.status || undefined,
      aliases: entity.aliases,
      tags: entity.tags,
      fields,
    }
  })

  return <InvestigationBoard board={board} entities={summaries} />
}
