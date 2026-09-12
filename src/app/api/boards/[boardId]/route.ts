import { NextResponse } from 'next/server'
import { getBoardRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export async function PUT(request: Request, ctx: RouteContext<'/api/boards/[boardId]'>) {
  const { boardId } = await ctx.params
  const body: unknown = await request.json()
  const snapshot = typeof body === 'object' && body !== null && 'snapshot' in body ? body.snapshot : undefined
  if (snapshot === undefined) return NextResponse.json({ error: 'Snapshot ausente' }, { status: 400 })
  const world = await getCurrentWorld()
  const board = await getBoardRepository().saveBoard(world.id, boardId, snapshot)
  return NextResponse.json({ updatedAt: board.updatedAt })
}
