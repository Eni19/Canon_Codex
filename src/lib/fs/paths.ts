import 'server-only'
import path from 'node:path'

/**
 * `worldDir` is the world's folder name on disk (today, its slug). It is a storage detail —
 * callers resolve a stable `World.id` to a `worldDir` once via the repository, never the reverse.
 */

export function getWorkspaceRoot(): string {
  return process.env.WIKI_WORKSPACE_DIR ?? path.join(process.cwd(), 'workspace')
}

export function getWorldsRootDir(): string {
  return path.join(getWorkspaceRoot(), 'worlds')
}

export function getWorldDir(worldDir: string): string {
  return path.join(getWorldsRootDir(), worldDir)
}

export function getWorldJsonPath(worldDir: string): string {
  return path.join(getWorldDir(worldDir), 'world.json')
}

export function getEntitiesDir(worldDir: string): string {
  return path.join(getWorldDir(worldDir), 'entities')
}

export function getEntityDir(worldDir: string, entityId: string): string {
  return path.join(getEntitiesDir(worldDir), entityId)
}

export function getEntityMetadataPath(worldDir: string, entityId: string): string {
  return path.join(getEntityDir(worldDir, entityId), 'metadata.json')
}

export function getEntityContentPath(worldDir: string, entityId: string): string {
  return path.join(getEntityDir(worldDir, entityId), 'content.json')
}

export function getAssetsDir(worldDir: string): string {
  return path.join(getWorldDir(worldDir), 'assets')
}

export function getBoardsDir(worldDir: string): string {
  return path.join(getWorldDir(worldDir), 'boards')
}

export function getBoardDir(worldDir: string, boardId: string): string {
  return path.join(getBoardsDir(worldDir), boardId)
}

export function getBoardJsonPath(worldDir: string, boardId: string): string {
  return path.join(getBoardDir(worldDir, boardId), 'board.json')
}

export function getScenesDir(worldDir: string): string { return path.join(getWorldDir(worldDir), 'scenes') }
export function getSceneDir(worldDir: string, sceneId: string): string { return path.join(getScenesDir(worldDir), sceneId) }
export function getSceneJsonPath(worldDir: string, sceneId: string): string { return path.join(getSceneDir(worldDir, sceneId), 'scene.json') }

export function getAssetDir(worldDir: string, assetId: string): string {
  return path.join(getAssetsDir(worldDir), assetId)
}

export function getAssetMetadataPath(worldDir: string, assetId: string): string {
  return path.join(getAssetDir(worldDir, assetId), 'asset.json')
}

export function getTrashDir(worldDir: string): string {
  return path.join(getWorldDir(worldDir), 'trash')
}

export function getIndexesDir(worldDir: string): string {
  return path.join(getWorldDir(worldDir), 'indexes')
}

export function getSettingsPath(): string {
  return path.join(getWorkspaceRoot(), 'settings', 'app.json')
}
