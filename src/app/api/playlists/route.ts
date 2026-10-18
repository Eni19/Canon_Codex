import { NextResponse } from 'next/server'
import { getPlaylistRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export async function GET() {
  const world = await getCurrentWorld()
  return NextResponse.json(await getPlaylistRepository().listPlaylists(world.id))
}
