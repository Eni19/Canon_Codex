import 'server-only'
import { readdir, rename } from 'node:fs/promises'
import path from 'node:path'
import { SCENE_SCHEMA_VERSION, SceneGridSchema, SceneSchema, CreateSceneInputSchema, type CreateSceneInput, type Scene, type SceneSummary, type SceneGrid } from '@/domain/scenes/scene'
import { atomicWriteJson, ensureDir, pathExists, readJsonFile } from '@/lib/fs/atomicWrite'
import { getSceneDir, getSceneJsonPath, getScenesDir, getTrashDir } from '@/lib/fs/paths'
import { newId } from '@/lib/ids'
import type { SceneRepository } from '@/repositories/contracts/sceneRepository'
import { resolveWorldDir } from './worldDirRegistry'

export class FileSystemSceneRepository implements SceneRepository {
  async listScenes(worldId: string): Promise<SceneSummary[]> {
    const worldDir = await resolveWorldDir(worldId), dir = getScenesDir(worldDir)
    if (!(await pathExists(dir))) return []
    const entries = await readdir(dir, { withFileTypes: true })
    const scenes = await Promise.all(entries.filter((e) => e.isDirectory()).map((e) => this.read(worldDir, e.name)))
    return scenes.filter((s): s is Scene => Boolean(s)).map((scene): SceneSummary => ({ schemaVersion: scene.schemaVersion, id: scene.id, worldId: scene.worldId, title: scene.title, description: scene.description, tags: scene.tags, background: scene.background, grid: scene.grid, createdAt: scene.createdAt, updatedAt: scene.updatedAt })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
  async getScene(worldId: string, sceneId: string) { return this.read(await resolveWorldDir(worldId), sceneId) }
  async createScene(worldId: string, input: CreateSceneInput) {
    const data = CreateSceneInputSchema.parse(input), now = new Date().toISOString()
    const scene = SceneSchema.parse({ schemaVersion: SCENE_SCHEMA_VERSION, id: newId(), worldId, title: data.title, description: data.description || undefined, tags: data.tags, background: { locationId: data.locationId, assetId: data.assetId, width: data.width, height: data.height }, grid: { enabled: false, type: 'square', cellSize: 70, offsetX: 0, offsetY: 0, opacity: .25, snapTokens: false }, canvasSnapshot: null, createdAt: now, updatedAt: now })
    await atomicWriteJson(getSceneJsonPath(await resolveWorldDir(worldId), scene.id), scene); return scene
  }
  async saveScene(worldId: string, sceneId: string, patch: { canvasSnapshot?: unknown; grid?: SceneGrid }) {
    const worldDir = await resolveWorldDir(worldId), current = await this.read(worldDir, sceneId)
    if (!current) throw new Error(`Scene not found: ${sceneId}`)
    const next = SceneSchema.parse({ ...current, ...(patch.canvasSnapshot !== undefined ? { canvasSnapshot: patch.canvasSnapshot } : {}), ...(patch.grid ? { grid: SceneGridSchema.parse(patch.grid) } : {}), updatedAt: new Date().toISOString() })
    await atomicWriteJson(getSceneJsonPath(worldDir, sceneId), next); return next
  }
  async duplicateScene(worldId: string, sceneId: string) {
    const current = await this.getScene(worldId, sceneId); if (!current) throw new Error(`Scene not found: ${sceneId}`)
    const copy = await this.createScene(worldId, { title: `${current.title} — Cópia`, description: current.description, tags: current.tags, locationId: current.background.locationId, assetId: current.background.assetId, width: current.background.width, height: current.background.height })
    return this.saveScene(worldId, copy.id, { canvasSnapshot: current.canvasSnapshot, grid: current.grid })
  }
  async deleteScene(worldId: string, sceneId: string) {
    const worldDir = await resolveWorldDir(worldId), dir = getSceneDir(worldDir, sceneId); if (!(await pathExists(dir))) return
    const trash = getTrashDir(worldDir); await ensureDir(trash); await rename(dir, path.join(trash, `scene-${sceneId}-${Date.now()}`))
  }
  private async read(worldDir: string, sceneId: string): Promise<Scene | null> { const file = getSceneJsonPath(worldDir, sceneId); return (await pathExists(file)) ? SceneSchema.parse(await readJsonFile(file)) : null }
}
