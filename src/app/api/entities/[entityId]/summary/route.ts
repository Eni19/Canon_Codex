import { NextResponse } from 'next/server'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export async function GET(_request: Request, ctx: RouteContext<'/api/entities/[entityId]/summary'>) {
  const { entityId } = await ctx.params
  const world = await getCurrentWorld()
  const entity = await getWorldRepository().getEntity(world.id, entityId)
  if (!entity) return new NextResponse('Not found', { status: 404 })

  return NextResponse.json({ id: entity.id, title: entity.title, type: entity.type })
}
