'use client'

import { useState } from 'react'
import { GraphStylesSchema, strokeDash, styleSignature, type GraphStyle } from '@/domain/relations/graphStyles'
import type { Relation } from '@/domain/relations/relation'

function Preview({ style, directional }: { style: GraphStyle; directional: boolean }) {
  const { color, symbol, tip } = style
  const end = (x: number, endTip: GraphStyle['tip']) => endTip === 'triangle'
    ? <polygon points={`${x - 9},4 ${x},10 ${x - 9},16`} fill={color} />
    : endTip === 'diamond' ? <polygon points={`${x - 10},10 ${x - 5},5 ${x},10 ${x - 5},15`} fill={color} /> : <circle cx={x - 4} cy="10" r="4" fill={color} />
  const symmetric = (x: number) => tip === 'triangle' ? <polygon points={`${x},4 ${x - 5},15 ${x + 5},15`} fill={color} />
    : tip === 'diamond' ? <polygon points={`${x},5 ${x + 5},10 ${x},15 ${x - 5},10`} fill={color} /> : <circle cx={x} cy="10" r="4" fill={color} />
  return <svg width="100" height="22" viewBox="0 0 100 22" aria-hidden="true">
    <line x1="8" y1="10" x2="92" y2="10" stroke={color} strokeWidth="2" strokeDasharray={strokeDash(style.stroke).join(' ')} />
    {directional ? <>{tip !== 'triangle' && end(79, tip)}{end(92, 'triangle')}</> : <>{symmetric(8)}{symmetric(92)}</>}
    {symbol === 'circle' && <circle cx="50" cy="10" r="4" fill={color} />}
    {symbol === 'square' && <rect x="46" y="6" width="8" height="8" fill={color} />}
    {symbol === 'diamond' && <polygon points="50,5 55,10 50,15 45,10" fill={color} />}
  </svg>
}

function Editor({ style, styles, apply }: { style: GraphStyle; styles: GraphStyle[]; apply: (style: GraphStyle) => void }) {
  const [draft, setDraft] = useState(style)
  const [error, setError] = useState('')
  const update = (patch: Partial<GraphStyle>) => { setDraft({ ...draft, ...patch }); setError('') }
  return <details className="mt-2 rounded border p-2">
    <summary className="cursor-pointer">Editar estilo de {style.type}</summary>
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <label>Cor <input type="color" value={draft.color} onChange={(event) => update({ color: event.target.value })} /></label>
      <label>Traço <select className="rounded border bg-background" value={draft.stroke} onChange={(event) => update({ stroke: event.target.value as GraphStyle['stroke'] })}><option value="solid">Contínuo</option><option value="dashed">Tracejado</option><option value="dotted">Pontilhado</option></select></label>
      <label>Ponta <select className="rounded border bg-background" value={draft.tip} onChange={(event) => update({ tip: event.target.value as GraphStyle['tip'] })}><option value="triangle">Triângulo</option><option value="diamond">Losango</option><option value="circle">Círculo</option></select></label>
      <label>Símbolo <select className="rounded border bg-background" value={draft.symbol} onChange={(event) => update({ symbol: event.target.value as GraphStyle['symbol'] })}><option value="none">Nenhum</option><option value="circle">Círculo</option><option value="square">Quadrado</option><option value="diamond">Losango</option></select></label>
      <label>Significado <input className="rounded border px-1" maxLength={300} value={draft.meaning} onChange={(event) => update({ meaning: event.target.value })} /></label>
      <span>Prévia <Preview style={draft} directional /></span>
      <button type="button" className="rounded border px-2 py-1" onClick={() => {
        if (styles.some((item) => item.type !== draft.type && styleSignature(item) === styleSignature(draft))) { setError('Esta combinação já existe. Altere o traço, a ponta ou o símbolo.'); return }
        apply({ ...draft, hidden: style.hidden }); setError('')
      }}>Aplicar estilo</button>
    </div>
    {error && <p role="alert">{error}</p>}
  </details>
}

export function GraphStyleLegend({ styles, relations, update }: { styles: GraphStyle[]; relations: Relation[]; update: (style: GraphStyle) => void }) {
  return <details open className="rounded border p-3 text-sm">
    <summary className="cursor-pointer font-medium">Legenda e estilos</summary>
    {!GraphStylesSchema.safeParse(styles).success && <p role="alert" className="mt-2">O catálogo excede as 36 combinações distintas disponíveis; a edição e a visibilidade da legenda não podem ser salvas enquanto houver combinações repetidas.</p>}
    <ul className="mt-3 space-y-3">{styles.map((style) => {
      const edges = relations.filter((edge) => edge.type === style.type)
      const directed = edges.some((edge) => edge.directional); const undirected = edges.some((edge) => !edge.directional)
      return <li key={style.type} className="rounded border p-2">
        <div className="flex flex-wrap items-center gap-3">
          {directed && <Preview style={style} directional />}{undirected && <Preview style={style} directional={false} />}{!directed && !undirected && <Preview style={style} directional />}
          <strong>{style.type}</strong><span>{style.meaning || 'Sem significado definido'}</span>
          <span>{directed && undirected ? 'Direcional e sem direção' : undirected ? 'Sem direção' : directed ? 'Direcional' : 'Sem vínculos ativos'}</span>
          <label className="ml-auto"><input type="checkbox" checked={!style.hidden} onChange={(event) => update({ ...style, hidden: !event.target.checked })} /> Mostrar {style.type}</label>
        </div>
        <Editor key={JSON.stringify(style)} style={style} styles={styles} apply={update} />
      </li>
    })}</ul>
    {!styles.length && <p className="mt-2 text-muted-foreground">Nenhum tipo de relação disponível.</p>}
  </details>
}
