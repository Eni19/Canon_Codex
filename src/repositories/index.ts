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
import type { WorldRepository } from '@/repositories/contracts/worldRepository'
import { SqliteDatabase } from '@/repositories/sqlite/database'
import { SqliteAssetStore } from '@/repositories/sqlite/sqliteAssetStore'
import { SqliteBoardRepository } from '@/repositories/sqlite/sqliteBoardRepository'
import { SqlitePlaylistRepository } from '@/repositories/sqlite/sqlitePlaylistRepository'
import { SqliteSceneRepository } from '@/repositories/sqlite/sqliteSceneRepository'
import { SqliteWorldRepository } from '@/repositories/sqlite/sqliteWorldRepository'

let sqlite: {
  file: string
  database: SqliteDatabase
  world: SqliteWorldRepository
  assets: AssetStore
  boards: BoardRepository
  scenes: SceneRepository
  playlists: PlaylistRepository
} | undefined

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
  if (sqlite?.file === file) return sqlite
  if (!configuredFile && !runtimePathExists(file)
    && (runtimePathExists(getWorldsRootDir()) || runtimePathExists(legacyTrash))) {
    throw new LegacyMigrationRequiredError()
  }
  const database = new SqliteDatabase(file)
  sqlite?.database.close()
  sqlite = {
    file, database,
    world: new SqliteWorldRepository(database),
    assets: new SqliteAssetStore(database),
    boards: new SqliteBoardRepository(database),
    scenes: new SqliteSceneRepository(database),
    playlists: new SqlitePlaylistRepository(database),
  }
  return sqlite
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

export function getPlaylistRepository(): PlaylistRepository {
  return sqliteRepositories()?.playlists ?? legacy.playlists
}
