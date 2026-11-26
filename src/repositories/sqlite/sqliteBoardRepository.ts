import 'server-only'
import {
  BOARD_SCHEMA_VERSION,
  BoardDocumentSchema,
  CreateBoardInputSchema,
  type BoardDocument,
  type BoardSummary,
  type CreateBoardInput,
} from '@/domain/boards/board'
import { newId } from '@/lib/ids'
import type { BoardRepository } from '@/repositories/contracts/boardRepository'
import { BoardNotFoundError } from '@/repositories/filesystem/fileSystemBoardRepository'
import type { SqliteDatabase } from './database'
import { DocumentTable } from './documentTable'

export class SqliteBoardRepository implements BoardRepository {
  private readonly boards: DocumentTable<BoardDocument>

  constructor(db: SqliteDatabase) {
    this.boards = new DocumentTable(db, 'boards', BoardDocumentSchema)
  }

  async listBoards(worldId: string): Promise<BoardSummary[]> {
    return this.boards.read(worldId, () => this.boards.list(worldId).map((board) => ({
      schemaVersion: board.schemaVersion,
      id: board.id,
      worldId: board.worldId,
      title: board.title,
      description: board.description,
      tags: board.tags,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    })))
  }

  async getBoard(worldId: string, boardId: string): Promise<BoardDocument | null> {
    return this.boards.read(worldId, () => this.boards.get(worldId, boardId))
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
    return this.boards.write(worldId, () => this.boards.insert(board))
  }

  async saveBoard(worldId: string, boardId: string, canvasSnapshot: unknown): Promise<BoardDocument> {
    return this.boards.write(worldId, () => {
      const current = this.boards.get(worldId, boardId)
      if (!current) throw new BoardNotFoundError(boardId)
      const next = BoardDocumentSchema.parse({ ...current, canvasSnapshot, updatedAt: new Date().toISOString() })
      return this.boards.update(worldId, boardId, next)
    })
  }

  async deleteBoard(worldId: string, boardId: string): Promise<void> {
    this.boards.write(worldId, () => {
      if (!this.boards.delete(worldId, boardId)) throw new BoardNotFoundError(boardId)
    })
  }
}
