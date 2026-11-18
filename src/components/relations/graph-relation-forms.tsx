'use client'

import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowLeftRight, ArrowRight, Check, Link2, Minus, Plus, Trash2 } from 'lucide-react'
import { createGraphRelationAction, editGraphRelationAction, removeGraphRelationAction } from '@/app/actions/graph-relations'
import { CardPickerField } from '@/components/ui/card-picker'
import { Button } from '@/components/ui/button'
import type { GraphStyle } from '@/domain/relations/graphStyles'
import type { GraphEntity } from '@/domain/relations/relationshipGraph'
import { directionFields, relationDirection, type Relation, type RelationDirection } from '@/domain/relations/relation'
import { DirectionField, GraphStylePreview, NewGraphStyle } from './graph-style-legend'
import form from './graph-forms.module.css'

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
  const Connector = direction === 'both' ? ArrowLeftRight : direction === 'none' ? Minus : ArrowRight
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
    <Button type="button" variant="ghost" size="sm" onClick={() => setCreatingType(false)}><ArrowLeft aria-hidden="true" />Voltar ao vínculo</Button>
    <NewGraphStyle styles={styles} save={(next) => {
      onStyleCreated(next)
      setType(next.type)
      setDirection(undefined)
      setCreatingType(false)
    }} />
  </div>
  return <form onSubmit={(event) => void submit(event)} className={form.form + ' ' + form.reveal} aria-busy={pending}>
    <div className={form.endpoints}>
      <div className={form.field}><label htmlFor={id + '-from'}>Origem</label><CardPickerField id={id + '-from'} disabled={pending} items={items} title="Escolher origem" placeholder="Escolher" triggerClassName={form.control} value={source} onChange={setSource} /></div>
      <span className={form.endpointMark}><Connector key={direction} className={form.reveal + ' size-4'} aria-hidden="true" /></span>
      <div className={form.field}><label htmlFor={id + '-to'}>Destino</label><CardPickerField id={id + '-to'} disabled={pending} items={items} title="Escolher destino" placeholder="Escolher" triggerClassName={form.control} value={target} onChange={setTarget} /></div>
    </div>
    <div className={form.field}>
      <div className="flex flex-wrap items-center justify-between gap-x-2">
        <label htmlFor={id + '-type'}>Tipo de vínculo</label>
        <Button type="button" variant="ghost" size="xs" disabled={pending} onClick={() => setCreatingType(true)}><Plus aria-hidden="true" />Novo tipo de seta</Button>
      </div>
      <input id={id + '-type'} required disabled={pending} className={form.control} list={id} placeholder="Digite ou escolha um tipo" value={type} onChange={(event) => { setType(event.target.value); setDirection(undefined) }} />
      <datalist id={id}>{styles.map((item) => <option key={item.type} value={item.type} />)}</datalist>
    </div>
    <label className={form.field}>Rótulo (opcional) <input disabled={pending} className={form.control} value={label} onChange={(event) => setLabel(event.target.value)} /></label>
    <DirectionField direction={direction} onChange={setDirection} disabled={pending} />
    {style && <div className={form.preview + ' ' + form.reveal}>Prévia da seta <GraphStylePreview style={style} direction={direction} /></div>}
    {message && <p role="alert" className={`${form.feedback} ${form.error} ${form.reveal}`}>{message}</p>}
    <div className={form.actions}>
      <Button type="submit" disabled={pending || !source || !target || !type.trim()}><Link2 aria-hidden="true" />{pending ? 'Salvando…' : 'Criar relação'}</Button>
    </div>
  </form>
}

export function EditGraphRelation({ worldId, relation, styles, onUpdated, onRemoved }: { worldId: string; relation: Relation; styles: GraphStyle[]; onUpdated: (relation: Relation) => void; onRemoved: (id: string) => void }) {
  const id = useId(); const [type, setType] = useState(relation.type); const [label, setLabel] = useState(relation.label ?? '')
  const [direction, setDirection] = useState(() => relationDirection(relation)); const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false); const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const style = styles.find((item) => item.type === type.trim())
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (pending || !type.trim()) return
    setPending(true); setMessage(''); setFailed(false)
    try {
      const result = await editGraphRelationAction({ worldId, expected: relation, changes: { type: type.trim(), label: label.trim() || undefined, ...directionFields(direction) } })
      if ('error' in result) { setMessage(result.error); setFailed(true) }
      else { onUpdated(result.relation); setMessage('Relação atualizada.') }
    } catch { setMessage('Falha de conexão. Tente novamente.'); setFailed(true) } finally { setPending(false) }
  }
  const remove = async () => {
    if (pending) return
    setPending(true); setMessage(''); setFailed(false)
    try {
      const result = await removeGraphRelationAction({ worldId, expected: relation })
      if ('error' in result) { setMessage(result.error); setFailed(true) }
      else onRemoved(relation.id)
    } catch { setMessage('Falha de conexão. Tente novamente.'); setFailed(true) } finally { setPending(false) }
  }
  return <form onSubmit={(event) => void submit(event)} className={form.form} aria-busy={pending}>
    <label className={form.field}>Tipo de vínculo <input required disabled={pending} className={form.control} list={id} value={type} onChange={(event) => setType(event.target.value)} /></label>
    <datalist id={id}>{styles.map((item) => <option key={item.type} value={item.type} />)}</datalist>
    <label className={form.field}>Rótulo (opcional) <input disabled={pending} className={form.control} value={label} onChange={(event) => setLabel(event.target.value)} /></label>
    <DirectionField direction={direction} onChange={setDirection} disabled={pending} />
    {style && <div className={form.preview + ' ' + form.reveal}>Prévia da seta <GraphStylePreview style={style} direction={direction} /></div>}
    {message && <p role={failed ? 'alert' : 'status'} className={`${form.feedback} ${form.reveal}${failed ? ' ' + form.error : ''}`}>{message}</p>}
    <div className={form.actions}>
      <Button type="button" variant="ghost" size="sm" className="mr-auto text-muted-foreground hover:text-danger" disabled={pending} aria-expanded={confirming} onClick={() => setConfirming(!confirming)}><Trash2 aria-hidden="true" />Remover relação</Button>
      <Button type="submit" disabled={pending || !type.trim()}><Check aria-hidden="true" />{pending ? 'Salvando…' : 'Salvar relação'}</Button>
    </div>
    {confirming && <div className={`${form.feedback} ${form.error} ${form.reveal} space-y-2`}>
      <p>Remover este vínculo?</p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>Cancelar</Button>
        <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={() => void remove()}>Confirmar remoção</Button>
      </div>
    </div>}
  </form>
}
