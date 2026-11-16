'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { createGraphRelationAction, editGraphRelationAction, removeGraphRelationAction } from '@/app/actions/graph-relations'
import type { GraphEntity } from '@/domain/relations/relationshipGraph'
import type { Relation } from '@/domain/relations/relation'

const field = 'rounded border bg-background px-2 py-1'

export function CreateGraphRelation({ worldId, entities, types, source, target, setSource, setTarget, onCreated }: {
  worldId: string; entities: GraphEntity[]; types: string[]; source: string; target: string
  setSource: (id: string) => void; setTarget: (id: string) => void; onCreated: (relation: Relation) => void
}) {
  const id = useId(); const requestId = useRef<string | null>(null)
  const [type, setType] = useState(''); const [label, setLabel] = useState(''); const [directional, setDirectional] = useState(true)
  const [pending, setPending] = useState(false); const [message, setMessage] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending || !source || !target || !type.trim()) return
    setPending(true); setMessage(''); requestId.current ??= crypto.randomUUID()
    try {
      const result = await createGraphRelationAction({ worldId, requestId: requestId.current, relation: { sourceId: source, targetId: target, type: type.trim(), label: label.trim() || undefined, directional } })
      if ('error' in result) setMessage(result.error)
      else { onCreated(result.relation); requestId.current = null; setMessage('Relação criada.'); setLabel('') }
    } catch { setMessage('Falha de conexão. Tente novamente sem alterar os campos.') }
    finally { setPending(false) }
  }
  return <form onSubmit={(event) => void submit(event)} className="space-y-3 rounded border p-3">
    <h2 className="font-medium">Conectar registros</h2>
    <p className="text-sm text-muted-foreground">Escolha origem e destino nos campos ou clique nos cartões, nessa ordem.</p>
    <div className="flex flex-wrap gap-3 text-sm">
      <label>Origem <select required disabled={pending} className={field} value={source} onChange={(event) => setSource(event.target.value)}><option value="">Selecione</option>{entities.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label>Destino <select required disabled={pending} className={field} value={target} onChange={(event) => setTarget(event.target.value)}><option value="">Selecione</option>{entities.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label>Tipo <input required disabled={pending} className={field} list={id} value={type} onChange={(event) => setType(event.target.value)} /></label>
      <datalist id={id}>{types.map((item) => <option key={item} value={item} />)}</datalist>
      <label>Rótulo opcional <input disabled={pending} className={field} value={label} onChange={(event) => setLabel(event.target.value)} /></label>
      <label><input type="checkbox" disabled={pending} checked={directional} onChange={(event) => setDirectional(event.target.checked)} /> Direcional</label>
    </div>
    <p className="text-sm">Prévia: {entities.find((item) => item.id === source)?.title || 'Origem'} {directional ? '→' : '—'} {label || type || 'tipo'} {directional ? '→' : '—'} {entities.find((item) => item.id === target)?.title || 'Destino'}</p>
    <button type="submit" disabled={pending} className="rounded border px-2 py-1 disabled:opacity-50">{pending ? 'Salvando…' : 'Criar relação'}</button>
    <p role="status" className="text-sm">{message}</p>
  </form>
}

export function EditGraphRelation({ worldId, relation, types, onUpdated, onRemoved }: { worldId: string; relation: Relation; types: string[]; onUpdated: (relation: Relation) => void; onRemoved: (id: string) => void }) {
  const id = useId(); const [type, setType] = useState(relation.type); const [label, setLabel] = useState(relation.label ?? '')
  const [directional, setDirectional] = useState(relation.directional); const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false); const [message, setMessage] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (pending || !type.trim()) return
    setPending(true); setMessage('')
    try {
      const result = await editGraphRelationAction({ worldId, expected: relation, changes: { type: type.trim(), label: label.trim() || undefined, directional } })
      if ('error' in result) setMessage(result.error); else { onUpdated(result.relation); setMessage('Relação atualizada.') }
    } catch { setMessage('Falha de conexão. Tente novamente.') } finally { setPending(false) }
  }
  const remove = async () => {
    if (pending) return
    setPending(true); setMessage('')
    try {
      const result = await removeGraphRelationAction({ worldId, expected: relation })
      if ('error' in result) setMessage(result.error); else onRemoved(relation.id)
    } catch { setMessage('Falha de conexão. Tente novamente.') } finally { setPending(false) }
  }
  return <form onSubmit={(event) => void submit(event)} className="mt-3 space-y-2">
    <div className="flex flex-wrap gap-3">
      <label>Tipo <input required disabled={pending} className={field} list={id} value={type} onChange={(event) => setType(event.target.value)} /></label>
      <datalist id={id}>{types.map((item) => <option key={item} value={item} />)}</datalist>
      <label>Rótulo opcional <input disabled={pending} className={field} value={label} onChange={(event) => setLabel(event.target.value)} /></label>
      <label><input type="checkbox" disabled={pending} checked={directional} onChange={(event) => setDirectional(event.target.checked)} /> Direcional</label>
    </div>
    <button type="submit" disabled={pending} className="rounded border px-2 py-1">Salvar relação</button>{' '}
    {!confirming ? <button type="button" disabled={pending} className="rounded border px-2 py-1" onClick={() => setConfirming(true)}>Remover relação</button> : <span>Remover este vínculo? <button type="button" disabled={pending} className="rounded border px-2 py-1" onClick={() => void remove()}>Confirmar remoção</button>{' '}<button type="button" disabled={pending} className="rounded border px-2 py-1" onClick={() => setConfirming(false)}>Cancelar</button></span>}
    <p role="status">{message}</p>
  </form>
}
