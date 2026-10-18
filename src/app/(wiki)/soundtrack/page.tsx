import Image from 'next/image'
import Link from 'next/link'
import { connection } from 'next/server'
import { ArrowRight, Music, Plus } from 'lucide-react'
import { createPlaylistAction } from '@/app/actions/playlists'
import { DeletePlaylistButton } from '@/components/soundtrack/delete-playlist-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { youtubeThumbnailUrl } from '@/lib/youtube/parseYoutubeUrl'
import { getPlaylistRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export default async function SoundtrackPage() {
  await connection()
  const world = await getCurrentWorld()
  const playlists = await getPlaylistRepository().listPlaylists(world.id)

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.22em] text-primary uppercase">Ambientação</p>
          <h1 className="font-serif text-4xl font-semibold">Trilha sonora</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Monte playlists com links do YouTube — mistério, investigação, combate, melancolia — e toque sem sair do site. Só os links ficam guardados; nada é baixado.</p>
        </div>
        <Music className="hidden size-12 text-primary/50 sm:block" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_19rem]">
        <section>
          {playlists.length === 0 ? (
            <div className="grid min-h-72 place-items-center border border-dashed border-border bg-card/25 p-8 text-center">
              <div><Music className="mx-auto mb-4 size-10 text-primary/60" /><h2 className="font-serif text-2xl">Nenhuma playlist ainda</h2><p className="mt-2 text-sm text-muted-foreground">Crie a primeira para começar a montar a trilha da sua mesa.</p></div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {playlists.map((playlist) => (
                <article key={playlist.id} className="group relative overflow-hidden border border-border bg-card/55 transition-colors hover:border-primary/45 hover:bg-card">
                  <div className="grid aspect-[16/6] grid-cols-4 bg-black/60">
                    {playlist.previewExternalIds.length > 0
                      ? playlist.previewExternalIds.map((videoId) => <Image key={videoId} src={youtubeThumbnailUrl(videoId)} alt="" width={320} height={180} unoptimized loading="lazy" className="size-full object-cover opacity-80" />)
                      : <div className="col-span-4 grid place-items-center text-primary/40"><Music className="size-8" /></div>}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="text-[0.65rem] tracking-[0.18em] text-primary uppercase">{playlist.trackCount} {playlist.trackCount === 1 ? 'faixa' : 'faixas'}</p><h2 className="mt-1 truncate font-serif text-xl font-semibold">{playlist.title}</h2></div>
                      <DeletePlaylistButton playlistId={playlist.id} title={playlist.title} />
                    </div>
                    {playlist.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{playlist.description}</p>}
                    {playlist.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{playlist.tags.map((tag) => <span key={tag} className="bg-primary/10 px-2 py-1 text-[0.65rem] text-primary uppercase">{tag}</span>)}</div>}
                    <div className="mt-4 flex justify-end border-t border-border pt-3 text-xs">
                      <Link href={`/soundtrack/${playlist.id}`} className="flex items-center gap-1 font-medium text-foreground hover:text-primary">Abrir <ArrowRight className="size-3.5" /></Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="h-fit border border-border bg-card/45 p-5">
          <h2 className="flex items-center gap-2 font-serif text-xl"><Plus className="size-4 text-primary" /> Nova playlist</h2>
          <form action={createPlaylistAction} className="mt-5 space-y-4">
            <div className="space-y-1.5"><Label htmlFor="playlist-title">Nome</Label><Input id="playlist-title" name="title" required placeholder="Investigação tensa" /></div>
            <div className="space-y-1.5"><Label htmlFor="playlist-description">Descrição</Label><Textarea id="playlist-description" name="description" rows={3} placeholder="Quando usar esta trilha?" /></div>
            <div className="space-y-1.5"><Label htmlFor="playlist-tags">Etiquetas</Label><Input id="playlist-tags" name="tags" placeholder="mistério, suspense" /><p className="text-xs text-muted-foreground">Separe por vírgulas.</p></div>
            <Button type="submit" className="w-full"><Plus className="size-4" />Criar playlist</Button>
          </form>
        </aside>
      </div>
    </div>
  )
}
