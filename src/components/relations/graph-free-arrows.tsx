'use client'

import { useId, useState, type FormEvent } from 'react'
import { ArrowRight, Check, MoveUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardPickerField, type CardPickerItem } from '@/components/ui/card-picker'
import type { ArrowEndpoint } from '@/domain/relations/graphGeometry'
import { FreeArrowSchema, type FreeArrow } from '@/domain/relations/graphSettings'
import { GraphColorField, GraphStrokeField, GraphStylePreview } from './graph-style-legend'
import form from './graph-forms.module.css'

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
  return <form onSubmit={submit} className={form.form}>
    <p className="text-xs leading-relaxed text-muted-foreground">{existing ? 'Arraste as pontas no mapa ou escolha outro cartão.' : 'Marque as pontas no mapa ou escolha os cartões abaixo.'}</p>
    <div className={form.endpoints}>
      <div className={form.field}><label htmlFor={id + '-start'}>Início</label><CardPickerField id={id + '-start'} items={items} title="Escolher cartão de início" placeholder={start ? 'Ponto no mapa' : 'Escolher'} triggerClassName={form.control} value={start?.cardId ?? ''} onChange={(next) => choose('start', next)} /></div>
      <span className={form.endpointMark}><ArrowRight className="size-4" aria-hidden="true" /></span>
      <div className={form.field}><label htmlFor={id + '-end'}>Fim</label><CardPickerField id={id + '-end'} items={items} title="Escolher cartão de fim" placeholder={end ? 'Ponto no mapa' : 'Escolher'} triggerClassName={form.control} value={end?.cardId ?? ''} onChange={(next) => choose('end', next)} /></div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <GraphColorField color={color} onChange={setColor} />
      <GraphStrokeField stroke={stroke} onChange={setStroke} />
    </div>
    <div className={form.preview}>Prévia da seta <GraphStylePreview style={{ color, stroke, tip: 'triangle', symbol: 'none' }} direction="forward" /></div>
    {error && <p role="alert" className={`${form.feedback} ${form.error} ${form.reveal}`}>{error}</p>}
    <div className={form.actions}>
      <Button type="submit" disabled={!start || !end}>{existing ? <Check aria-hidden="true" /> : <MoveUpRight aria-hidden="true" />}{existing ? 'Salvar estilo' : 'Adicionar seta livre'}</Button>
    </div>
  </form>
}
