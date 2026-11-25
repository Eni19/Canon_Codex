import 'server-only'

import { closeSync, constants, fstatSync, openSync, readFileSync, type Stats } from 'node:fs'
import { access, lstat, readdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { z, type ZodType } from 'zod'
import { AssetSchema, AssetVariantSchema, type Asset, type AssetVariant } from '@/domain/assets/asset'
import { extensionForMimeType } from '@/domain/assets/mimeType'
import { BOARD_SCHEMA_VERSION, BoardDocumentSchema, type BoardDocument } from '@/domain/boards/board'
import { ContentDocumentSchema, type ContentDocument } from '@/domain/content/contentDocument'
import { EntitySchema, type Entity } from '@/domain/entities/entity'
import { PLAYLIST_SCHEMA_VERSION, PlaylistSchema, type Playlist } from '@/domain/playlists/playlist'
import { SCENE_SCHEMA_VERSION, SceneSchema, type Scene } from '@/domain/scenes/scene'
import { parseTimelineData, type TimelineData } from '@/domain/timelines/timeline'
import { WorldSchema, type World } from '@/domain/worlds/world'
import { readJsonFile } from '@/lib/fs/atomicWrite'
import { migrateToLatest, type MigrationRegistry } from '@/lib/migrations/registry'
import { validateDateMigrationManifest } from '@/repositories/filesystem/dateMigration'
import { assetMigrations, contentMigrations, entityMigrations, worldMigrations } from '@/repositories/filesystem/migrations'

type Folder = { directory: string; deletedAt: string | null }
type LegacyDocument<T> = { document: T; deletedAt: string | null }
type LegacyAssetVariant = { variant: AssetVariant; mimeType: string; readBytes: () => Uint8Array }

export interface LegacyWorld {
  world: World
  deletedAt: string | null
  entities: { entity: Entity; content: ContentDocument | null; timeline: TimelineData | null; deletedAt: string | null }[]
  assets: { asset: Asset; variants: LegacyAssetVariant[]; deletedAt: string | null }[]
  boards: LegacyDocument<BoardDocument>[]
  scenes: LegacyDocument<Scene>[]
  playlists: LegacyDocument<Playlist>[]
  histories: { kind: 'date' | 'origin'; id: string; document: unknown }[]
}

function invalid(target: string, reason: string): Error {
  return new Error(`Origem legada inválida em “${target}”. ${reason}`)
}

async function getStats(target: string, type: 'file' | 'directory'): Promise<Stats | null> {
  try {
    const info = await lstat(target)
    if (type === 'file' ? !info.isFile() : !info.isDirectory()) {
      throw invalid(target, type === 'file' ? 'Era esperado um arquivo regular.' : 'Era esperada uma pasta.')
    }
    return info
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function entries(directory: string) {
  if (!await getStats(directory, 'directory')) return []
  return (await readdir(/* turbopackIgnore: true */ directory, { withFileTypes: true }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function directories(directory: string, rejectLinks = true): Promise<string[]> {
  return (await entries(directory)).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    if (rejectLinks && entry.isSymbolicLink()) throw invalid(target, 'A pasta não pode ser um link simbólico.')
    return entry.isDirectory() ? [target] : []
  })
}

async function activeWorlds(root: string, requireMetadata: boolean): Promise<Folder[]> {
  const worlds: Folder[] = []
  for (const directory of await directories(root, requireMetadata)) {
    if (await getStats(path.join(directory, 'world.json'), 'file')) worlds.push({ directory, deletedAt: null })
    else if (requireMetadata) throw invalid(directory, 'Falta o arquivo world.json.')
  }
  return worlds
}

function trashDate(directory: string): string {
  const match = /^(.+)-(\d+)$/.exec(path.basename(directory))
  const timestamp = match ? Number(match[2]) : NaN
  const date = new Date(timestamp)
  if (!Number.isSafeInteger(timestamp) || Number.isNaN(date.getTime())) {
    throw invalid(directory, 'O nome da pasta da lixeira tem um timestamp inválido.')
  }
  return date.toISOString()
}

async function trashedWorlds(root: string): Promise<Folder[]> {
  const trash = path.join(root, 'trash')
  if (!await getStats(trash, 'directory')) return []
  return (await directories(path.join(trash, 'worlds')))
    .map((directory) => ({ directory, deletedAt: trashDate(directory) }))
}

async function discover(sourcePath: string, mode: 'folder' | 'library'): Promise<Folder[]> {
  const input = sourcePath.trim().replace(/^["']|["']$/g, '')
  if (!input.trim()) throw new Error('Informe a pasta que deseja carregar.')
  const requested = path.resolve(input)
  const source = await realpath(requested).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
    throw new Error(`A pasta “${requested}” não foi encontrada.`)
  })
  if (!await getStats(source, 'directory')) throw new Error(`A pasta “${source}” não foi encontrada.`)
  if (mode === 'folder' && await getStats(path.join(source, 'world.json'), 'file')) {
    return [{ directory: source, deletedAt: null }]
  }

  const nested = path.join(source, 'workspace')
  const roots = await getStats(nested, 'directory') ? [nested, source] : [source]
  for (const root of roots) {
    const worldsRoot = path.join(root, 'worlds')
    if (!await getStats(worldsRoot, 'directory')) continue
    const worlds = await activeWorlds(worldsRoot, mode === 'library')
    if (mode === 'library') return [...worlds, ...await trashedWorlds(root)]
    if (worlds.length) return worlds
  }

  const worlds = await activeWorlds(source, mode === 'library' && path.basename(source) === 'worlds')
  if (mode === 'library' && path.basename(source) === 'worlds') {
    return [...worlds, ...await trashedWorlds(path.dirname(source))]
  }
  const inventory = mode === 'library' ? [...worlds, ...await trashedWorlds(source)] : worlds
  if (inventory.length) return inventory
  throw new Error('Nenhum mundo válido foi encontrado. Escolha uma pasta com world.json ou a raiz de outro Canon Codex.')
}

async function parseFile<T>(file: string, parse: (input: unknown) => T, optional: true): Promise<T | null>
async function parseFile<T>(file: string, parse: (input: unknown) => T, optional?: false): Promise<T>
async function parseFile<T>(file: string, parse: (input: unknown) => T, optional = false): Promise<T | null> {
  if (!await getStats(file, 'file')) {
    if (optional) return null
    throw invalid(file, 'Falta o arquivo.')
  }
  try {
    return parse(await readJsonFile(file))
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fields = error.issues.map((issue) => issue.path.join('.') || 'documento')
      throw invalid(file, `Campos inválidos: ${[...new Set(fields)].join(', ')}.`)
    }
    if (error instanceof SyntaxError) throw invalid(file, 'O JSON está malformado.')
    throw new Error(`${file}: ${(error as Error).message}`, { cause: error })
  }
}

const legacyObject = z.record(z.string(), z.unknown())
const versionField = z.object({ schemaVersion: z.number().int() })

function parseVersioned<T>(schema: ZodType<T>, version: number, migrations?: MigrationRegistry) {
  return (data: unknown): T => {
    const document = migrations ? migrateToLatest(migrations, legacyObject.parse(data)) : data
    const current = versionField.parse(document).schemaVersion
    if (current !== version) throw new Error(`Versão de esquema incompatível: ${current}, esperada ${version}.`)
    return schema.parse(document)
  }
}

function checkIdentity(folder: Folder, kind: string, id: string, worldId: string, expectedWorldId: string) {
  if (worldId !== expectedWorldId) throw invalid(folder.directory, 'O registro pertence a outro mundo.')
  const name = path.basename(folder.directory)
  const actualId = folder.deletedAt === null ? name : name.slice(kind.length + 1).replace(/-\d+$/, '')
  if (actualId !== id) throw invalid(folder.directory, 'O ID não corresponde ao nome da pasta.')
}

function checkDuplicate(seen: Map<string, string>, id: string, location: string) {
  const first = seen.get(id)
  if (first) throw invalid(location, `O identificador ${id} está duplicado em “${first}”.`)
  seen.set(id, location)
}

function checkNestedIds(rows: { id: string }[], file: string) {
  const seen = new Map<string, string>()
  for (const row of rows) checkDuplicate(seen, row.id, file)
}

async function records<T extends { id: string; worldId: string }>(
  directory: string,
  trash: string[],
  collection: string,
  kind: string,
  fileName: string,
  worldId: string,
  parse: (input: unknown) => T,
): Promise<(LegacyDocument<T> & { directory: string })[]> {
  const active = (await directories(path.join(directory, collection))).map((directory) => ({ directory, deletedAt: null }))
  const deleted = trash.filter((folder) => path.basename(folder).startsWith(kind + '-'))
    .map((directory) => ({ directory, deletedAt: trashDate(directory) }))
  const result = []
  const seen = new Map<string, string>()
  for (const folder of [...active, ...deleted]) {
    const document = await parseFile(path.join(folder.directory, fileName), parse)
    checkIdentity(folder, kind, document.id, document.worldId, worldId)
    checkDuplicate(seen, document.id, folder.directory)
    result.push({ ...folder, document })
  }
  return result
}

const originHistory = z.object({
  worldId: z.uuid(),
  state: z.enum(['applying', 'completed', 'restored']),
  originalWorld: z.string(),
  changes: z.array(z.object({
    file: z.string().regex(/^(?:entities[\\/][0-9a-f-]{36}|trash[\\/]entity-[0-9a-f-]{36}-\d+)[\\/](?:metadata|timeline)\.json$/i),
    before: z.string(),
  })),
})

async function readHistories(directory: string, worldId: string): Promise<LegacyWorld['histories']> {
  const histories: LegacyWorld['histories'] = []
  for (const [kind, folder] of [['date', 'date-migrations'], ['origin', 'origin-backups']] as const) {
    const historyDir = path.join(/* turbopackIgnore: true */ directory, folder)
    for (const entry of await entries(historyDir)) {
      if (!entry.name.endsWith('.json')) continue
      const file = path.join(/* turbopackIgnore: true */ historyDir, entry.name)
      const id = z.uuid().safeParse(entry.name.slice(0, -5))
      if (!id.success) throw invalid(file, 'O nome do backup deve conter seu UUID.')
      const document = await parseFile(file, (value) => {
        const header = z.object({ worldId: z.uuid(), state: z.string() }).parse(value)
        if (header.worldId !== worldId) throw new Error('O backup pertence a outro mundo.')
        if (header.state === 'applying' || header.state === 'restoring') {
          throw new Error('Conclua ou restaure a operação de calendário pendente na origem antes de importar.')
        }
        if (kind === 'date') {
          if (validateDateMigrationManifest(value).id !== id.data) throw new Error('O ID do backup não corresponde ao arquivo.')
        } else {
          originHistory.parse(value)
        }
        return value
      })
      histories.push({ kind, id: id.data, document })
    }
  }
  return histories
}

async function readEntity(folder: Folder & { document: Entity }): Promise<LegacyWorld['entities'][number]> {
  const { document: entity, directory, deletedAt } = folder
  const metadataFile = path.join(directory, 'metadata.json')
  const contentFile = path.join(directory, 'content.json')
  const timelineFile = path.join(directory, 'timeline.json')
  checkNestedIds(entity.relations, metadataFile)
  if (entity.relations.some((relation) => relation.sourceId !== entity.id)) {
    throw invalid(metadataFile, 'Uma relação pertence a outro registro.')
  }
  const content = await parseFile(contentFile, parseVersioned(ContentDocumentSchema, contentMigrations.currentVersion, contentMigrations), true)
  const timeline = await parseFile(timelineFile, parseTimelineData, true)
  if (content) checkNestedIds(content.pages, contentFile)
  if (timeline) {
    if (entity.type !== 'timeline' || timeline.worldId !== entity.worldId || timeline.timelineId !== entity.id) {
      throw invalid(timelineFile, 'O documento não corresponde à linha do tempo.')
    }
    checkNestedIds(timeline.appearances, timelineFile)
  }
  return { entity, content, timeline, deletedAt }
}

function matchesVariant(actual: Stats, expected: Stats): boolean {
  return actual.isFile() && actual.dev === expected.dev && actual.ino === expected.ino
    && actual.size === expected.size && actual.mtimeMs === expected.mtimeMs && actual.ctimeMs === expected.ctimeMs
}

function readVariantBytes(file: string, expected: Stats): Uint8Array {
  const handle = openSync(file, constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0))
  try {
    const changed = () => invalid(file, 'A variante mudou durante a importação. Refaça a operação com a origem parada.')
    if (!matchesVariant(fstatSync(handle), expected)) throw changed()
    const bytes = readFileSync(handle)
    if (bytes.byteLength !== expected.size || !matchesVariant(fstatSync(handle), expected)) throw changed()
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  } finally {
    closeSync(handle)
  }
}

async function readAsset(folder: Folder & { document: Asset }): Promise<LegacyWorld['assets'][number]> {
  const { document: asset, directory, deletedAt } = folder
  const extension = extensionForMimeType(asset.mimeType)
  if (typeof extension !== 'string') throw invalid(directory, 'O MIME do arquivo original é incompatível.')
  const variants: LegacyWorld['assets'][number]['variants'] = []
  for (const variant of AssetVariantSchema.options) {
    const original = variant === 'original'
    const file = path.join(directory, original ? `original.${extension}` : `${variant}.webp`)
    const info = await getStats(file, 'file')
    if (!info) {
      if (original || (variant === 'thumbnail' && asset.hasThumbnail)) throw invalid(file, 'Falta o arquivo da variante.')
      continue
    }
    if (original && info.size !== asset.sizeBytes) throw invalid(file, 'O tamanho não corresponde aos metadados do asset.')
    await access(file, constants.R_OK)
    variants.push({
      variant,
      mimeType: original ? asset.mimeType : 'image/webp',
      readBytes: () => readVariantBytes(file, info),
    })
  }
  return { asset, variants, deletedAt }
}

async function readWorld(folder: Folder, world: World): Promise<LegacyWorld> {
  const { directory, deletedAt } = folder
  const histories = await readHistories(directory, world.id)
  const trash = await directories(path.join(directory, 'trash'))
  const entities = []
  for (const entity of await records(directory, trash, 'entities', 'entity', 'metadata.json', world.id,
    parseVersioned(EntitySchema, entityMigrations.currentVersion, entityMigrations))) {
    entities.push(await readEntity(entity))
  }
  const assets = []
  for (const asset of await records(directory, trash, 'assets', 'asset', 'asset.json', world.id,
    parseVersioned(AssetSchema, assetMigrations.currentVersion, assetMigrations))) {
    assets.push(await readAsset(asset))
  }
  const boards = (await records(directory, trash, 'boards', 'board', 'board.json', world.id,
    parseVersioned(BoardDocumentSchema, BOARD_SCHEMA_VERSION))).map(({ document, deletedAt }) => ({ document, deletedAt }))
  const scenes = (await records(directory, trash, 'scenes', 'scene', 'scene.json', world.id,
    parseVersioned(SceneSchema, SCENE_SCHEMA_VERSION))).map(({ document, deletedAt }) => ({ document, deletedAt }))
  const playlists = (await records(directory, trash, 'playlists', 'playlist', 'playlist.json', world.id,
    parseVersioned(PlaylistSchema, PLAYLIST_SCHEMA_VERSION))).map(({ document, deletedAt, directory }) => {
    checkNestedIds(document.tracks, path.join(directory, 'playlist.json'))
    return { document, deletedAt }
  })
  return { world, deletedAt, entities, assets, histories, boards, scenes, playlists }
}

export async function readLegacySource(sourcePath: string, mode: 'folder' | 'library'): Promise<LegacyWorld[]> {
  const candidates = []
  const seen = new Map<string, string>()
  const activeSlugs = new Map<string, string>()
  for (const folder of await discover(sourcePath, mode)) {
    const file = path.join(folder.directory, 'world.json')
    const world = await parseFile(file, parseVersioned(WorldSchema, worldMigrations.currentVersion, worldMigrations))
    checkDuplicate(seen, world.id, file)
    if (mode === 'library' && folder.deletedAt === null) {
      const slug = world.slug.replace(/[A-Z]/g, (letter) => letter.toLowerCase())
      const other = activeSlugs.get(slug)
      if (other) throw invalid(file, `O slug “${world.slug}” também está em uso por “${other}”.`)
      activeSlugs.set(slug, file)
    }
    candidates.push({ folder, world })
  }
  const worlds = []
  for (const { folder, world } of candidates) worlds.push(await readWorld(folder, world))
  return worlds
}
