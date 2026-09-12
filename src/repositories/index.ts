import 'server-only'
import type { AssetStore } from '@/repositories/contracts/assetStore'
import type { BoardRepository } from '@/repositories/contracts/boardRepository'
import type { SceneRepository } from '@/repositories/contracts/sceneRepository'
import type { WorldRepository } from '@/repositories/contracts/worldRepository'
import { FileSystemAssetStore } from '@/repositories/filesystem/fileSystemAssetStore'
import { FileSystemBoardRepository } from '@/repositories/filesystem/fileSystemBoardRepository'
import { FileSystemSceneRepository } from '@/repositories/filesystem/fileSystemSceneRepository'
import { FileSystemWorldRepository } from '@/repositories/filesystem/fileSystemWorldRepository'

/**
 * Single place that knows which persistence implementation is active. Everything else in the app
 * (Server Components, Server Actions, Route Handlers) depends only on the contracts — see
 * ADR-001. Swapping in a `PostgresWorldRepository`/`S3AssetStore` later means adding a case here.
 */
function getPersistenceDriver(): 'filesystem' {
  const driver = process.env.PERSISTENCE_DRIVER ?? 'filesystem'
  if (driver !== 'filesystem') throw new Error(`Unknown PERSISTENCE_DRIVER: ${driver}`)
  return driver
}

let worldRepository: WorldRepository | undefined
export function getWorldRepository(): WorldRepository {
  getPersistenceDriver()
  worldRepository ??= new FileSystemWorldRepository()
  return worldRepository
}

let assetStore: AssetStore | undefined
export function getAssetStore(): AssetStore {
  getPersistenceDriver()
  assetStore ??= new FileSystemAssetStore()
  return assetStore
}

let boardRepository: BoardRepository | undefined
export function getBoardRepository(): BoardRepository {
  getPersistenceDriver()
  boardRepository ??= new FileSystemBoardRepository()
  return boardRepository
}

let sceneRepository: SceneRepository | undefined
export function getSceneRepository(): SceneRepository {
  getPersistenceDriver()
  sceneRepository ??= new FileSystemSceneRepository()
  return sceneRepository
}
