import type { CreateSceneInput, Scene, SceneGrid, SceneSummary } from '@/domain/scenes/scene'

export interface SceneRepository {
  listScenes(worldId: string): Promise<SceneSummary[]>
  getScene(worldId: string, sceneId: string): Promise<Scene | null>
  createScene(worldId: string, input: CreateSceneInput): Promise<Scene>
  saveScene(worldId: string, sceneId: string, patch: { canvasSnapshot?: unknown; grid?: SceneGrid }): Promise<Scene>
  duplicateScene(worldId: string, sceneId: string): Promise<Scene>
  deleteScene(worldId: string, sceneId: string): Promise<void>
}
