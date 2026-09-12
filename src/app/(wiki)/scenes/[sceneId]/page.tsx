import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { LocationPointsSchema } from '@/domain/entities/locationPoint'
import { SceneRunner } from '@/components/scenes/scene-runner'
import type { SceneEntitySummary, SceneNavigationSummary, ScenePoiSummary } from '@/components/scenes/scene-types'
import { getSceneRepository, getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'
export default async function ScenePage({ params, searchParams }: { params: Promise<{ sceneId: string }>; searchParams: Promise<{ mode?: string }> }) {
  await connection(); const [{ sceneId }, query] = await Promise.all([params, searchParams]), world = await getCurrentWorld(), repo = getWorldRepository()
  const [scene, entities, sceneList] = await Promise.all([getSceneRepository().getScene(world.id, sceneId), repo.listEntities(world.id), getSceneRepository().listScenes(world.id)])
  if (!scene) notFound(); const location = entities.find((e) => e.id === scene.background.locationId)
  const typeMap = new Map(world.entityTypes.map((t) => [t.id, t])); const entityMap = new Map(entities.map((e) => [e.id, e])); const allowed = new Set(['character', 'creature', 'organization', 'evidence', 'artifact'])
  const firstText = (properties: Record<string, unknown>, keys: string[]) => keys.map((key) => properties[key]).find((value): value is string => typeof value === 'string' && Boolean(value.trim()))?.trim()
  const tokenEntities: SceneEntitySummary[] = entities.filter((e) => allowed.has(e.type)).map((e) => { const type = typeMap.get(e.type); const fields = (type?.properties ?? []).flatMap((property) => { const raw = e.properties[property.key]; if (raw === undefined || raw === null || raw === '') return []; let value: string | undefined; if (typeof raw === 'boolean') value = raw ? 'Sim' : 'Não'; else if (typeof raw === 'string') value = entityMap.get(raw)?.title ?? raw; else if (typeof raw === 'number') value = String(raw); else if (Array.isArray(raw)) value = raw.flatMap((item) => typeof item === 'string' ? [entityMap.get(item)?.title ?? item] : typeof item === 'number' ? [String(item)] : []).join(', '); return value?.trim() ? [{ label: property.label, value, wide: property.kind === 'textarea' || value.length > 70 }] : [] }).slice(0, 8); return { id: e.id, title: e.title, type: e.type, typeLabel: type?.label ?? e.type, typeIcon: type?.icon ?? 'Circle', assetId: e.coverAssetId, subtitle: firstText(e.properties, ['occupation', 'profile', 'classification', 'organizationType', 'species']), status: e.status || undefined, aliases: e.aliases, tags: e.tags, fields } })
  const parsed = LocationPointsSchema.safeParse(location?.properties.pointsOfInterest)
  const pois: ScenePoiSummary[] = parsed.success ? parsed.data.map((p) => ({ id: p.id, label: p.label, x: p.x, y: p.y, description: p.basicDescription ?? p.description, linkedEntityId: p.targetId, kind: p.kind, contextualDescription: p.contextualDescription, discoveries: p.discoveries })) : []
  const scenes: SceneNavigationSummary[] = sceneList.map(({ id, title }) => ({ id, title }))
  return <SceneRunner key={scene.id} scene={scene} scenes={scenes} entities={tokenEntities} pois={pois} locationTitle={location?.title ?? 'Local indisponível'} initialMode={query.mode === 'presentation' ? 'presentation' : 'edit'} />
}
