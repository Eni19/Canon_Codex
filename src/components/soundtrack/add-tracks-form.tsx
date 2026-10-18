'use client'

import { useState } from 'react'
import { Link2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { addVideosAction } from '@/app/actions/playlists'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { listPlaylistVideoIds } from '@/lib/youtube/iframeApi'
import { parseYoutubeLinks } from '@/lib/youtube/parseYoutubeUrl'

export function AddTracksForm({ playlistId }: { playlistId: string }) {
  const [text, setText] = useState('')
  const [progress, setProgress] = useState<string | null>(null)

  async function submit() {
    const { parsed, invalid } = parseYoutubeLinks(text)
    if (parsed.length === 0) {
      toast.error('Cole um link de vídeo ou de playlist do YouTube.')
      return
    }
    try {
      const videoIds: string[] = []
      for (const link of parsed) {
        if (link.kind === 'video') videoIds.push(link.videoId)
        else {
          setProgress('Lendo a playlist do YouTube...')
          videoIds.push(...await listPlaylistVideoIds(link.playlistId))
        }
      }
      setProgress(`Buscando os títulos de ${videoIds.length} faixa(s)...`)
      const result = await addVideosAction(playlistId, videoIds)
      const parts = [`${result.added} faixa(s) adicionada(s)`]
      if (result.duplicates) parts.push(`${result.duplicates} já estavam na playlist`)
      if (result.unavailable) parts.push(`${result.unavailable} indisponível(is) (privadas, removidas ou sem incorporação)`)
      if (invalid.length) parts.push(`${invalid.length} link(s) não reconhecido(s)`)
      if (result.added > 0) toast.success(parts.join(' · '))
      else toast.warning(parts.join(' · '))
      if (result.added > 0 || result.duplicates > 0) setText('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível adicionar as faixas.')
    } finally {
      setProgress(null)
    }
  }

  const busy = progress !== null
  return (
    <div className="border border-border bg-card/40 p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-medium"><Link2 className="size-4 text-primary" />Adicionar faixas</h2>
      <p className="mb-3 text-xs text-muted-foreground">Cole links do YouTube, um por linha. Um link de playlist (<code>youtube.com/playlist?list=…</code>) adiciona todas as músicas dela; um link de vídeo adiciona só aquela faixa.</p>
      <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} disabled={busy} placeholder="https://www.youtube.com/watch?v=…" aria-label="Links do YouTube" />
      <div className="mt-3 flex items-center gap-3">
        <Button type="button" onClick={() => void submit()} disabled={busy || !text.trim()}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}Adicionar</Button>
        {progress && <span className="text-xs text-muted-foreground">{progress}</span>}
      </div>
    </div>
  )
}
