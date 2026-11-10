import { z } from 'zod'
import { CONTENT_SCHEMA_VERSION, type ContentDocument } from '@/domain/content/contentDocument'
import { CharacterThemeSchema, type CharacterTheme } from '@/domain/entities/characterTheme'
import { ArtifactDetailsSchema } from '@/domain/entities/artifactDetail'
import { ConceptBlocksSchema } from '@/domain/entities/conceptBlock'
import { EvidenceFindingsSchema } from '@/domain/entities/evidenceFinding'
import { LocationPointsSchema } from '@/domain/entities/locationPoint'
import { OrganizationGroupsSchema } from '@/domain/entities/organizationGroup'
import { CoverFramingSchema, defaultCoverFraming, isDefaultCoverFraming } from '@/domain/entities/coverFraming'
import { supportsCover, supportsCoverFraming, supportsStatus, supportsSymbol, supportsTheme } from '@/domain/entities/entityFormRules'
import type { EntityTypeDefinition, PropertyDefinition } from '@/domain/entities/entityType'
import { parseStoredDateValue } from '@/domain/worlds/calendar-date'
import type { Calendar } from '@/domain/worlds/calendar'

/** A problem the person filling the form can fix; actions show it inline instead of crashing. */
export class EntityFormError extends Error {}

/**
 * Asset fields: `undefined` = field not sent (leave as is), `null` = cleared, string = asset id.
 * The form uploads images to the world's asset store first and only submits their ids.
 */
export type AssetFieldValue = string | null | undefined

export interface ParsedEntityForm {
  title: string
  aliases: string[]
  tags: string[]
  status?: string
  theme?: CharacterTheme
  properties: Record<string, unknown>
  coverAssetId: AssetFieldValue
  symbolAssetId: AssetFieldValue
  content?: ContentDocument
}

export function parseListField(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string' || value.trim() === '') return []
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parsePropertyValue(property: PropertyDefinition, formData: FormData, calendar: Calendar): unknown {
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
    case 'enum': {
      const raw = formData.get(property.key)
      return typeof raw === 'string' && raw !== '' ? raw : undefined
    }
    case 'date': {
      const raw = formData.get(property.key)
      if (typeof raw !== 'string' || raw.trim() === '') return undefined
      let input: unknown = raw
      if (raw.trim().startsWith('{')) {
        try {
          input = JSON.parse(raw)
        } catch {
          throw new EntityFormError(`${property.label}: o valor da data não é um JSON válido.`)
        }
      }
      const parsed = parseStoredDateValue(calendar, input)
      if (!parsed.success) throw new EntityFormError(`${property.label}: ${parsed.error}`)
      return parsed.data
    }
    case 'textarea':
    case 'text':
    default: {
      const raw = formData.get(property.key)
      return typeof raw === 'string' && raw !== '' ? raw : undefined
    }
  }
}

/** Structured editors serialize their value as JSON into one hidden field each. */
const STRUCTURED_FIELDS: Record<string, { key: string; schema: z.ZodType }> = {
  location: { key: 'pointsOfInterest', schema: LocationPointsSchema },
  evidence: { key: 'evidenceFindings', schema: EvidenceFindingsSchema },
  organization: { key: 'organizationGroups', schema: OrganizationGroupsSchema },
  artifact: { key: 'artifactDetails', schema: ArtifactDetailsSchema },
  concept: { key: 'conceptBlocks', schema: ConceptBlocksSchema },
}

function parseJsonField(formData: FormData, key: string): unknown {
  const raw = formData.get(key)
  if (typeof raw !== 'string' || raw === '') return undefined
  try {
    return JSON.parse(raw)
  } catch {
    throw new EntityFormError(`O campo ${key} não pôde ser lido. Recarregue a página e tente novamente.`)
  }
}

function parseAssetField(formData: FormData, key: string): AssetFieldValue {
  if (!formData.has(key)) return undefined
  const raw = String(formData.get(key) ?? '').trim()
  if (raw === '') return null
  if (!z.uuid().safeParse(raw).success) throw new EntityFormError('A imagem enviada não é válida. Envie-a novamente.')
  return raw
}

export function parseEntityForm(entityType: EntityTypeDefinition, formData: FormData, calendar: Calendar): ParsedEntityForm {
  const title = String(formData.get('title') ?? '').trim()
  if (!title) throw new EntityFormError('O título é obrigatório.')

  const properties: Record<string, unknown> = {}
  for (const property of entityType.properties) {
    const value = parsePropertyValue(property, formData, calendar)
    if (value !== undefined) properties[property.key] = value
  }

  const structured = STRUCTURED_FIELDS[entityType.id]
  if (structured) {
    const parsed = structured.schema.safeParse(parseJsonField(formData, structured.key) ?? [])
    if (!parsed.success) throw new EntityFormError('Há itens incompletos no editor desta página. Revise-os e salve de novo.')
    properties[structured.key] = parsed.data
  }

  // Empty or default framing is not stored, so the page keeps following the default presentation.
  if (supportsCoverFraming(entityType)) {
    const raw = parseJsonField(formData, 'coverFraming')
    if (raw !== undefined) {
      const framing = CoverFramingSchema.safeParse(raw)
      if (!framing.success) throw new EntityFormError('O enquadramento da imagem é inválido. Ajuste-o novamente.')
      if (!isDefaultCoverFraming(framing.data, defaultCoverFraming(entityType))) properties.coverFraming = framing.data
    }
  }

  const rawTheme = formData.get('theme')
  const rawContent = parseJsonField(formData, 'content')

  return {
    title,
    aliases: parseListField(formData.get('aliases')),
    tags: parseListField(formData.get('tags')),
    status: supportsStatus(entityType) && formData.has('status') ? String(formData.get('status') ?? '').trim() : undefined,
    theme: supportsTheme(entityType) && typeof rawTheme === 'string' ? CharacterThemeSchema.parse(rawTheme) : undefined,
    properties,
    coverAssetId: supportsCover(entityType) ? parseAssetField(formData, 'coverAssetId') : undefined,
    symbolAssetId: supportsSymbol(entityType) ? parseAssetField(formData, 'symbolAssetId') : undefined,
    content: Array.isArray(rawContent) ? { format: 'tiptap-json', schemaVersion: CONTENT_SCHEMA_VERSION, pages: rawContent } : undefined,
  }
}
