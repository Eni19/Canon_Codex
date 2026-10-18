import { z } from 'zod'

export const PLAYLIST_SCHEMA_VERSION = 1

export const TrackProviderSchema = z.enum(['youtube'])
export type TrackProvider = z.infer<typeof TrackProviderSchema>

export const TrackSchema = z.object({
  id: z.uuid(),
  provider: TrackProviderSchema,
  /** Provider-side id (YouTube video id). Only links are stored; nothing is downloaded. */
  externalId: z.string().min(1),
  title: z.string().min(1),
  author: z.string().optional(),
  addedAt: z.iso.datetime(),
})
export type Track = z.infer<typeof TrackSchema>

export const NewTrackInputSchema = z.object({
  provider: TrackProviderSchema.default('youtube'),
  externalId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  author: z.string().trim().optional(),
})
export type NewTrackInput = z.input<typeof NewTrackInputSchema>

export const PlaylistSchema = z.object({
  schemaVersion: z.number().int(),
  id: z.uuid(),
  worldId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()),
  tracks: z.array(TrackSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
export type Playlist = z.infer<typeof PlaylistSchema>

export type PlaylistSummary = Omit<Playlist, 'tracks'> & {
  trackCount: number
  /** Provider ids of the first tracks, used to build the card artwork. */
  previewExternalIds: string[]
}

export const CreatePlaylistInputSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  tags: z.array(z.string()).default([]),
})
export type CreatePlaylistInput = z.input<typeof CreatePlaylistInputSchema>

export const UpdatePlaylistInputSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  tags: z.array(z.string()).optional(),
})
export type UpdatePlaylistInput = z.infer<typeof UpdatePlaylistInputSchema>
