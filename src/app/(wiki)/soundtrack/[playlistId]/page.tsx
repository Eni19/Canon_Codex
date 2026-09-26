import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { ArrowLeft, Pencil } from 'lucide-react'
import { updatePlaylistAction } from '@/app/actions/playlists'
import { AddTracksForm } from '@/components/soundtrack/add-tracks-form'
import { DeletePlaylistButton } from '@/components/soundtrack/delete-playlist-button'
import { TrackList } from '@/components/soundtrack/track-list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getPlaylistRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export default async function PlaylistPage({ params }: { params: Promise<{ playlistId: string }> }) {
  await connection()
  const { playlistId } = await params
  const world = await getCurrentWorld()
  const playlist = await getPlaylistRepository().getPlaylist(world.id, playlistId)
  if (!playlist) notFound()
  const boundUpdate = updatePlaylistAction.bind(null, playlist.id)

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-10">
      <Link href="/soundtrack" className="mb-5 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="size-3.5" />Trilha sonora</Link>

      <header className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-5">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold tracking-[0.22em] text-primary uppercase">Playlist</p>
          <h1 className="font-serif text-3xl font-semibold">{playlist.title}</h1>
          {playlist.description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{playlist.description}</p>}
          {playlist.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{playlist.tags.map((tag) => <span key={tag} className="bg-primary/10 px-2 py-1 text-[0.65rem] text-primary uppercase">{tag}</span>)}</div>}
        </div>
        <DeletePlaylistButton playlistId={playlist.id} title={playlist.title} redirectTo="/soundtrack" />
      </header>

      <div className="space-y-6">
        <AddTracksForm playlistId={playlist.id} />
        <TrackList playlistId={playlist.id} playlistTitle={playlist.title} tracks={playlist.tracks} />

        <details className="border border-border bg-card/30">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground"><Pencil className="size-3.5" />Editar nome, descrição e etiquetas</summary>
          <form action={boundUpdate} className="space-y-4 border-t border-border p-4">
            <div className="space-y-1.5"><Label htmlFor="edit-title">Nome</Label><Input id="edit-title" name="title" required defaultValue={playlist.title} /></div>
            <div className="space-y-1.5"><Label htmlFor="edit-description">Descrição</Label><Textarea id="edit-description" name="description" rows={3} defaultValue={playlist.description ?? ''} /></div>
            <div className="space-y-1.5"><Label htmlFor="edit-tags">Etiquetas</Label><Input id="edit-tags" name="tags" defaultValue={playlist.tags.join(', ')} /></div>
            <Button type="submit">Salvar</Button>
          </form>
        </details>
      </div>
    </div>
  )
}
