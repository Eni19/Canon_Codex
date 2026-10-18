import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getTrashDir } from '@/lib/fs/paths'
import { FileSystemPlaylistRepository } from '@/repositories/filesystem/fileSystemPlaylistRepository'
import { FileSystemWorldRepository } from '@/repositories/filesystem/fileSystemWorldRepository'
import { resolveWorldDir } from '@/repositories/filesystem/worldDirRegistry'

describe('FileSystemPlaylistRepository', () => {
  let workspaceDir: string
  let repository: FileSystemPlaylistRepository
  let worldId: string

  beforeEach(async () => {
    workspaceDir = await mkdtemp(path.join(tmpdir(), 'wiki-playlist-test-'))
    process.env.WIKI_WORKSPACE_DIR = workspaceDir
    repository = new FileSystemPlaylistRepository()
    const [world] = await new FileSystemWorldRepository().listWorlds()
    worldId = world.id
  })

  afterEach(async () => {
    delete process.env.WIKI_WORKSPACE_DIR
    await rm(workspaceDir, { recursive: true, force: true })
  })

  it('creates a playlist, adds tracks without duplicating and lists a summary', async () => {
    const created = await repository.createPlaylist(worldId, { title: 'Investigação', description: 'Tensão baixa', tags: ['mistério'] })
    const first = await repository.addTracks(worldId, created.id, [
      { externalId: 'jNQXAC9IVRw', title: 'Me at the zoo', author: 'jawed' },
      { externalId: 'dQw4w9WgXcQ', title: 'Outra faixa' },
    ])
    const second = await repository.addTracks(worldId, created.id, [{ externalId: 'jNQXAC9IVRw', title: 'Repetida' }])

    expect(first.playlist.tracks.map((track) => track.externalId)).toEqual(['jNQXAC9IVRw', 'dQw4w9WgXcQ'])
    expect(second.skipped).toBe(1)
    expect(second.playlist.tracks).toHaveLength(2)

    const summaries = await repository.listPlaylists(worldId)
    expect(summaries).toHaveLength(1)
    expect(summaries[0]).not.toHaveProperty('tracks')
    expect(summaries[0].trackCount).toBe(2)
    expect(summaries[0].previewExternalIds).toEqual(['jNQXAC9IVRw', 'dQw4w9WgXcQ'])
  })

  it('updates metadata, removes a track and keeps everything else', async () => {
    const created = await repository.createPlaylist(worldId, { title: 'Combate' })
    const { playlist } = await repository.addTracks(worldId, created.id, [{ externalId: 'jNQXAC9IVRw', title: 'A' }, { externalId: 'dQw4w9WgXcQ', title: 'B' }])

    await repository.updatePlaylist(worldId, created.id, { title: 'Combate épico', description: 'Ritmo alto', tags: ['ação'] })
    const afterRemoval = await repository.removeTrack(worldId, created.id, playlist.tracks[0].id)

    expect(afterRemoval.title).toBe('Combate épico')
    expect(afterRemoval.description).toBe('Ritmo alto')
    expect(afterRemoval.tags).toEqual(['ação'])
    expect(afterRemoval.tracks.map((track) => track.title)).toEqual(['B'])
  })

  it('moves a deleted playlist to the world trash instead of erasing it', async () => {
    const created = await repository.createPlaylist(worldId, { title: 'Melancolia' })
    await repository.deletePlaylist(worldId, created.id)

    expect(await repository.getPlaylist(worldId, created.id)).toBeNull()
    expect(await repository.listPlaylists(worldId)).toEqual([])
    const trash = await readdir(getTrashDir(await resolveWorldDir(worldId)))
    expect(trash.some((name) => name.startsWith(`playlist-${created.id}`))).toBe(true)
  })

  it('rejects changes to a playlist that does not exist', async () => {
    await expect(repository.addTracks(worldId, crypto.randomUUID(), [{ externalId: 'jNQXAC9IVRw', title: 'A' }])).rejects.toThrow('Playlist not found')
  })
})
