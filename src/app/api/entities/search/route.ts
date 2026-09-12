import { NextResponse } from 'next/server'
import { searchEntities } from '@/services/search/searchEntities'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const query = url.searchParams.get('q') ?? ''
  const type = url.searchParams.get('type') ?? undefined
  const requestedLimit = Number(url.searchParams.get('limit') ?? 8)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100) : 8

  const world = await getCurrentWorld()
  const results = await searchEntities(world.id, query, { type, limit })
  return NextResponse.json(results)
}
