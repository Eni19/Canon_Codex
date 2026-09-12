import 'server-only'
import { readdir, rename } from 'node:fs/promises'
import path from 'node:path'
import {
  BOARD_SCHEMA_VERSION,
  BoardDocumentSchema,
  CreateBoardInputSchema,
  type BoardDocument,
  type BoardSummary,
  type CreateBoardInput,
} from '@/domain/boards/board'
import { atomicWriteJson, ensureDir, pathExists, readJsonFile } from '@/lib/fs/atomicWrite'
import { getBoardDir, getBoardJsonPath, getBoardsDir, getTrashDir } from '@/lib/fs/paths'
import { newId } from '@/lib/ids'
import type { BoardRepository } from '@/repositories/contracts/boardRepository'
import { resolveWorldDir } from '@/repositories/filesystem/worldDirRegistry'

export class BoardNotFoundError extends Error {
  constructor(boardId: string) {
    super(`Board not found: ${boardId}`)
    this.name = 'BoardNotFoundError'
  }
}

export class FileSystemBoardRepository implements BoardRepository {
  async listBoards(worldId: string): Promise<BoardSummary[]> {
    const worldDir = await resolveWorldDir(worldId)
    const boardsDir = getBoardsDir(worldDir)
    if (!(await pathExists(boardsDir))) return []
    const entries = await readdir(boardsDir, { withFileTypes: true })
    const boards = await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => this.readByDir(worldDir, entry.name)))
    return boards
      .filter((board): board is BoardDocument => board !== null)
      .map((board): BoardSummary => ({
        schemaVersion: board.schemaVersion,
        id: board.id,
        worldId: board.worldId,
        title: board.title,
        description: board.description,
        tags: board.tags,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async getBoard(worldId: string, boardId: string): Promise<BoardDocument | null> {
    return this.readByDir(await resolveWorldDir(worldId), boardId)
  }

  async createBoard(worldId: string, input: CreateBoardInput): Promise<BoardDocument> {
    const parsed = CreateBoardInputSchema.parse(input)
    const now = new Date().toISOString()
    const board = BoardDocumentSchema.parse({
      schemaVersion: BOARD_SCHEMA_VERSION,
      id: newId(),
      worldId,
      title: parsed.title,
      description: parsed.description || undefined,
      tags: parsed.tags,
      canvasSnapshot: null,
      createdAt: now,
      updatedAt: now,
    })
    const worldDir = await resolveWorldDir(worldId)
    await atomicWriteJson(getBoardJsonPath(worldDir, board.id), board)
    return board
  }

  async saveBoard(worldId: string, boardId: string, canvasSnapshot: unknown): Promise<BoardDocument> {
    const worldDir = await resolveWorldDir(worldId)
    const current = await this.readByDir(worldDir, boardId)
    if (!current) throw new BoardNotFoundError(boardId)
    const next = BoardDocumentSchema.parse({ ...current, canvasSnapshot, updatedAt: new Date().toISOString() })
    await atomicWriteJson(getBoardJsonPath(worldDir, boardId), next)
    return next
  }

  async deleteBoard(worldId: string, boardId: string): Promise<void> {
    const worldDir = await resolveWorldDir(worldId)
    const boardDir = getBoardDir(worldDir, boardId)
    if (!(await pathExists(boardDir))) throw new BoardNotFoundError(boardId)
    const trashDir = getTrashDir(worldDir)
    await ensureDir(trashDir)
    await rename(boardDir, path.join(trashDir, `board-${boardId}-${Date.now()}`))
  }

  private async readByDir(worldDir: string, boardId: string): Promise<BoardDocument | null> {
    const boardPath = getBoardJsonPath(worldDir, boardId)
    if (!(await pathExists(boardPath))) return null
    return BoardDocumentSchema.parse(await readJsonFile(boardPath))
  }
}
