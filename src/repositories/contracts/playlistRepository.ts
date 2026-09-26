import type { CreatePlaylistInput, NewTrackInput, Playlist, PlaylistSummary, UpdatePlaylistInput } from '@/domain/playlists/playlist'

export interface PlaylistRepository {
  listPlaylists(worldId: string): Promise<PlaylistSummary[]>
  getPlaylist(worldId: string, playlistId: string): Promise<Playlist | null>
  createPlaylist(worldId: string, input: CreatePlaylistInput): Promise<Playlist>
  updatePlaylist(worldId: string, playlistId: string, patch: UpdatePlaylistInput): Promise<Playlist>
  /** Appends tracks, skipping ones whose provider id is already in the playlist. Returns the playlist and how many were skipped. */
  addTracks(worldId: string, playlistId: string, tracks: NewTrackInput[]): Promise<{ playlist: Playlist; skipped: number }>
  removeTrack(worldId: string, playlistId: string, trackId: string): Promise<Playlist>
  /** Soft delete: moves the playlist to the world's trash folder. */
  deletePlaylist(worldId: string, playlistId: string): Promise<void>
}
