import { NextResponse } from 'next/server'
import { SceneGridSchema } from '@/domain/scenes/scene'
import { getSceneRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'
export async function PUT(request: Request, ctx: { params: Promise<{ sceneId: string }> }) {
  const { sceneId } = await ctx.params, body = await request.json() as { snapshot?: unknown; grid?: unknown }
  const world = await getCurrentWorld()
  const scene = await getSceneRepository().saveScene(world.id, sceneId, { ...(body.snapshot !== undefined ? { canvasSnapshot: body.snapshot } : {}), ...(body.grid ? { grid: SceneGridSchema.parse(body.grid) } : {}) })
  return NextResponse.json({ updatedAt: scene.updatedAt })
}
