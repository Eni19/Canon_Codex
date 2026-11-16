'use client'

import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { createGraphRelationAction, editGraphRelationAction, removeGraphRelationAction } from '@/app/actions/graph-relations'
import { CardPickerField } from '@/components/ui/card-picker'
import { Button } from '@/components/ui/button'
import type { GraphStyle } from '@/domain/relations/graphStyles'
import type { GraphEntity } from '@/domain/relations/relationshipGraph'
import { directionFields, directionMark, relationDirection, type Relation, type RelationDirection } from '@/domain/relations/relation'
import { DirectionField, GraphStylePreview, NewGraphStyle } from './graph-style-legend'

const field = 'min-h-9 w-full rounded-md border bg-background px-2 py-1'

export function CreateGraphRelation({ worldId, entities, styles, typeLabels, source, target, setSource, setTarget, onCreated, onStyleCreated }: {
  worldId: string; entities: GraphEntity[]; styles: GraphStyle[]; typeLabels: Record<string, string>; source: string; target: string
  setSource: (id: string) => void; setTarget: (id: string) => void; onCreated: (relation: Relation) => void; onStyleCreated: (style: GraphStyle) => void
}) {
  const id = useId()
  const request = useRef<{ id: string; key: string } | null>(null)
  const items = useMemo(() => entities.map((item) => ({ id: item.id, title: item.title, subtitle: typeLabels[item.type] ?? item.type })), [entities, typeLabels])
  const [type, setType] = useState('')
  const [label, setLabel] = useState('')
  const [directionOverride, setDirection] = useState<RelationDirection>()
  const [creatingType, setCreatingType] = useState(false)
  const style = styles.find((item) => item.type === type.trim())
  const direction = directionOverride ?? style?.direction ?? 'forward'
  const [pending, setPending] = useState(false); const [message, setMessage] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending || !source || !target || !type.trim()) return
    const fields = directionFields(direction)
    const draft = { sourceId: source, targetId: target, type: type.trim(), label: label.trim() || undefined, ...fields, bidirectional: fields.bidirectional || undefined }
    const key = JSON.stringify(draft)
    if (request.current?.key !== key) request.current = { id: crypto.randomUUID(), key }
    setPending(true); setMessage('')
    try {
      const result = await createGraphRelationAction({ worldId, requestId: request.current.id, relation: draft })
      if ('error' in result) setMessage(result.error)
      else { request.current = null; onCreated(result.relation) }
    } catch { setMessage('Falha de conexão. Tente novamente sem alterar os campos.') }
    finally { setPending(false) }
  }
  if (creatingType) return <div className="space-y-3">
    <Button type="button" variant="outline" onClick={() => setCreatingType(false)}>Voltar ao vínculo</Button>
    <NewGraphStyle styles={styles} save={(next) => {
      onStyleCreated(next)
      setType(next.type)
      setDirection(undefined)
      setCreatingType(false)
    }} />
  </div>
  return <form onSubmit={(event) => void submit(event)} className="space-y-3">
    <div className="grid gap-2">
      <div><label htmlFor={id + '-from'}>Origem</label><CardPickerField id={id + '-from'} disabled={pending} items={items} title="Escolher origem" value={source} onChange={setSource} /></div>
      <div><label htmlFor={id + '-to'}>Destino</label><CardPickerField id={id + '-to'} disabled={pending} items={items} title="Escolher destino" value={target} onChange={setTarget} /></div>
      <label>Tipo <input required disabled={pending} className={field} list={id} value={type} onChange={(event) => { setType(event.target.value); setDirection(undefined) }} /></label>
      <datalist id={id}>{styles.map((item) => <option key={item.type} value={item.type} />)}</datalist>
      <Button type="button" variant="outline" size="sm" className="w-fit" disabled={pending} onClick={() => setCreatingType(true)}>Novo tipo de seta</Button>
      <label>Rótulo opcional <input disabled={pending} className={field} value={label} onChange={(event) => setLabel(event.target.value)} /></label>
      <DirectionField direction={direction} onChange={setDirection} disabled={pending} />
    </div>
    {style && <GraphStylePreview style={style} direction={direction} />}
    <p className="text-sm">{entities.find((item) => item.id === source)?.title || 'Origem'} {directionMark(direction)} {entities.find((item) => item.id === target)?.title || 'Destino'}</p>
    <Button type="submit" disabled={pending || !source || !target || !type.trim()}>{pending ? 'Salvando…' : 'Criar relação'}</Button>
    {message && <p role="alert">{message}</p>}
  </form>
}

export function EditGraphRelation({ worldId, relation, types, onUpdated, onRemoved }: { worldId: string; relation: Relation; types: string[]; onUpdated: (relation: Relation) => void; onRemoved: (id: string) => void }) {
  const id = useId(); const [type, setType] = useState(relation.type); const [label, setLabel] = useState(relation.label ?? '')
  const [direction, setDirection] = useState(() => relationDirection(relation)); const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false); const [message, setMessage] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (pending || !type.trim()) return
    setPending(true); setMessage('')
    try {
      const result = await editGraphRelationAction({ worldId, expected: relation, changes: { type: type.trim(), label: label.trim() || undefined, ...directionFields(direction) } })
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
    <div className="grid gap-2">
      <label>Tipo <input required disabled={pending} className={field} list={id} value={type} onChange={(event) => setType(event.target.value)} /></label>
      <datalist id={id}>{types.map((item) => <option key={item} value={item} />)}</datalist>
      <label>Rótulo opcional <input disabled={pending} className={field} value={label} onChange={(event) => setLabel(event.target.value)} /></label>
      <DirectionField direction={direction} onChange={setDirection} disabled={pending} />
    </div>
    <button type="submit" disabled={pending} className="rounded border px-2 py-1">Salvar relação</button>{' '}
    {!confirming ? <button type="button" disabled={pending} className="rounded border px-2 py-1" onClick={() => setConfirming(true)}>Remover relação</button> : <span>Remover este vínculo? <button type="button" disabled={pending} className="rounded border px-2 py-1" onClick={() => void remove()}>Confirmar remoção</button>{' '}<button type="button" disabled={pending} className="rounded border px-2 py-1" onClick={() => setConfirming(false)}>Cancelar</button></span>}
    <p role="status">{message}</p>
  </form>
}
