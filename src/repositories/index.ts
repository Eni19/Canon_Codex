import 'server-only'
import { statSync } from 'node:fs'
import path from 'node:path'
import { getWorkspaceRoot, getWorldsRootDir } from '@/lib/fs/paths'
import { FileSystemAssetStore } from '@/repositories/filesystem/fileSystemAssetStore'
import { FileSystemBoardRepository } from '@/repositories/filesystem/fileSystemBoardRepository'
import { FileSystemPlaylistRepository } from '@/repositories/filesystem/fileSystemPlaylistRepository'
import { FileSystemSceneRepository } from '@/repositories/filesystem/fileSystemSceneRepository'
import { FileSystemWorldRepository } from '@/repositories/filesystem/fileSystemWorldRepository'
import type { AssetStore } from '@/repositories/contracts/assetStore'
import type { BoardRepository } from '@/repositories/contracts/boardRepository'
import type { PlaylistRepository } from '@/repositories/contracts/playlistRepository'
import type { SceneRepository } from '@/repositories/contracts/sceneRepository'
import type { TrashRepository } from '@/repositories/contracts/trashRepository'
import type { WorldRepository } from '@/repositories/contracts/worldRepository'
import { SqliteDatabase } from '@/repositories/sqlite/database'
import { SqliteAssetStore } from '@/repositories/sqlite/sqliteAssetStore'
import { SqliteBoardRepository } from '@/repositories/sqlite/sqliteBoardRepository'
import { SqlitePlaylistRepository } from '@/repositories/sqlite/sqlitePlaylistRepository'
import { SqliteSceneRepository } from '@/repositories/sqlite/sqliteSceneRepository'
import { SqliteTrashRepository } from '@/repositories/sqlite/sqliteTrash'
import { SqliteWorldRepository } from '@/repositories/sqlite/sqliteWorldRepository'

type SqliteRepositories = {
  file: string
  database: SqliteDatabase
  world: SqliteWorldRepository
  assets: AssetStore
  boards: BoardRepository
  scenes: SceneRepository
  playlists: PlaylistRepository
  trash: TrashRepository
  purgedAt: number
}

let sqlite: SqliteRepositories | undefined

/** Com o app aberto, a limpeza da lixeira roda de novo no máximo uma vez por hora (ADR-009). */
const TRASH_PURGE_INTERVAL = 60 * 60 * 1000

export class LegacyMigrationRequiredError extends Error {
  constructor() {
    super('Biblioteca em arquivos encontrada. Use pnpm storage preview e pnpm storage import antes de abrir o SQLite.')
    this.name = 'LegacyMigrationRequiredError'
  }
}

function sqliteRepositories() {
  const driver = process.env.PERSISTENCE_DRIVER ?? 'sqlite'
  if (driver === 'filesystem') return null
  if (driver !== 'sqlite') throw new Error(`Unknown PERSISTENCE_DRIVER: ${driver}`)

  const configuredFile = process.env.SQLITE_DATABASE_PATH
  const file = path.resolve(/* turbopackIgnore: true */ configuredFile || path.join(getWorkspaceRoot(), 'canon-codex.sqlite'))
  const legacyTrash = path.join(/* turbopackIgnore: true */ getWorkspaceRoot(), 'trash', 'worlds')
  if (sqlite?.file === file) return purgeExpiredTrash(sqlite)
  if (!configuredFile && !runtimePathExists(file)
    && (runtimePathExists(getWorldsRootDir()) || runtimePathExists(legacyTrash))) {
    throw new LegacyMigrationRequiredError()
  }
  const database = new SqliteDatabase(file)
  sqlite?.database.close()
  const world = new SqliteWorldRepository(database)
  sqlite = {
    file, database, world,
    assets: new SqliteAssetStore(database),
    boards: new SqliteBoardRepository(database),
    scenes: new SqliteSceneRepository(database),
    playlists: new SqlitePlaylistRepository(database),
    trash: new SqliteTrashRepository(database, world),
    purgedAt: 0,
  }
  return purgeExpiredTrash(sqlite)
}

/** Roda ao abrir o banco e depois de hora em hora; uma falha nunca impede o app de abrir. */
function purgeExpiredTrash(repositories: SqliteRepositories): SqliteRepositories {
  const now = Date.now()
  if (now - repositories.purgedAt < TRASH_PURGE_INTERVAL) return repositories
  repositories.purgedAt = now
  repositories.trash.purgeExpired(new Date(now)).catch((error: unknown) => {
    console.error('Não foi possível limpar a lixeira vencida.', error)
  })
  return repositories
}

function runtimePathExists(file: string): boolean {
  return Boolean(statSync(/* turbopackIgnore: true */ file, { throwIfNoEntry: false }))
}

const legacy = {
  world: new FileSystemWorldRepository(),
  assets: new FileSystemAssetStore(),
  boards: new FileSystemBoardRepository(),
  scenes: new FileSystemSceneRepository(),
  playlists: new FileSystemPlaylistRepository(),
}

export function getSqliteWorldRepository(): SqliteWorldRepository | null {
  return sqliteRepositories()?.world ?? null
}

export function getWorldRepository(): WorldRepository {
  return getSqliteWorldRepository() ?? legacy.world
}

export function getAssetStore(): AssetStore {
  return sqliteRepositories()?.assets ?? legacy.assets
}

export function getBoardRepository(): BoardRepository {
  return sqliteRepositories()?.boards ?? legacy.boards
}

export function getSceneRepository(): SceneRepository {
  return sqliteRepositories()?.scenes ?? legacy.scenes
}

/** A lixeira com prazo só existe no SQLite; o driver filesystem devolve `null`. */
export function getTrashRepository(): TrashRepository | null {
  return sqliteRepositories()?.trash ?? null
}

export function getPlaylistRepository(): PlaylistRepository {
  return sqliteRepositories()?.playlists ?? legacy.playlists
}
