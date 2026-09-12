import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getTrashDir } from '@/lib/fs/paths'
import { FileSystemBoardRepository } from '@/repositories/filesystem/fileSystemBoardRepository'
import { FileSystemWorldRepository } from '@/repositories/filesystem/fileSystemWorldRepository'
import { resolveWorldDir } from '@/repositories/filesystem/worldDirRegistry'

describe('FileSystemBoardRepository', () => {
  let workspaceDir: string
  let repository: FileSystemBoardRepository
  let worldId: string

  beforeEach(async () => {
    workspaceDir = await mkdtemp(path.join(tmpdir(), 'wiki-board-test-'))
    process.env.WIKI_WORKSPACE_DIR = workspaceDir
    repository = new FileSystemBoardRepository()
    const [world] = await new FileSystemWorldRepository().listWorlds()
    worldId = world.id
  })

  afterEach(async () => {
    delete process.env.WIKI_WORKSPACE_DIR
    await rm(workspaceDir, { recursive: true, force: true })
  })

  it('creates, lists and restores a board document snapshot', async () => {
    const created = await repository.createBoard(worldId, { title: 'Caso Klein', description: 'Investigação', tags: ['caso'] })
    const snapshot = { document: { store: { 'shape:test': { type: 'entity-card', props: { entityId: 'entity-1' } } } } }
    await repository.saveBoard(worldId, created.id, snapshot)

    const restored = await repository.getBoard(worldId, created.id)
    const summaries = await repository.listBoards(worldId)

    expect(restored?.canvasSnapshot).toEqual(snapshot)
    expect(summaries).toHaveLength(1)
    expect(summaries[0]).not.toHaveProperty('canvasSnapshot')
    expect(summaries[0].title).toBe('Caso Klein')
  })

  it('soft-deletes a board without touching world entities', async () => {
    const board = await repository.createBoard(worldId, { title: 'Temporário' })
    await repository.deleteBoard(worldId, board.id)

    expect(await repository.getBoard(worldId, board.id)).toBeNull()
    const worldDir = await resolveWorldDir(worldId)
    const trashEntries = await readdir(getTrashDir(worldDir))
    expect(trashEntries.some((entry) => entry.startsWith(`board-${board.id}-`))).toBe(true)
  })
})
