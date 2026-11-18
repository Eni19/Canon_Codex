'use client'

import { useId, useState, type FormEvent } from 'react'
import { ArrowLeftRight, ArrowRight, Check, ChevronDown, Minus, Plus, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildGraphCatalog, strokeDash, type GraphStyle } from '@/domain/relations/graphStyles'
import { RelationDirectionSchema, relationDirection, type Relation, type RelationDirection } from '@/domain/relations/relation'
import form from './graph-forms.module.css'

const directionLabel: Record<RelationDirection, string> = { forward: 'Uma direção', both: 'Duas direções', none: 'Sem direção' }
const directionIcon = { forward: ArrowRight, both: ArrowLeftRight, none: Minus }

export function DirectionField({ direction, onChange, disabled }: { direction: RelationDirection; onChange: (value: RelationDirection) => void; disabled?: boolean }) {
  const name = useId()
  return <fieldset disabled={disabled} className={form.field}>
    <legend className="mb-1.5">Sentido</legend>
    <div className={form.segments}>
      {RelationDirectionSchema.options.map((value) => {
        const Icon = directionIcon[value]
        return <label key={value}>
          <input type="radio" name={name} checked={direction === value} onChange={() => onChange(value)} className="sr-only" />
          <span><Icon className="size-4" aria-hidden="true" />{directionLabel[value]}</span>
        </label>
      })}
    </div>
  </fieldset>
}

export function GraphStylePreview({ style, direction }: { style: Pick<GraphStyle, 'color' | 'stroke' | 'symbol' | 'tip'>; direction: RelationDirection }) {
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
  return <svg width="112" height="20" viewBox="0 0 112 20" aria-hidden="true">
    <line x1="8" y1="10" x2="104" y2="10" stroke={color} strokeWidth="2" strokeDasharray={strokeDash(style.stroke).join(' ')} />
    {direction !== 'forward' && terminal(8, -1, direction === 'both')}
    {terminal(104, 1, direction !== 'none')}
    {symbol === 'circle' && <circle cx="56" cy="10" r="4" fill={color} />}
    {symbol === 'square' && <rect x="52" y="6" width="8" height="8" fill={color} />}
    {symbol === 'diamond' && <polygon points="56,5 61,10 56,15 51,10" fill={color} />}
  </svg>
}

export function GraphColorField({ color, onChange }: { color: string; onChange: (value: string) => void }) {
  return <label className={form.field}>Cor
    <span className={form.color}>
      <input type="color" value={color} onChange={(event) => onChange(event.target.value)} />
      <span aria-hidden="true" className="font-mono text-xs text-muted-foreground uppercase">{color}</span>
    </span>
  </label>
}

export function GraphStrokeField({ stroke, onChange }: { stroke: GraphStyle['stroke']; onChange: (value: GraphStyle['stroke']) => void }) {
  return <label className={form.field}>Traço
    <select className={form.control} value={stroke} onChange={(event) => onChange(event.target.value as GraphStyle['stroke'])}>
      <option value="solid">Contínuo</option>
      <option value="dashed">Tracejado</option>
      <option value="dotted">Pontilhado</option>
    </select>
  </label>
}

function StyleFields({ style, setStyle }: { style: GraphStyle; setStyle: (value: GraphStyle) => void }) {
  return <>
    <div className="grid grid-cols-2 gap-3">
      <GraphColorField color={style.color} onChange={(color) => setStyle({ ...style, color })} />
      <GraphStrokeField stroke={style.stroke} onChange={(stroke) => setStyle({ ...style, stroke })} />
      <label className={form.field}>Ponta <select className={form.control} value={style.tip} onChange={(event) => setStyle({ ...style, tip: event.target.value as GraphStyle['tip'] })}><option value="triangle">Triângulo</option><option value="diamond">Losango</option><option value="circle">Círculo</option></select></label>
      <label className={form.field}>Símbolo no meio <select className={form.control} value={style.symbol} onChange={(event) => setStyle({ ...style, symbol: event.target.value as GraphStyle['symbol'] })}><option value="none">Nenhum</option><option value="circle">Círculo</option><option value="square">Quadrado</option><option value="diamond">Losango</option></select></label>
    </div>
    <DirectionField direction={style.direction ?? 'forward'} onChange={(direction) => setStyle({ ...style, direction })} />
    <label className={form.field}>Significado (opcional) <input className={form.control} maxLength={300} value={style.meaning} onChange={(event) => setStyle({ ...style, meaning: event.target.value })} /></label>
    <div className={form.preview}>Prévia da seta <GraphStylePreview style={style} direction={style.direction ?? 'forward'} /></div>
  </>
}

