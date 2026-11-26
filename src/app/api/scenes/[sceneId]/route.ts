import { NextResponse } from 'next/server'
import { SceneGridSchema } from '@/domain/scenes/scene'
import { SceneCanvasSchema } from '@/domain/scenes/sceneCanvas'
import { getSceneRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'
export async function PUT(request: Request, ctx: { params: Promise<{ sceneId: string }> }) {
  const { sceneId } = await ctx.params, body = await request.json() as { snapshot?: unknown; grid?: unknown }
  const canvas = body.snapshot !== undefined ? SceneCanvasSchema.safeParse(body.snapshot) : undefined
  const grid = body.grid ? SceneGridSchema.safeParse(body.grid) : undefined
  if (canvas?.success === false || grid?.success === false) return NextResponse.json({ error: 'Canvas ou grade inválidos' }, { status: 400 })
  const world = await getCurrentWorld()
  const scene = await getSceneRepository().saveScene(world.id, sceneId, { ...(canvas ? { canvasSnapshot: canvas.data } : {}), ...(grid ? { grid: grid.data } : {}) })
  return NextResponse.json({ updatedAt: scene.updatedAt })
}
