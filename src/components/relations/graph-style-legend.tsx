'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { buildGraphCatalog, strokeDash, type GraphStyle } from '@/domain/relations/graphStyles'
import { RelationDirectionSchema, relationDirection, type Relation, type RelationDirection } from '@/domain/relations/relation'

const field = 'min-h-9 w-full rounded-md border bg-background px-2 py-1'
const directionLabel: Record<RelationDirection, string> = { forward: 'Uma direção', both: 'Duas direções', none: 'Sem direção' }

export function DirectionField({ direction, onChange, disabled }: { direction: RelationDirection; onChange: (value: RelationDirection) => void; disabled?: boolean }) {
  return <label className="grid gap-1">Sentido
    <select className={field} value={direction} disabled={disabled} onChange={(event) => onChange(RelationDirectionSchema.parse(event.target.value))}>
      {RelationDirectionSchema.options.map((value) => <option key={value} value={value}>{directionLabel[value]}</option>)}
    </select>
  </label>
}

export function GraphStylePreview({ style, direction }: { style: GraphStyle; direction: RelationDirection }) {
  const { color, symbol, tip } = style
  function terminal(x: number, side: -1 | 1, directed: boolean) {
    const extra = directed && tip !== 'triangle'
    const at = extra ? x - side * 13 : x
    return <g fill={color}>
      {(extra || directed && tip === 'triangle') && <polygon points={`${x},10 ${x - side * 9},4 ${x - side * 9},16`} />}
      {tip === 'circle' && <circle cx={at} cy="10" r="4" />}
      {tip === 'diamond' && <polygon points={`${at},5 ${at + 5},10 ${at},15 ${at - 5},10`} />}
      {!directed && tip === 'triangle' && <polygon points={`${at},4 ${at - 5},15 ${at + 5},15`} />}
    </g>
  }
  return <svg width="112" height="22" viewBox="0 0 112 22" aria-hidden="true">
    <line x1="8" y1="10" x2="104" y2="10" stroke={color} strokeWidth="2" strokeDasharray={strokeDash(style.stroke).join(' ')} />
    {direction !== 'forward' && terminal(8, -1, direction === 'both')}
    {terminal(104, 1, direction !== 'none')}
    {symbol === 'circle' && <circle cx="56" cy="10" r="4" fill={color} />}
    {symbol === 'square' && <rect x="52" y="6" width="8" height="8" fill={color} />}
    {symbol === 'diamond' && <polygon points="56,5 61,10 56,15 51,10" fill={color} />}
  </svg>
}

function StyleFields({ style, setStyle }: { style: GraphStyle; setStyle: (value: GraphStyle) => void }) {
  return <>
    <div className="grid grid-cols-2 gap-2">
      <label className="grid gap-1">Cor <input type="color" className="h-9 w-12" value={style.color} onChange={(event) => setStyle({ ...style, color: event.target.value })} /></label>
      <label className="grid gap-1">Traço <select className={field} value={style.stroke} onChange={(event) => setStyle({ ...style, stroke: event.target.value as GraphStyle['stroke'] })}><option value="solid">Contínuo</option><option value="dashed">Tracejado</option><option value="dotted">Pontilhado</option></select></label>
      <label className="grid gap-1">Ponta <select className={field} value={style.tip} onChange={(event) => setStyle({ ...style, tip: event.target.value as GraphStyle['tip'] })}><option value="triangle">Triângulo</option><option value="diamond">Losango</option><option value="circle">Círculo</option></select></label>
      <label className="grid gap-1">Símbolo no meio <select className={field} value={style.symbol} onChange={(event) => setStyle({ ...style, symbol: event.target.value as GraphStyle['symbol'] })}><option value="none">Nenhum</option><option value="circle">Círculo</option><option value="square">Quadrado</option><option value="diamond">Losango</option></select></label>
    </div>
    <DirectionField direction={style.direction ?? 'forward'} onChange={(direction) => setStyle({ ...style, direction })} />
    <label className="grid gap-1">Significado (opcional) <input className={field} maxLength={300} value={style.meaning} onChange={(event) => setStyle({ ...style, meaning: event.target.value })} /></label>
    <div className="flex items-center gap-3 text-sm text-muted-foreground">Prévia <GraphStylePreview style={style} direction={style.direction ?? 'forward'} /></div>
  </>
}

export function NewGraphStyle({ styles, save }: { styles: GraphStyle[]; save: (style: GraphStyle) => void }) {
  const [draft, setDraft] = useState<GraphStyle>(() => {
    const available = buildGraphCatalog([''], styles)
    return { ...available[available.length - 1], type: '', direction: 'forward' }
  })
  const [error, setError] = useState('')
  const submit = () => {
    const type = draft.type.trim()
    if (!type) return
    if (styles.some((item) => item.type.toLocaleLowerCase() === type.toLocaleLowerCase())) {
      setError('Já existe um tipo com esse nome.')
      return
    }
    save({ ...draft, type })
    setDraft((current) => ({ ...current, type: '' }))
    setError('')
  }
  return <div className="space-y-3 rounded-md border bg-surface p-3">
    <label className="grid gap-1 font-medium">Nome do tipo <input className={field} maxLength={200} value={draft.type} onChange={(event) => { setDraft({ ...draft, type: event.target.value }); setError('') }}
      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit() } }} /></label>
    <StyleFields style={draft} setStyle={setDraft} />
    <Button type="button" size="sm" disabled={!draft.type.trim()} onClick={submit}>Salvar tipo de seta</Button>
    {error && <p role="alert">{error}</p>}
  </div>
}

function Editor({ style, apply }: { style: GraphStyle; apply: (style: GraphStyle) => void }) {
  const [draft, setDraft] = useState(style)
  return <details className="mt-2 rounded border p-2">
    <summary className="cursor-pointer">Editar estilo de {style.type}</summary>
    <div className="mt-2 space-y-2">
      <StyleFields style={draft} setStyle={setDraft} />
      <Button type="button" size="sm" variant="outline" onClick={() => apply({ ...draft, hidden: style.hidden })}>Aplicar estilo</Button>
    </div>
  </details>
}

export function GraphStyleLegend({ styles, relations, update }: { styles: GraphStyle[]; relations: Relation[]; update: (style: GraphStyle) => void }) {
  const [creating, setCreating] = useState(false)
  return <section className="space-y-3">
    <Button type="button" variant="outline" aria-expanded={creating} onClick={() => setCreating(!creating)}>{creating ? 'Voltar aos tipos' : 'Novo tipo de seta'}</Button>
    {creating && <NewGraphStyle styles={styles} save={(style) => { update(style); setCreating(false) }} />}
    <ul className="space-y-3">{styles.map((style) => {
      const directions = new Set(relations.filter((edge) => edge.type === style.type).map(relationDirection))
      if (!directions.size) directions.add(style.direction ?? 'forward')
      return <li key={style.type} className="rounded border p-2">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="break-all">{style.type}</strong>
          <label className="ml-auto"><input type="checkbox" checked={!style.hidden} onChange={(event) => update({ ...style, hidden: !event.target.checked })} /> Mostrar {style.type}</label>
        </div>
        {style.meaning && <p className="text-muted-foreground">{style.meaning}</p>}
        {[...directions].map((direction) => <div key={direction} className="flex flex-wrap items-center gap-2 text-xs"><GraphStylePreview style={style} direction={direction} />{directionLabel[direction]}</div>)}
        <Editor key={JSON.stringify(style)} style={style} apply={update} />
      </li>
    })}</ul>
  </section>
}
