import 'server-only'
import { readdir, rename } from 'node:fs/promises'
import path from 'node:path'
import {
  CreatePlaylistInputSchema,
  NewTrackInputSchema,
  PLAYLIST_SCHEMA_VERSION,
  PlaylistSchema,
  UpdatePlaylistInputSchema,
  type CreatePlaylistInput,
  type NewTrackInput,
  type Playlist,
  type PlaylistSummary,
  type UpdatePlaylistInput,
} from '@/domain/playlists/playlist'
import { atomicWriteJson, ensureDir, pathExists, readJsonFile } from '@/lib/fs/atomicWrite'
import { getPlaylistDir, getPlaylistJsonPath, getPlaylistsDir, getTrashDir } from '@/lib/fs/paths'
import { newId } from '@/lib/ids'
import type { PlaylistRepository } from '@/repositories/contracts/playlistRepository'
import { resolveWorldDir } from '@/repositories/filesystem/worldDirRegistry'

export class PlaylistNotFoundError extends Error {
  constructor(playlistId: string) {
    super(`Playlist not found: ${playlistId}`)
    this.name = 'PlaylistNotFoundError'
  }
}

export class FileSystemPlaylistRepository implements PlaylistRepository {
  async listPlaylists(worldId: string): Promise<PlaylistSummary[]> {
    const worldDir = await resolveWorldDir(worldId)
    const playlistsDir = getPlaylistsDir(worldDir)
    if (!(await pathExists(playlistsDir))) return []
    const entries = await readdir(playlistsDir, { withFileTypes: true })
    const playlists = await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => this.readByDir(worldDir, entry.name)))
    return playlists
      .filter((playlist): playlist is Playlist => playlist !== null)
      .map(({ tracks, ...rest }): PlaylistSummary => ({ ...rest, trackCount: tracks.length, previewExternalIds: tracks.slice(0, 4).map((track) => track.externalId) }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async getPlaylist(worldId: string, playlistId: string): Promise<Playlist | null> {
    return this.readByDir(await resolveWorldDir(worldId), playlistId)
  }

  async createPlaylist(worldId: string, input: CreatePlaylistInput): Promise<Playlist> {
    const parsed = CreatePlaylistInputSchema.parse(input)
    const now = new Date().toISOString()
    const playlist = PlaylistSchema.parse({
      schemaVersion: PLAYLIST_SCHEMA_VERSION,
      id: newId(),
      worldId,
      title: parsed.title,
      description: parsed.description || undefined,
      tags: parsed.tags,
      tracks: [],
      createdAt: now,
      updatedAt: now,
    })
    const worldDir = await resolveWorldDir(worldId)
    await atomicWriteJson(getPlaylistJsonPath(worldDir, playlist.id), playlist)
    return playlist
  }

  async updatePlaylist(worldId: string, playlistId: string, patch: UpdatePlaylistInput): Promise<Playlist> {
    const parsed = UpdatePlaylistInputSchema.parse(patch)
    return this.mutate(worldId, playlistId, (current) => ({
      ...current,
      title: parsed.title ?? current.title,
      description: parsed.description === undefined ? current.description : parsed.description || undefined,
      tags: parsed.tags ?? current.tags,
    }))
  }

  async addTracks(worldId: string, playlistId: string, tracks: NewTrackInput[]): Promise<{ playlist: Playlist; skipped: number }> {
    const parsedTracks = tracks.map((track) => NewTrackInputSchema.parse(track))
    let skipped = 0
    const playlist = await this.mutate(worldId, playlistId, (current) => {
      const known = new Set(current.tracks.map((track) => `${track.provider}:${track.externalId}`))
      const now = new Date().toISOString()
      const added = parsedTracks.flatMap((track) => {
        const key = `${track.provider}:${track.externalId}`
        if (known.has(key)) { skipped += 1; return [] }
        known.add(key)
        return [{ id: newId(), provider: track.provider, externalId: track.externalId, title: track.title, author: track.author || undefined, addedAt: now }]
      })
      return { ...current, tracks: [...current.tracks, ...added] }
    })
    return { playlist, skipped }
  }

  async removeTrack(worldId: string, playlistId: string, trackId: string): Promise<Playlist> {
    return this.mutate(worldId, playlistId, (current) => ({ ...current, tracks: current.tracks.filter((track) => track.id !== trackId) }))
  }

  async deletePlaylist(worldId: string, playlistId: string): Promise<void> {
    const worldDir = await resolveWorldDir(worldId)
    const playlistDir = getPlaylistDir(worldDir, playlistId)
    if (!(await pathExists(playlistDir))) throw new PlaylistNotFoundError(playlistId)
    const trashDir = getTrashDir(worldDir)
    await ensureDir(trashDir)
    await rename(playlistDir, path.join(trashDir, `playlist-${playlistId}-${Date.now()}`))
  }

  private async mutate(worldId: string, playlistId: string, change: (current: Playlist) => Playlist): Promise<Playlist> {
    const worldDir = await resolveWorldDir(worldId)
    const current = await this.readByDir(worldDir, playlistId)
    if (!current) throw new PlaylistNotFoundError(playlistId)
    const next = PlaylistSchema.parse({ ...change(current), updatedAt: new Date().toISOString() })
    await atomicWriteJson(getPlaylistJsonPath(worldDir, playlistId), next)
    return next
  }

  private async readByDir(worldDir: string, playlistId: string): Promise<Playlist | null> {
    const playlistPath = getPlaylistJsonPath(worldDir, playlistId)
    if (!(await pathExists(playlistPath))) return null
    return PlaylistSchema.parse(await readJsonFile(playlistPath))
  }
}
