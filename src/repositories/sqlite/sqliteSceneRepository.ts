import 'server-only'
import {
  SCENE_SCHEMA_VERSION,
  CreateSceneInputSchema,
  SceneGridSchema,
  SceneSchema,
  type CreateSceneInput,
  type Scene,
  type SceneGrid,
  type SceneSummary,
} from '@/domain/scenes/scene'
import { newId } from '@/lib/ids'
import type { SceneRepository } from '@/repositories/contracts/sceneRepository'
import type { SqliteDatabase } from './database'
import { DocumentTable } from './documentTable'

export class SqliteSceneRepository implements SceneRepository {
  private readonly scenes: DocumentTable<Scene>

  constructor(db: SqliteDatabase) {
    this.scenes = new DocumentTable(db, 'scenes', SceneSchema)
  }

  async listScenes(worldId: string): Promise<SceneSummary[]> {
    return this.scenes.read(worldId, () => this.scenes.list(worldId).map((scene) => ({
      schemaVersion: scene.schemaVersion,
      id: scene.id,
      worldId: scene.worldId,
      title: scene.title,
      description: scene.description,
      tags: scene.tags,
      background: scene.background,
      grid: scene.grid,
      createdAt: scene.createdAt,
      updatedAt: scene.updatedAt,
    })))
  }

  async getScene(worldId: string, sceneId: string): Promise<Scene | null> {
    return this.scenes.read(worldId, () => this.scenes.get(worldId, sceneId))
  }

  async createScene(worldId: string, input: CreateSceneInput): Promise<Scene> {
    const data = CreateSceneInputSchema.parse(input)
    const now = new Date().toISOString()
    const scene = SceneSchema.parse({
      schemaVersion: SCENE_SCHEMA_VERSION,
      id: newId(),
      worldId,
      title: data.title,
      description: data.description || undefined,
      tags: data.tags,
      background: { locationId: data.locationId, assetId: data.assetId, width: data.width, height: data.height },
      grid: { enabled: false, type: 'square', cellSize: 70, offsetX: 0, offsetY: 0, opacity: 0.25, snapTokens: false },
      canvasSnapshot: null,
      createdAt: now,
      updatedAt: now,
    })
    return this.scenes.write(worldId, () => this.scenes.insert(scene))
  }

  async saveScene(worldId: string, sceneId: string, patch: { canvasSnapshot?: unknown; grid?: SceneGrid }): Promise<Scene> {
    return this.scenes.write(worldId, () => {
      const current = this.scenes.get(worldId, sceneId)
      if (!current) throw new Error(`Scene not found: ${sceneId}`)
      const next = SceneSchema.parse({
        ...current,
        ...(patch.canvasSnapshot !== undefined ? { canvasSnapshot: patch.canvasSnapshot } : {}),
        ...(patch.grid ? { grid: SceneGridSchema.parse(patch.grid) } : {}),
        updatedAt: new Date().toISOString(),
      })
      return this.scenes.update(worldId, sceneId, next)
    })
  }

  async duplicateScene(worldId: string, sceneId: string): Promise<Scene> {
    return this.scenes.write(worldId, () => {
      const current = this.scenes.get(worldId, sceneId)
      if (!current) throw new Error(`Scene not found: ${sceneId}`)
      const input = CreateSceneInputSchema.parse({
        title: `${current.title} — Cópia`,
        description: current.description,
        tags: current.tags,
        ...current.background,
      })
      const now = new Date().toISOString()
      const copy = SceneSchema.parse({
        ...current,
        schemaVersion: SCENE_SCHEMA_VERSION,
        id: newId(),
        title: input.title,
        description: input.description || undefined,
        tags: input.tags,
        createdAt: now,
        updatedAt: now,
      })
      return this.scenes.insert(copy)
    })
  }

  async deleteScene(worldId: string, sceneId: string): Promise<void> {
    this.scenes.write(worldId, () => { this.scenes.delete(worldId, sceneId) })
  }
}
