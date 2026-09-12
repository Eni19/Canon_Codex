'use client'

import Image from 'next/image'
import { Crosshair, Plus, X } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ArtifactDetail } from '@/domain/entities/artifactDetail'
import { assetVariantUrl } from '@/lib/assetUrl'

export function ArtifactDetailsEditor({ coverAssetId, initialDetails }: { coverAssetId?: string; initialDetails: ArtifactDetail[] }) {
  const [details, setDetails] = useState(initialDetails)
  const [activeId, setActiveId] = useState<string | null>(initialDetails[0]?.id ?? null)
  const active = details.find((detail) => detail.id === activeId)
  const update = (id: string, patch: Partial<ArtifactDetail>) => setDetails((current) => current.map((detail) => detail.id === id ? { ...detail, ...patch } : detail))

  function addDetail() {
    const detail: ArtifactDetail = { id: crypto.randomUUID(), label: `Detalhe ${details.length + 1}`, description: '', x: 50, y: 50 }
    setDetails((current) => [...current, detail])
    setActiveId(detail.id)
  }

  function placeDetail(event: MouseEvent<HTMLDivElement>) {
    if (!active) return
    const rect = event.currentTarget.getBoundingClientRect()
    update(active.id, {
      x: Math.round(((event.clientX - rect.left) / rect.width) * 1000) / 10,
      y: Math.round(((event.clientY - rect.top) / rect.height) * 1000) / 10,
    })
  }

  return <section className="mt-2 border-t border-border pt-4">
    <input type="hidden" name="artifactDetails" value={JSON.stringify(details)} />
    <div className="mb-3 flex items-start justify-between gap-3">
      <div><h2 className="text-sm font-medium">Detalhes catalogados</h2><p className="text-xs text-muted-foreground">Selecione um detalhe e clique na fotografia para posicionar seu marcador.</p></div>
      <Button type="button" variant="outline" size="sm" onClick={addDetail} disabled={details.length >= 24}><Plus className="size-4" />Detalhe</Button>
    </div>
    {coverAssetId ? <div className="relative mb-4 aspect-4/3 cursor-crosshair overflow-hidden border border-primary/30 bg-muted/50" onClick={placeDetail}>
      <Image src={assetVariantUrl(coverAssetId, 'original')} alt="" fill sizes="672px" className="object-contain p-5" />
      {details.map((detail, index) => <button key={detail.id} type="button" aria-label={`Selecionar ${detail.label}`} onClick={(event) => { event.stopPropagation(); setActiveId(detail.id) }} style={{ left: `${detail.x}%`, top: `${detail.y}%` }} className={`absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border font-mono text-xs font-bold shadow-lg ${activeId === detail.id ? 'border-primary-foreground bg-primary text-primary-foreground' : 'border-primary bg-background text-primary'}`}>{index + 1}</button>)}
    </div> : <div className="mb-4 flex items-center gap-2 border border-dashed p-4 text-sm text-muted-foreground"><Crosshair className="size-4" />Importe uma imagem principal para posicionar os detalhes.</div>}
    <div className="grid gap-3">
      {details.map((detail, index) => <article key={detail.id} className={`border p-3 ${activeId === detail.id ? 'border-primary/60 bg-primary/5' : 'border-border'}`}>
        <div className="flex items-center gap-2"><button type="button" onClick={() => setActiveId(detail.id)} className="grid size-7 shrink-0 place-items-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">{index + 1}</button><Input aria-label="Nome do detalhe" value={detail.label} onChange={(event) => update(detail.id, { label: event.target.value })}/><Button type="button" variant="ghost" size="icon" aria-label={`Apagar ${detail.label}`} onClick={() => { setDetails((current) => current.filter((item) => item.id !== detail.id)); if (activeId === detail.id) setActiveId(null) }}><X className="size-4" /></Button></div>
        <Textarea className="mt-2" rows={3} aria-label="Descrição do detalhe" placeholder="Inscrição, marca, dano, material ou outra característica observável..." value={detail.description} onChange={(event) => update(detail.id, { description: event.target.value })}/>
        <p className="mt-2 flex items-center gap-1 font-mono text-[0.65rem] text-muted-foreground"><Crosshair className="size-3" />{detail.x.toFixed(1)}%, {detail.y.toFixed(1)}%</p>
      </article>)}
    </div>
  </section>
}
