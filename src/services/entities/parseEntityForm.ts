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
export class EntityFormError extends Error {
  constructor(message: string, readonly fieldErrors: Record<string, string> = {}) {
    super(message)
  }
}

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
      if (!raw) return undefined
      const value = Number(raw)
      if (!Number.isFinite(value)) throw new EntityFormError('Informe um número válido.')
      return value
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

export function parseEntityForm(entityType: EntityTypeDefinition, formData: FormData, calendar: Calendar, previousProperties: Record<string, unknown> = {}): ParsedEntityForm {
  const title = String(formData.get('title') ?? '').trim()
  const fieldErrors: Record<string, string> = Object.create(null)
  if (!title) fieldErrors.title = 'Informe o título do registro.'

  function validate<T>(key: string, read: () => T): T | undefined {
    try {
      return read()
    } catch (error) {
      if (!(error instanceof EntityFormError)) throw error
      fieldErrors[key] = error.message
    }
  }

  const properties = { ...previousProperties }
  for (const property of entityType.properties) {
    // Unsupported media fields and legacy keys have no editable control.
    if (property.kind === 'image' || property.kind === 'gallery') continue
    const value = validate(property.key, () => parsePropertyValue(property, formData, calendar))
    if (value === undefined) delete properties[property.key]
    else properties[property.key] = value
  }

  const structured = STRUCTURED_FIELDS[entityType.id]
  if (structured && (formData.has(structured.key) || !(structured.key in previousProperties))) {
    const parsed = structured.schema.safeParse(validate(structured.key, () => parseJsonField(formData, structured.key)) ?? [])
    if (!parsed.success) fieldErrors[structured.key] = 'Revise os itens incompletos desta seção.'
    else properties[structured.key] = parsed.data
  }

  // Empty or default framing is not stored, so the page keeps following the default presentation.
  if (supportsCoverFraming(entityType)) {
    const raw = validate('coverFraming', () => parseJsonField(formData, 'coverFraming'))
    if (raw !== undefined) {
      const framing = CoverFramingSchema.safeParse(raw)
      if (!framing.success) {
        fieldErrors.coverFraming = 'Ajuste o enquadramento da imagem novamente.'
      } else {
        delete properties.coverFraming
        if (!isDefaultCoverFraming(framing.data, defaultCoverFraming(entityType))) properties.coverFraming = framing.data
      }
    }
  }

  const rawTheme = formData.get('theme')
  const rawContent = validate('content', () => parseJsonField(formData, 'content'))
  const theme = supportsTheme(entityType) && typeof rawTheme === 'string'
    ? CharacterThemeSchema.safeParse(rawTheme) : undefined
  if (theme && !theme.success) fieldErrors.theme = 'Selecione uma cor disponível.'
  const coverAssetId = supportsCover(entityType) ? validate('coverAssetId', () => parseAssetField(formData, 'coverAssetId')) : undefined
  const symbolAssetId = supportsSymbol(entityType) ? validate('symbolAssetId', () => parseAssetField(formData, 'symbolAssetId')) : undefined

  if (Object.keys(fieldErrors).length) {
    throw new EntityFormError('Revise os campos indicados antes de salvar.', { ...fieldErrors })
  }

  return {
    title,
    aliases: parseListField(formData.get('aliases')),
    tags: parseListField(formData.get('tags')),
    status: supportsStatus(entityType) && formData.has('status') ? String(formData.get('status') ?? '').trim() : undefined,
    theme: theme?.data,
    properties,
    coverAssetId,
    symbolAssetId,
    content: Array.isArray(rawContent) ? { format: 'tiptap-json', schemaVersion: CONTENT_SCHEMA_VERSION, pages: rawContent } : undefined,
  }
}
