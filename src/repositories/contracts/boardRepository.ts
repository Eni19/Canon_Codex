import type { BoardDocument, BoardSummary, CreateBoardInput } from '@/domain/boards/board'

export interface BoardRepository {
  listBoards(worldId: string): Promise<BoardSummary[]>
  getBoard(worldId: string, boardId: string): Promise<BoardDocument | null>
  createBoard(worldId: string, input: CreateBoardInput): Promise<BoardDocument>
  saveBoard(worldId: string, boardId: string, canvasSnapshot: unknown): Promise<BoardDocument>
  deleteBoard(worldId: string, boardId: string): Promise<void>
}
