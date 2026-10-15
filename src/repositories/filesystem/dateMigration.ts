import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { EntitySchema, type Entity } from '@/domain/entities/entity'
import type { DateMigrationExample, DateMigrationPreview } from '@/domain/worlds/dateMigration'
import { getCalendarDateAtOrdinal } from '@/domain/worlds/calendar'
import { legacyIsoDateToOrdinal, parseLegacyIsoDate, validateCalendarDateValue } from '@/domain/worlds/calendar-date'
import { atomicWriteJson, atomicWriteText, ensureDir, pathExists } from '@/lib/fs/atomicWrite'
import { getEntitiesDir, getTrashDir, getWorldDir } from '@/lib/fs/paths'
import { migrateToLatest, readMigratedJson } from '@/lib/migrations/registry'
import { entityMigrations } from './migrations'
import { withWorldWriteLock } from './worldWriteLock'
import { readWorldByDir, resolveWorldDir } from './worldDirRegistry'

const MetadataPathSchema = z.string().regex(/^(?:entities[\\/][0-9a-f-]{36}|trash[\\/]entity-[0-9a-f-]{36}-\d+)[\\/]metadata\.json$/i)
const MigrationEntrySchema = z.object({
  relativePath: MetadataPathSchema,
  originalText: z.string(),
  convertedText: z.string(),
})
const MigrationExampleSchema = z.object({
  entityId: z.uuid(), title: z.string(), type: z.string(), field: z.string(),
  before: z.string(), after: z.string().optional(), reason: z.string().optional(), trashed: z.boolean(),
})
const MigrationManifestSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  id: z.uuid(), worldId: z.uuid(), createdAt: z.iso.datetime(),
  state: z.enum(['applying', 'completed', 'restoring', 'restored']),
  sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  completionFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  entries: z.array(MigrationEntrySchema),
  report: z.object({
    total: z.number().int().nonnegative(), convertible: z.number().int().nonnegative(),
    invalid: z.number().int().nonnegative(),
    examples: z.array(MigrationExampleSchema), problems: z.array(MigrationExampleSchema),
  }),
})
type MigrationEntry = z.infer<typeof MigrationEntrySchema>
type MigrationManifest = z.infer<typeof MigrationManifestSchema>

interface ScannedEntity { relativePath: string; text: string; entity: Entity; trashed: boolean }

async function scan(worldDir: string): Promise<ScannedEntity[]> {
  const root = getWorldDir(worldDir)
  const files: { file: string; trashed: boolean }[] = []
  for (const [directory, trashed] of [[getEntitiesDir(worldDir), false], [getTrashDir(worldDir), true]] as const) {
    if (!(await pathExists(directory))) continue
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || (trashed && !entry.name.startsWith('entity-'))) continue
      const file = path.join(directory, entry.name, 'metadata.json')
      if (await pathExists(file)) files.push({ file, trashed })
    }
  }
  files.sort((a, b) => a.file.localeCompare(b.file))
  return Promise.all(files.map(async ({ file, trashed }) => ({
    relativePath: path.relative(root, file),
    text: await readFile(file, 'utf8'),
    entity: await readMigratedJson(file, entityMigrations, EntitySchema),
    trashed,
  })))
}

