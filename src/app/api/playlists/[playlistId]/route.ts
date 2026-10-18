import { NextResponse } from 'next/server'
import { getPlaylistRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export async function GET(_request: Request, ctx: { params: Promise<{ playlistId: string }> }) {
  const { playlistId } = await ctx.params
  const world = await getCurrentWorld()
  const playlist = await getPlaylistRepository().getPlaylist(world.id, playlistId)
  if (!playlist) return NextResponse.json({ error: 'Playlist não encontrada' }, { status: 404 })
  return NextResponse.json(playlist)
}
