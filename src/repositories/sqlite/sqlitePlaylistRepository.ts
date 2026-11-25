import 'server-only'
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
  type Track,
  type UpdatePlaylistInput,
} from '@/domain/playlists/playlist'
import { newId } from '@/lib/ids'
import type { PlaylistRepository } from '@/repositories/contracts/playlistRepository'
import { PlaylistNotFoundError } from '@/repositories/filesystem/fileSystemPlaylistRepository'
import type { SqliteDatabase } from './database'
import { DocumentTable } from './documentTable'

export class SqlitePlaylistRepository implements PlaylistRepository {
  private readonly playlists: DocumentTable<Playlist>

  constructor(db: SqliteDatabase) {
    this.playlists = new DocumentTable(db, 'playlists', PlaylistSchema)
  }

  async listPlaylists(worldId: string): Promise<PlaylistSummary[]> {
    return this.playlists.read(worldId, () => this.playlists.list(worldId).map(({ tracks, ...summary }) => ({
      ...summary,
      trackCount: tracks.length,
      previewExternalIds: tracks.slice(0, 4).map((track) => track.externalId),
    })))
  }

  async getPlaylist(worldId: string, playlistId: string): Promise<Playlist | null> {
    return this.playlists.read(worldId, () => this.playlists.get(worldId, playlistId))
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
    return this.playlists.write(worldId, () => this.playlists.insert(playlist))
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
    const playlist = this.mutate(worldId, playlistId, (current) => {
      const known = new Set(current.tracks.map((track) => `${track.provider}:${track.externalId}`))
      const addedAt = new Date().toISOString()
      const added: Track[] = []
      for (const track of parsedTracks) {
        const key = `${track.provider}:${track.externalId}`
        if (known.has(key)) {
          skipped += 1
          continue
        }
        known.add(key)
        added.push({ ...track, id: newId(), author: track.author || undefined, addedAt })
      }
      return { ...current, tracks: [...current.tracks, ...added] }
    })
    return { playlist, skipped }
  }

  async removeTrack(worldId: string, playlistId: string, trackId: string): Promise<Playlist> {
    return this.mutate(worldId, playlistId, (current) => ({
      ...current,
      tracks: current.tracks.filter((track) => track.id !== trackId),
    }))
  }

  async deletePlaylist(worldId: string, playlistId: string): Promise<void> {
    this.playlists.write(worldId, () => {
      if (!this.playlists.delete(worldId, playlistId)) throw new PlaylistNotFoundError(playlistId)
    })
  }

  private mutate(worldId: string, playlistId: string, change: (current: Playlist) => Playlist): Playlist {
    return this.playlists.write(worldId, () => {
      const current = this.playlists.get(worldId, playlistId)
      if (!current) throw new PlaylistNotFoundError(playlistId)
      const next = PlaylistSchema.parse({ ...change(current), updatedAt: new Date().toISOString() })
      return this.playlists.update(worldId, playlistId, next)
    })
  }
}