function migrationDir(worldDir: string): string { return path.join(getWorldDir(worldDir), 'date-migrations') }
function manifestPath(worldDir: string, id: string): string {
  if (!z.uuid().safeParse(id).success) throw new Error('Identificador de backup inválido.')
  return path.join(migrationDir(worldDir), `${id}.json`)
}
async function readManifest(file: string): Promise<MigrationManifest> {
  return validateManifest(JSON.parse(await readFile(file, 'utf8')))
}
async function writeManifest(worldDir: string, manifest: MigrationManifest): Promise<void> {
  await atomicWriteJson(manifestPath(worldDir, manifest.id), validateManifest(manifest))
}
function validateManifest(input: unknown): MigrationManifest {
  const manifest = MigrationManifestSchema.parse(input)
  for (const entry of manifest.entries) {
    const original = EntitySchema.parse(migrateToLatest(entityMigrations,
      z.record(z.string(), z.unknown()).parse(JSON.parse(entry.originalText))))
    const converted = EntitySchema.parse(JSON.parse(entry.convertedText))
    const parts = entry.relativePath.split(/[\\/]/)
    const pathEntityId = parts[0] === 'entities' ? parts[1] : parts[1].slice('entity-'.length, 'entity-'.length + 36)
    if (original.id !== converted.id || original.worldId !== manifest.worldId || converted.worldId !== manifest.worldId
      || pathEntityId !== original.id) {
      throw new Error('O manifesto contém um registro de outro mundo ou um caminho incompatível.')
    }
  }
  return manifest
}
function metadataPath(worldDir: string, relativePath: string): string {
  const validated = MetadataPathSchema.parse(relativePath)
  const root = getWorldDir(worldDir)
  const file = path.resolve(root, validated)
  if (!file.startsWith(root + path.sep)) throw new Error('Caminho de backup inválido.')
  return file
}
async function manifests(worldDir: string): Promise<MigrationManifest[]> {
  const dir = migrationDir(worldDir)
  if (!(await pathExists(dir))) return []
  const names = (await readdir(dir)).filter((name) => /^[0-9a-f-]{36}\.json$/i.test(name)).sort()
  const items = await Promise.all(names.map(async (name) => {
    const manifest = await readManifest(path.join(dir, name))
    if (name !== `${manifest.id}.json`) throw new Error('O identificador do backup não corresponde ao arquivo.')
    return manifest
  }))
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
function pending(items: MigrationManifest[]): MigrationManifest | undefined {
  return items.find((item) => item.state === 'applying' || item.state === 'restoring')
}
function fingerprint(worldId: string, calendar: unknown, entityTypes: unknown, entities: ScannedEntity[]): string {
  const hash = createHash('sha256').update(worldId).update(JSON.stringify(calendar)).update(JSON.stringify(entityTypes))
  for (const entity of entities) hash.update(entity.relativePath).update(entity.text)
  return hash.digest('hex')
}

async function build(worldId: string) {
  const worldDir = await resolveWorldDir(worldId)
  const world = await readWorldByDir(worldDir)
  const entities = await scan(worldDir)
  const keys = new Map(world.entityTypes.map((type) => [type.id, type.properties.filter((property) => property.kind === 'date')]))
  const examples: DateMigrationExample[] = []
  const problems: DateMigrationExample[] = []
  const entries: MigrationEntry[] = []
  let total = 0
  let convertible = 0
  let alreadyConverted = 0
  for (const item of entities) {
    const properties = { ...item.entity.properties }
    let changed = false
    for (const field of keys.get(item.entity.type) ?? []) {
      const value = properties[field.key]
      if (value === undefined || value === null || value === '') continue
      total++
      const base = { entityId: item.entity.id, title: item.entity.title, type: item.entity.type, field: field.label, trashed: item.trashed }
      if (typeof value !== 'string') {
        const valid = validateCalendarDateValue(world.calendar, value)
        if (valid.success) alreadyConverted++
        else problems.push({ ...base, before: JSON.stringify(value), reason: valid.error })
        continue
      }
      const parsed = parseLegacyIsoDate(value)
      if (!parsed.success) { problems.push({ ...base, before: value, reason: parsed.error }); continue }
      try {
        const ordinal = legacyIsoDateToOrdinal(parsed.data)
        const date = getCalendarDateAtOrdinal(world.calendar, ordinal)
        if (date.month === undefined || date.day === undefined) throw new Error('O dia cai em um intercalar sem mês/dia representável.')
        const converted = { start: { year: date.year, month: date.month, day: date.day } }
        const validation = validateCalendarDateValue(world.calendar, converted)
        if (!validation.success) throw new Error(validation.error)
        properties[field.key] = validation.data
        convertible++
        changed = true
        if (examples.length < 12) examples.push({ ...base, before: value, after: `${date.year}/${date.month}/${date.day}` })
      } catch (error) {
        problems.push({ ...base, before: value, reason: error instanceof Error ? error.message : 'Data não representável.' })
      }
    }
    if (changed) {
      const converted = { ...item.entity, properties }
      entries.push({ relativePath: item.relativePath, originalText: item.text, convertedText: JSON.stringify(converted, null, 2) })
    }
  }
  const convertedText = new Map(entries.map((entry) => [entry.relativePath, entry.convertedText]))
  const expectedEntities = entities.map((item) => ({ ...item, text: convertedText.get(item.relativePath) ?? item.text }))
  return {
    worldDir,
    preview: { worldId, fingerprint: fingerprint(worldId, world.calendar, world.entityTypes, entities), total, convertible, alreadyConverted, invalid: problems.length, examples, problems } satisfies DateMigrationPreview,
    completionFingerprint: fingerprint(worldId, world.calendar, world.entityTypes, expectedEntities),
    entries,
  }
}

export async function previewDateMigration(worldId: string): Promise<DateMigrationPreview> {
  const built = await build(worldId)
  const history = await manifests(built.worldDir)
  const unfinished = pending(history)
  const latest = history.at(-1)
  return {
    ...built.preview,
    ...(unfinished ? { recovery: { id: unfinished.id, state: unfinished.state } } : {}),
    ...(latest ? { latestBackup: { id: latest.id, state: latest.state } } : {}),
  }
}

async function replay(worldDir: string, manifest: MigrationManifest, restore: boolean): Promise<void> {
  for (const entry of manifest.entries) {
    const file = metadataPath(worldDir, entry.relativePath)
    const current = await readFile(file, 'utf8')
    if (current !== entry.originalText && current !== entry.convertedText) {
      throw new Error(`O registro ${entry.relativePath} mudou após a prévia. Revise a alteração antes de retomar ou restaurar.`)
    }
    const wanted = restore ? entry.originalText : entry.convertedText
    if (current !== wanted) await atomicWriteText(file, wanted)
  }
  if (!restore && manifest.completionFingerprint) {
    const world = await readWorldByDir(worldDir)
    const current = fingerprint(world.id, world.calendar, world.entityTypes, await scan(worldDir))
    if (current !== manifest.completionFingerprint) {
      throw new Error('O mundo mudou durante a conversão. Restaure o backup e refaça a prévia.')
    }
  }
  manifest.state = restore ? 'restored' : 'completed'
  await writeManifest(worldDir, manifest)
}

export async function startDateMigration(worldId: string, expectedFingerprint: string): Promise<string> {
  const worldDir = await resolveWorldDir(worldId)
  return withWorldWriteLock(worldDir, async () => {
  const built = await build(worldId)
  if (built.preview.fingerprint !== expectedFingerprint) throw new Error('Os dados mudaram desde a prévia. Atualize a página e revise novamente.')
  if (pending(await manifests(built.worldDir))) throw new Error('Existe uma conversão interrompida. Retome ou restaure antes de começar outra.')
  if (built.entries.length === 0) throw new Error('Não há datas conversíveis neste mundo.')
  const { total, convertible, invalid, examples, problems } = built.preview
  const manifest: MigrationManifest = {
    schemaVersion: 1, id: randomUUID(), worldId, createdAt: new Date().toISOString(), state: 'applying', entries: built.entries,
    sourceFingerprint: built.preview.fingerprint, completionFingerprint: built.completionFingerprint,
    report: { total, convertible, invalid, examples, problems },
  }
  await ensureDir(migrationDir(built.worldDir))
  await writeManifest(built.worldDir, manifest)
  await replay(built.worldDir, manifest, false)
  return manifest.id
  })
}

export async function recoverDateMigration(worldId: string, id: string, restore: boolean): Promise<void> {
  const worldDir = await resolveWorldDir(worldId)
  return withWorldWriteLock(worldDir, async () => {
  const manifest = await readManifest(manifestPath(worldDir, id))
  if (manifest.id !== id) throw new Error('O identificador do backup não corresponde ao arquivo.')
  if (manifest.worldId !== worldId) throw new Error('O backup pertence a outro mundo.')
  if (restore && manifest.state === 'restored') return
  if (!restore && manifest.state === 'completed') return
  if (!restore && manifest.state === 'restoring') throw new Error('A restauração já começou; conclua-a primeiro.')
  if (restore && manifest.state !== 'restoring') {
    for (const entry of manifest.entries) {
      const file = metadataPath(worldDir, entry.relativePath)
      const current = await readFile(file, 'utf8')
      if (current !== entry.originalText && current !== entry.convertedText) {
        throw new Error(`O registro ${entry.relativePath} mudou após a prévia. Revise a alteração antes de restaurar.`)
      }
    }
  }
  if (restore && manifest.state !== 'restoring') {
    manifest.state = 'restoring'
    await writeManifest(worldDir, manifest)
  }
  await replay(worldDir, manifest, restore)
  })
}
