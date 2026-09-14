'use server'

import { revalidatePath } from 'next/cache'
import { notFound, redirect, RedirectType } from 'next/navigation'
import { CONTENT_SCHEMA_VERSION } from '@/domain/content/contentDocument'
import { CharacterThemeSchema } from '@/domain/entities/characterTheme'
import { LocationPointsSchema } from '@/domain/entities/locationPoint'
import { EvidenceFindingsSchema } from '@/domain/entities/evidenceFinding'
import { OrganizationGroupsSchema } from '@/domain/entities/organizationGroup'
import { ArtifactDetailsSchema } from '@/domain/entities/artifactDetail'
import { ConceptBlocksSchema } from '@/domain/entities/conceptBlock'
import type { EntityTypeDefinition, PropertyDefinition } from '@/domain/entities/entityType'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

function parseListField(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string' || value.trim() === '') return []
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parsePropertyValue(property: PropertyDefinition, formData: FormData): unknown {
  switch (property.kind) {
    case 'number': {
      const raw = formData.get(property.key)
      return raw ? Number(raw) : undefined
    }
    case 'boolean':
      return formData.get(property.key) === 'on'
    case 'tags':
      return parseListField(formData.get(property.key))
    case 'referenceList':
      return formData.getAll(property.key).filter((value): value is string => typeof value === 'string' && value !== '')
    case 'image':
    case 'gallery':
      return undefined // not supported by the form yet — no seeded entity type uses these kinds
    case 'reference':
    case 'enum':
    case 'date':
    case 'textarea':
    case 'text':
    default: {
      const raw = formData.get(property.key)
      return typeof raw === 'string' && raw !== '' ? raw : undefined
    }
  }
}

function parseProperties(entityType: EntityTypeDefinition, formData: FormData): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  for (const property of entityType.properties) {
    const value = parsePropertyValue(property, formData)
    if (value !== undefined) properties[property.key] = value
  }
  return properties
}

export async function createEntityAction(formData: FormData): Promise<void> {
  const world = await getCurrentWorld()
  const typeId = String(formData.get('type') ?? '')
  const entityType = world.entityTypes.find((type) => type.id === typeId)
  if (!entityType) notFound()

  const title = String(formData.get('title') ?? '').trim()
  if (!title) throw new Error('O título é obrigatório')

  const entity = await getWorldRepository().createEntity(world.id, {
    type: entityType.id,
    title,
    aliases: parseListField(formData.get('aliases')),
    tags: parseListField(formData.get('tags')),
    ...(entityType.layout.includes('portraitHero') || entityType.id === 'location' || entityType.id === 'creature' || entityType.id === 'cosmology' || entityType.id === 'tale' ? { theme: CharacterThemeSchema.parse(formData.get('theme') ?? 'amber') } : {}),
  })

  revalidatePath(`/${entityType.id}`)
  revalidatePath('/boards', 'layout')
  revalidatePath('/scenes', 'layout')
  redirect(`/entity/${entity.id}/edit`, RedirectType.replace)
}

export async function updateEntityAction(entityId: string, formData: FormData): Promise<void> {
  const world = await getCurrentWorld()
  const repo = getWorldRepository()
  const entity = await repo.getEntity(world.id, entityId)
  if (!entity) notFound()
  const entityType = world.entityTypes.find((type) => type.id === entity.type)
  if (!entityType) notFound()

  const title = String(formData.get('title') ?? '').trim()
  if (!title) throw new Error('O título é obrigatório')

  const properties = parseProperties(entityType, formData)
  if (entity.type === 'location') {
    const rawPoints = formData.get('pointsOfInterest')
    properties.pointsOfInterest = LocationPointsSchema.parse(typeof rawPoints === 'string' ? JSON.parse(rawPoints) : [])
  }
  if (entity.type === 'evidence') {
    const rawFindings = formData.get('evidenceFindings')
    properties.evidenceFindings = EvidenceFindingsSchema.parse(typeof rawFindings === 'string' ? JSON.parse(rawFindings) : [])
  }
  if (entity.type === 'organization') {
    const rawGroups = formData.get('organizationGroups')
    properties.organizationGroups = OrganizationGroupsSchema.parse(typeof rawGroups === 'string' ? JSON.parse(rawGroups) : [])
  }
  if (entity.type === 'cosmology' && typeof entity.properties.symbolAssetId === 'string') {
    properties.symbolAssetId = entity.properties.symbolAssetId
  }
  if (entity.type === 'artifact') {
    const rawDetails = formData.get('artifactDetails')
    properties.artifactDetails = ArtifactDetailsSchema.parse(typeof rawDetails === 'string' ? JSON.parse(rawDetails) : [])
  }
  if (entity.type === 'concept') {
    const rawBlocks = formData.get('conceptBlocks')
    properties.conceptBlocks = ConceptBlocksSchema.parse(typeof rawBlocks === 'string' ? JSON.parse(rawBlocks) : [])
  }

  await repo.updateEntity(world.id, entityId, {
    title,
    aliases: parseListField(formData.get('aliases')),
    tags: parseListField(formData.get('tags')),
    status: String(formData.get('status') ?? '').trim(),
    ...(entityType.layout.includes('portraitHero') || entityType.id === 'location' || entityType.id === 'creature' || entityType.id === 'cosmology' || entityType.id === 'tale' ? { theme: CharacterThemeSchema.parse(formData.get('theme') ?? entity.theme ?? 'amber') } : {}),
    properties,
  })

  const rawContent = formData.get('content')
  if (typeof rawContent === 'string' && rawContent) {
    await repo.saveContent(world.id, entityId, {
      format: 'tiptap-json',
      schemaVersion: CONTENT_SCHEMA_VERSION,
      pages: JSON.parse(rawContent),
    })
  }

  revalidatePath(`/${entityType.id}`)
  revalidatePath(`/entity/${entityId}`)
  revalidatePath('/boards', 'layout')
  revalidatePath('/scenes', 'layout')
  redirect(`/entity/${entityId}`, RedirectType.replace)
}

export async function deleteEntityAction(entityId: string, entityTypeId: string): Promise<void> {
  const world = await getCurrentWorld()
  await getWorldRepository().deleteEntity(world.id, entityId)
  revalidatePath(`/${entityTypeId}`)
  revalidatePath('/boards', 'layout')
  revalidatePath('/scenes', 'layout')
  redirect(`/${entityTypeId}`, RedirectType.replace)
}
