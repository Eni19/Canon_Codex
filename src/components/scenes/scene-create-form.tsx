'use client'
import { useMemo, useState } from 'react'
import { createSceneAction } from '@/app/actions/scenes'
import { MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardPickerField } from '@/components/ui/card-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export interface SceneLocationOption { id: string; title: string; subtitle?: string; coverAssetId?: string; assets: Array<{ id: string; label: string }> }
export function SceneCreateForm({ locations }: { locations: SceneLocationOption[] }) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '')
  const locationItems = useMemo(() => locations.map((l) => ({ id: l.id, title: l.title, subtitle: l.subtitle, imageAssetId: l.coverAssetId ?? l.assets[0]?.id })), [locations])
  const assets = useMemo(() => locations.find((l) => l.id === locationId)?.assets ?? [], [locations, locationId])
  return <form action={createSceneAction} className="space-y-4">
    <div className="space-y-1.5"><Label htmlFor="scene-title">Nome da cena</Label><Input id="scene-title" name="title" required placeholder="Orfanato — Entrada" /></div>
    <div className="space-y-1.5"><Label htmlFor="scene-location">Local</Label><CardPickerField id="scene-location" name="locationId" value={locationId} onChange={setLocationId} items={locationItems} title="Escolher local" placeholder="Escolha um local" searchPlaceholder="Buscar local por nome" emptyMessage="Nenhum local encontrado." fallbackIcon={<MapPin />} /></div>
    <div className="space-y-1.5"><Label htmlFor="scene-asset">Imagem ou mapa</Label><select key={locationId} id="scene-asset" name="assetId" required className="h-9 w-full rounded-md border bg-popover px-3 text-sm text-popover-foreground [color-scheme:dark]"><option className="bg-popover text-popover-foreground" value="">Escolha uma imagem</option>{assets.map((a) => <option className="bg-popover text-popover-foreground" key={a.id} value={a.id}>{a.label}</option>)}</select>{locationId && assets.length === 0 && <p className="text-xs text-warning">Este local ainda não possui imagens.</p>}</div>
    <div className="space-y-1.5"><Label htmlFor="scene-description">Descrição</Label><Textarea id="scene-description" name="description" rows={2} /></div>
    <div className="space-y-1.5"><Label htmlFor="scene-tags">Etiquetas</Label><Input id="scene-tags" name="tags" placeholder="combate, sessão 4" /></div>
    <Button className="w-full" disabled={!locationId || assets.length === 0}>Criar cena</Button>
  </form>
}
