'use client'

import { useState, type FormEvent } from 'react'
import { FreeArrowSchema, type FreeArrow } from '@/domain/relations/graphSettings'

type Point = { x: number; y: number }
const field = 'w-24 rounded border bg-background px-2 py-1'

export function FreeArrowForm({ start, end, setStart, setEnd, add }: { start: Point | null; end: Point | null; setStart: (point: Point) => void; setEnd: (point: Point) => void; add: (arrow: FreeArrow) => void }) {
  const [color, setColor] = useState('#a64b39')
  const [stroke, setStroke] = useState<FreeArrow['stroke']>('solid')
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = FreeArrowSchema.safeParse({ id: crypto.randomUUID(), start, end, color, stroke })
    if (!result.success) { setError('Informe início e fim com coordenadas válidas.'); return }
    add(result.data); setError('')
  }
  const position = (value: Point | null, set: (point: Point) => void, coordinate: 'x' | 'y', next: string) => {
    set({ ...(value ?? { x: 0, y: 0 }), [coordinate]: next === '' ? Number.NaN : Number(next) })
  }
  return <form onSubmit={submit} className="space-y-2 rounded border p-3 text-sm">
    <h2 className="font-medium">Seta livre</h2>
    <p>Marque início e fim clicando no fundo do canvas ou informe as coordenadas. Esta anotação não cria vínculo nas fichas.</p>
    <div className="flex flex-wrap gap-3">
      <label>Início X <input className={field} type="number" step="any" value={Number.isFinite(start?.x) ? start?.x : ''} onChange={(event) => position(start, setStart, 'x', event.target.value)} /></label>
      <label>Início Y <input className={field} type="number" step="any" value={Number.isFinite(start?.y) ? start?.y : ''} onChange={(event) => position(start, setStart, 'y', event.target.value)} /></label>
      <label>Fim X <input className={field} type="number" step="any" value={Number.isFinite(end?.x) ? end?.x : ''} onChange={(event) => position(end, setEnd, 'x', event.target.value)} /></label>
      <label>Fim Y <input className={field} type="number" step="any" value={Number.isFinite(end?.y) ? end?.y : ''} onChange={(event) => position(end, setEnd, 'y', event.target.value)} /></label>
      <label>Cor <input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
      <label>Traço <select className="rounded border bg-background" value={stroke} onChange={(event) => setStroke(event.target.value as FreeArrow['stroke'])}><option value="solid">Contínuo</option><option value="dashed">Tracejado</option><option value="dotted">Pontilhado</option></select></label>
    </div>
    <button type="submit" className="rounded border px-2 py-1">Adicionar seta livre</button>
    {error && <p role="alert">{error}</p>}
  </form>
}