export function NewGraphStyle({ styles, save }: { styles: GraphStyle[]; save: (style: GraphStyle) => void }) {
  const [draft, setDraft] = useState<GraphStyle>(() => {
    const available = buildGraphCatalog([''], styles)
    return { ...available[available.length - 1], type: '', direction: 'forward' }
  })
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
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
  return <form className={form.form + ' ' + form.reveal} onSubmit={submit}>
    <label className={form.field}>Nome do tipo <input autoFocus required className={form.control} maxLength={200} value={draft.type} onChange={(event) => { setDraft({ ...draft, type: event.target.value }); setError('') }} /></label>
    <StyleFields style={draft} setStyle={setDraft} />
    {error && <p role="alert" className={`${form.feedback} ${form.error} ${form.reveal}`}>{error}</p>}
    <div className={form.actions}><Button type="submit" disabled={!draft.type.trim()}><Check aria-hidden="true" />Salvar tipo de seta</Button></div>
  </form>
}

function Editor({ style, apply }: { style: GraphStyle; apply: (style: GraphStyle) => void }) {
  const [draft, setDraft] = useState(style)
  return <details className={form.styleEditor + ' group mt-2'}>
    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md py-2 text-xs font-medium hover:text-primary [&::-webkit-details-marker]:hidden">
      <SlidersHorizontal className="size-3.5" aria-hidden="true" />
      <span className="flex-1 wrap-anywhere">Editar estilo de {style.type}</span>
      <ChevronDown className="size-3.5 motion-safe:transition-transform group-open:rotate-180" aria-hidden="true" />
    </summary>
    <div className={form.form + ' ' + form.reveal + ' mt-2 border-t pt-3'}>
      <StyleFields style={draft} setStyle={setDraft} />
      <div className={form.actions}><Button type="button" size="sm" onClick={() => apply({ ...draft, hidden: style.hidden })}><Check aria-hidden="true" />Aplicar estilo</Button></div>
    </div>
  </details>
}

export function GraphStyleLegend({ styles, relations, update }: { styles: GraphStyle[]; relations: Relation[]; update: (style: GraphStyle) => void }) {
  const [creating, setCreating] = useState(false)
  return <section className="space-y-3">
    <Button type="button" variant={creating ? 'ghost' : 'outline'} aria-expanded={creating} onClick={() => setCreating(!creating)}>{!creating && <Plus aria-hidden="true" />}{creating ? 'Voltar aos tipos' : 'Novo tipo de seta'}</Button>
    {creating ? <NewGraphStyle styles={styles} save={(style) => { update(style); setCreating(false) }} /> : <ul className="divide-y">{styles.map((style) => {
      const directions = new Set(relations.filter((edge) => edge.type === style.type).map(relationDirection))
      if (!directions.size) directions.add(style.direction ?? 'forward')
      return <li key={style.type} className="py-3">
        <div className="flex items-start justify-between gap-3">
          <strong className="min-w-0 wrap-anywhere font-medium">{style.type}</strong>
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" aria-label={`Mostrar ${style.type}`} className="size-4 accent-primary" checked={!style.hidden} onChange={(event) => update({ ...style, hidden: !event.target.checked })} /> Mostrar
          </label>
        </div>
        {style.meaning && <p className="text-muted-foreground">{style.meaning}</p>}
        {[...directions].map((direction) => <div key={direction} className="flex flex-wrap items-center gap-2 text-xs"><GraphStylePreview style={style} direction={direction} />{directionLabel[direction]}</div>)}
        <Editor key={JSON.stringify(style)} style={style} apply={update} />
      </li>
    })}</ul>}
  </section>
}
