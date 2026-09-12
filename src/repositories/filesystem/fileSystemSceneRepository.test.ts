import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FileSystemSceneRepository } from './fileSystemSceneRepository'
import { FileSystemWorldRepository } from './fileSystemWorldRepository'

describe('FileSystemSceneRepository', () => {
  let workspace: string, worldId: string, repository: FileSystemSceneRepository
  beforeEach(async () => { workspace = await mkdtemp(path.join(tmpdir(), 'wiki-scene-test-')); process.env.WIKI_WORKSPACE_DIR = workspace; worldId = (await new FileSystemWorldRepository().listWorlds())[0].id; repository = new FileSystemSceneRepository() })
  afterEach(async () => { delete process.env.WIKI_WORKSPACE_DIR; await rm(workspace, { recursive: true, force: true }) })
  it('persists scene state and duplicates it with the same references', async () => {
    const locationId = crypto.randomUUID(), assetId = crypto.randomUUID()
    const scene = await repository.createScene(worldId, { title: 'Entrada', locationId, assetId, width: 1600, height: 900 })
    await repository.saveScene(worldId, scene.id, { canvasSnapshot: { document: { token: 'one' } }, grid: { ...scene.grid, enabled: true } })
    const copy = await repository.duplicateScene(worldId, scene.id)
    expect(copy.background).toEqual(scene.background)
    expect(copy.canvasSnapshot).toEqual({ document: { token: 'one' } })
    expect(copy.grid.enabled).toBe(true)
    expect(await repository.listScenes(worldId)).toHaveLength(2)
  })
})
