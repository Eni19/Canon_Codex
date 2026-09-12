'use client'

import Image from 'next/image'
import { MapPin, Plus, X } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { LocationDiscovery, LocationPoint } from '@/domain/entities/locationPoint'
import { assetVariantUrl } from '@/lib/assetUrl'

export interface LocationPointTarget { id: string; title: string; type: 'evidence' | 'document' }

export function LocationPointsEditor({ coverAssetId, initialPoints, targets }: {
  coverAssetId?: string
  initialPoints: LocationPoint[]
  targets: LocationPointTarget[]
}) {
  const [points, setPoints] = useState(initialPoints)
  const [activeId, setActiveId] = useState<string | null>(initialPoints[0]?.id ?? null)
  const active = points.find((point) => point.id === activeId)
  const update = (id: string, patch: Partial<LocationPoint>) => setPoints((current) => current.map((point) => point.id === id ? { ...point, ...patch } : point))

  function addPoint() {
    const point: LocationPoint = { id: crypto.randomUUID(), label: `Ponto ${points.length + 1}`, kind: 'text', discoveries: [], x: 50, y: 50 }
    setPoints((current) => [...current, point])
    setActiveId(point.id)
  }

  function addDiscovery(point: LocationPoint) {
    const discovery: LocationDiscovery = { id: crypto.randomUUID(), approach: '', condition: '', information: '' }
    update(point.id, { discoveries: [...point.discoveries, discovery] })
  }

  function updateDiscovery(point: LocationPoint, discoveryId: string, patch: Partial<LocationDiscovery>) {
    update(point.id, { discoveries: point.discoveries.map((item) => item.id === discoveryId ? { ...item, ...patch } : item) })
  }

  function placePoint(event: MouseEvent<HTMLDivElement>) {
    if (!active) return
    const rect = event.currentTarget.getBoundingClientRect()
    update(active.id, {
      x: Math.round(((event.clientX - rect.left) / rect.width) * 1000) / 10,
      y: Math.round(((event.clientY - rect.top) / rect.height) * 1000) / 10,
    })
  }

  return (
    <div className="mt-6 border-t border-border pt-4">
      <input type="hidden" name="pointsOfInterest" value={JSON.stringify(points)} />
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Pontos de interesse</h2>
          <p className="text-xs text-muted-foreground">Selecione um ponto e clique na imagem para posicioná-lo.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addPoint} disabled={points.length >= 30}><Plus className="size-4" />Adicionar</Button>
      </div>
      {coverAssetId && (
        <div className="relative mb-4 aspect-16/10 cursor-crosshair overflow-hidden border border-primary/35 bg-muted" onClick={placePoint}>
          <Image src={assetVariantUrl(coverAssetId, 'original')} alt="" fill sizes="672px" className="object-contain" />
          {points.map((point, index) => (
            <button key={point.id} type="button" aria-label={`Selecionar ${point.label}`} onClick={(event) => { event.stopPropagation(); setActiveId(point.id) }}
              className={`absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border text-xs font-bold shadow-md ${activeId === point.id ? 'border-primary-foreground bg-primary text-primary-foreground' : 'border-primary bg-background text-primary'}`}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}>{index + 1}</button>
          ))}
        </div>
      )}
      {!coverAssetId && <p className="mb-4 border border-dashed border-border p-4 text-sm text-muted-foreground">Importe uma imagem principal para posicionar os pontos.</p>}
      <div className="grid gap-3">
        {points.map((point, index) => (
          <div key={point.id} className={`border p-3 ${activeId === point.id ? 'border-primary/60 bg-primary/5' : 'border-border'}`}>
            <div className="flex items-center gap-2">
              <button type="button" className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground" onClick={() => setActiveId(point.id)}>{index + 1}</button>
              <Input aria-label="Nome do ponto" value={point.label} onChange={(event) => update(point.id, { label: event.target.value })} />
              <select aria-label="Tipo do ponto" value={point.kind} onChange={(event) => update(point.id, { kind: event.target.value as LocationPoint['kind'], targetId: undefined })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                <option value="text">Texto</option><option value="evidence">Evidência</option><option value="document">Documento</option>
              </select>
              <Button type="button" variant="ghost" size="icon" aria-label={`Apagar ${point.label}`} onClick={() => { setPoints((current) => current.filter((item) => item.id !== point.id)); if (activeId === point.id) setActiveId(null) }}><X className="size-4" /></Button>
            </div>
            <Textarea className="mt-3" rows={3} aria-label="Apresentação do ponto" placeholder="Apresentação — o que pode ser percebido ao investigar este ponto..." value={point.basicDescription ?? point.description ?? ''} onChange={(event) => update(point.id, { basicDescription: event.target.value, description: undefined })} />
            {point.kind !== 'text' && (
              <select className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={point.targetId ?? ''} onChange={(event) => update(point.id, { targetId: event.target.value || undefined })}>
                <option value="">Selecione {point.kind === 'evidence' ? 'uma evidência' : 'um documento'}</option>
                {targets.filter((target) => target.type === point.kind).map((target) => <option key={target.id} value={target.id}>{target.title}</option>)}
              </select>
            )}
            <div className="mt-4 border-t border-border pt-3">
              <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Descobertas</p><p className="text-xs text-muted-foreground">Defina livremente como a informação pode ser encontrada.</p></div><Button type="button" variant="outline" size="sm" onClick={() => addDiscovery(point)} disabled={point.discoveries.length >= 20}><Plus className="size-3" />Linha</Button></div>
              <div className="mt-2 grid gap-2">
                {point.discoveries.map((discovery) => (
                  <div key={discovery.id} className="grid gap-2 border-l-2 border-primary/40 pl-3 sm:grid-cols-[1fr_0.8fr_auto]">
                    <Input aria-label="Abordagem" placeholder="Abordagem (observar, conversar...)" value={discovery.approach} onChange={(event) => updateDiscovery(point, discovery.id, { approach: event.target.value })} />
                    <Input aria-label="Condição" placeholder="Condição opcional" value={discovery.condition} onChange={(event) => updateDiscovery(point, discovery.id, { condition: event.target.value })} />
                    <Button type="button" variant="ghost" size="icon" aria-label="Apagar descoberta" onClick={() => update(point.id, { discoveries: point.discoveries.filter((item) => item.id !== discovery.id) })}><X className="size-4" /></Button>
                    <Textarea className="sm:col-span-3" rows={2} aria-label="Informação descoberta" placeholder="Informação revelada..." value={discovery.information} onChange={(event) => updateDiscovery(point, discovery.id, { information: event.target.value })} />
                  </div>
                ))}
              </div>
            </div>
            <Textarea className="mt-4" rows={4} aria-label="Notas contextuais" placeholder="Notas contextuais — segredos, consequências e orientações para quem conduz..." value={point.contextualDescription ?? ''} onChange={(event) => update(point.id, { contextualDescription: event.target.value })} />
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" />{point.x.toFixed(1)}%, {point.y.toFixed(1)}%</p>
          </div>
        ))}
      </div>
    </div>
  )
}
