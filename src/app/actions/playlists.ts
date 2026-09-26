'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isValidVideoId } from '@/lib/youtube/parseYoutubeUrl'
import { getPlaylistRepository } from '@/repositories'
import { fetchYoutubeVideoInfos } from '@/services/soundtrack/youtubeInfo'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

const MAX_IMPORT = 300

function parseTags(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string') return []
  return value.split(',').map((tag) => tag.trim()).filter(Boolean)
}

export async function createPlaylistAction(formData: FormData): Promise<void> {
  const world = await getCurrentWorld()
  const playlist = await getPlaylistRepository().createPlaylist(world.id, {
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    tags: parseTags(formData.get('tags')),
  })
  revalidatePath('/soundtrack')
  redirect(`/soundtrack/${playlist.id}`)
}

export async function updatePlaylistAction(playlistId: string, formData: FormData): Promise<void> {
  const world = await getCurrentWorld()
  await getPlaylistRepository().updatePlaylist(world.id, playlistId, {
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    tags: parseTags(formData.get('tags')),
  })
  revalidatePath('/soundtrack')
  revalidatePath(`/soundtrack/${playlistId}`)
}

export async function deletePlaylistAction(playlistId: string): Promise<void> {
  const world = await getCurrentWorld()
  await getPlaylistRepository().deletePlaylist(world.id, playlistId)
  revalidatePath('/soundtrack')
}

export interface AddVideosResult {
  added: number
  /** Already in the playlist. */
  duplicates: number
  /** Private, deleted or not embeddable: they cannot be played here. */
  unavailable: number
}

export async function addVideosAction(playlistId: string, videoIds: string[]): Promise<AddVideosResult> {
  const unique = [...new Set(videoIds.filter(isValidVideoId))].slice(0, MAX_IMPORT)
  const world = await getCurrentWorld()
  const infos = await fetchYoutubeVideoInfos(unique)
  const found = infos.filter((info): info is NonNullable<typeof info> => info !== null)
  const { playlist, skipped } = await getPlaylistRepository().addTracks(world.id, playlistId, found.map((info) => ({ provider: 'youtube' as const, externalId: info.videoId, title: info.title, author: info.author })))
  revalidatePath('/soundtrack')
  revalidatePath(`/soundtrack/${playlist.id}`)
  return { added: found.length - skipped, duplicates: skipped, unavailable: unique.length - found.length }
}

export async function removeTrackAction(playlistId: string, trackId: string): Promise<void> {
  const world = await getCurrentWorld()
  await getPlaylistRepository().removeTrack(world.id, playlistId, trackId)
  revalidatePath('/soundtrack')
  revalidatePath(`/soundtrack/${playlistId}`)
}
