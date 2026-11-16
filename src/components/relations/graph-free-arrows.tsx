'use client'

import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { CardPickerField, type CardPickerItem } from '@/components/ui/card-picker'
import type { ArrowEndpoint } from '@/domain/relations/graphGeometry'
import { FreeArrowSchema, type FreeArrow } from '@/domain/relations/graphSettings'

export function FreeArrowForm({ start, end, items, choose, existing, save }: {
  start: ArrowEndpoint | null; end: ArrowEndpoint | null; items: CardPickerItem[]
  choose: (which: 'start' | 'end', id: string) => void; existing?: FreeArrow; save: (arrow: FreeArrow) => void
}) {
  const id = useId()
  const [color, setColor] = useState(existing?.color ?? '#a64b39')
  const [stroke, setStroke] = useState<FreeArrow['stroke']>(existing?.stroke ?? 'solid')
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!start || !end) return
    const result = FreeArrowSchema.safeParse({ id: existing?.id ?? crypto.randomUUID(), start: start.point, end: end.point, startCardId: start.cardId, endCardId: end.cardId, color, stroke })
    if (!result.success) { setError('Não foi possível salvar a seta. Marque as pontas novamente.'); return }
    save(result.data); setError('')
  }
  return <form onSubmit={submit} className="space-y-3">
    <p className="text-muted-foreground">{existing ? 'Arraste as pontas no mapa ou escolha outro cartão abaixo.' : 'Clique nos cartões ou no mapa. Você também pode escolher os cartões pela busca abaixo.'}</p>
    <div className="grid gap-2">
      <div><label htmlFor={id + '-start'}>Início</label><CardPickerField id={id + '-start'} items={items} title="Escolher cartão de início" placeholder={start ? 'Ponto no mapa' : 'Escolher cartão'} value={start?.cardId ?? ''} onChange={(next) => choose('start', next)} /></div>
      <div><label htmlFor={id + '-end'}>Fim</label><CardPickerField id={id + '-end'} items={items} title="Escolher cartão de fim" placeholder={end ? 'Ponto no mapa' : 'Escolher cartão'} value={end?.cardId ?? ''} onChange={(next) => choose('end', next)} /></div>
    </div>
    <div className="flex flex-wrap items-center gap-4">
      <label className="flex items-center gap-2">Cor <input type="color" className="h-8 w-11" value={color} onChange={(event) => setColor(event.target.value)} /></label>
      <label className="flex items-center gap-2">Traço <select className="min-h-8 rounded-md border bg-background px-2" value={stroke} onChange={(event) => setStroke(event.target.value as FreeArrow['stroke'])}><option value="solid">Contínuo</option><option value="dashed">Tracejado</option><option value="dotted">Pontilhado</option></select></label>
    </div>
    <Button type="submit" disabled={!start || !end}>{existing ? 'Salvar estilo' : 'Adicionar seta livre'}</Button>
    {error && <p role="alert">{error}</p>}
  </form>
}
