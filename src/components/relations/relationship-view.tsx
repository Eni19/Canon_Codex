'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { saveGraphSettingsAction } from '@/app/actions/relationship-graph'
import { fitGraph, relationshipLanes, relationshipPoints } from '@/domain/relations/graphGeometry'
import { buildGraphCatalog, GraphStylesSchema, strokeDash, type GraphStyle } from '@/domain/relations/graphStyles'
import { GraphStyleLegend } from './graph-style-legend'
import { CreateGraphRelation, EditGraphRelation } from './graph-relation-forms'
import { FreeArrowForm } from './graph-free-arrows'
import type { FreeArrow, GraphSettings } from '@/domain/relations/graphSettings'
import type { GraphEntity } from '@/domain/relations/relationshipGraph'
import type { Relation } from '@/domain/relations/relation'

export function RelationshipView({ entities, relations: initialRelations, initialFocus, initialSettings }: { entities: GraphEntity[]; relations: Relation[]; initialFocus?: string; initialSettings: GraphSettings }) {
  const [relations, setRelations] = useState(initialRelations)
  const [query, setQuery] = useState('')
  const [type, setType] = useState(() => entities.some((item) => item.type === initialSettings.preferences.type) ? initialSettings.preferences.type : '')
  const [relationType, setRelationType] = useState(() => relations.some((item) => item.type === initialSettings.preferences.relationType) ? initialSettings.preferences.relationType : '')
  const [focus, setFocus] = useState(() => entities.some((item) => item.id === initialFocus) ? initialFocus ?? '' : '')
  const [depth, setDepth] = useState(1)
  const [selectedId, setSelectedId] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [layoutVersion, setLayoutVersion] = useState(0)
  const [connecting, setConnecting] = useState(false)
  const [freeMode, setFreeMode] = useState(false)
  const [freeStart, setFreeStartState] = useState<{ x: number; y: number } | null>(null)
  const [freeEnd, setFreeEndState] = useState<{ x: number; y: number } | null>(null)
  const [annotations, setAnnotations] = useState(initialSettings.annotations)
  const free = useRef<{ active: boolean; start: { x: number; y: number } | null; end: { x: number; y: number } | null }>({ active: false, start: null, end: null })
  const [sourceId, setSourceId] = useState(''); const [targetId, setTargetId] = useState('')
  const connection = useRef({ active: false, source: '', target: '' })
  const [styles, setStyles] = useState(() => buildGraphCatalog(relations.map((item) => item.type), initialSettings.styles))
  const settings = useRef(initialSettings)
  const editVersion = useRef(0)
  const savingRef = useRef(false)
  const host = useRef<HTMLDivElement>(null)
  const camera = useRef<{ fit: () => void; zoom: (factor: number) => void } | null>(null)
  const types = [...new Set(entities.map((item) => item.type))].sort()
  const relationTypes = [...new Set(relations.map((item) => item.type))].sort()
  const visible = useMemo(() => {
    let neighbors: Set<string> | undefined
    if (focus) {
      neighbors = new Set([focus])
      for (let i = 0; i < depth; i++) {
        const previous = new Set(neighbors)
        for (const edge of relations) if (previous.has(edge.sourceId) || previous.has(edge.targetId)) { neighbors.add(edge.sourceId); neighbors.add(edge.targetId) }
      }
    }
    return entities.filter((item) => (!neighbors || neighbors.has(item.id)) && (!type || item.type === type) && item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  }, [entities, relations, query, type, focus, depth])
  const visibleRelations = useMemo(() => {
    const ids = new Set(visible.map((item) => item.id))
    const hidden = new Set(styles.filter((item) => item.hidden).map((item) => item.type))
    return relations.filter((item) => ids.has(item.sourceId) && ids.has(item.targetId) && !hidden.has(item.type) && (!relationType || item.type === relationType))
  }, [relations, visible, relationType, styles])
  const titles = useMemo(() => new Map(entities.map((item) => [item.id, item.title])), [entities])
  const selected = visibleRelations.find((edge) => edge.id === selectedId)
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const markDirty = () => { editVersion.current++; setDirty(true); setSaveMessage('') }
  const setSource = (value: string) => { connection.current.source = value; setSourceId(value) }
  const setTarget = (value: string) => { connection.current.target = value; setTargetId(value) }
  const setFreeStart = (point: { x: number; y: number } | null) => { free.current.start = point; setFreeStartState(point) }
  const setFreeEnd = (point: { x: number; y: number } | null) => { free.current.end = point; setFreeEndState(point) }
  const updateAnnotations = (next: FreeArrow[]) => { settings.current.annotations = next; setAnnotations(next); markDirty() }
  const applyRelation = (relation: Relation) => {
    setRelations((current) => [...current.filter((item) => item.id !== relation.id), relation])
    setStyles((current) => buildGraphCatalog([relation.type], current))
    setSelectedId(relation.id)
  }
  const updateStyle = (style: GraphStyle) => {
    const next = styles.map((item) => item.type === style.type ? style : item)
    if (!GraphStylesSchema.safeParse(next).success) { setSaveMessage('Há tipos com estilos iguais. Altere o traço, a ponta ou o símbolo antes de salvar a legenda.'); return }
    settings.current.styles = next; setStyles(next); markDirty()
  }
  const save = async () => {
    if (savingRef.current) return
    savingRef.current = true; setSaving(true); setSaveMessage('')
    const version = editVersion.current
    const snapshot: GraphSettings = structuredClone(settings.current)
    try {
      const result = await saveGraphSettingsAction(snapshot)
      if ('error' in result) setSaveMessage(result.error)
      else {
        settings.current = { ...settings.current, revision: result.settings.revision }
        if (version === editVersion.current) { setDirty(false); setSaveMessage('Organização salva.') }
        else setSaveMessage('Há alterações mais recentes para salvar.')
      }
    } catch { setSaveMessage('Não foi possível salvar. Tente novamente.') }
    finally { savingRef.current = false; setSaving(false) }
  }

  useEffect(() => {
    let disposed = false
    let destroy: (() => void) | undefined
    void import('konva').then(({ default: K }) => {
      if (disposed || !host.current) return
      const element = host.current
      const stage = new K.Stage({ container: element, width: element.clientWidth, height: 480, draggable: true })
      const layer = new K.Layer(); stage.add(layer)
      annotations.forEach((annotation) => {
        const arrow = new K.Arrow({ points: [annotation.start.x, annotation.start.y, annotation.end.x, annotation.end.y], stroke: annotation.color, fill: annotation.color, strokeWidth: 2, pointerLength: 11, pointerWidth: 9, dash: strokeDash(annotation.stroke) })
        const start = new K.Circle({ ...annotation.start, radius: 7, fill: annotation.color, stroke: '#fff', strokeWidth: 2, draggable: true })
        const end = new K.Circle({ ...annotation.end, radius: 7, fill: annotation.color, stroke: '#fff', strokeWidth: 2, draggable: true })
        const redrawArrow = () => arrow.points([start.x(), start.y(), end.x(), end.y()])
        const saveArrow = () => {
          const next = settings.current.annotations.map((item) => item.id === annotation.id ? { ...item, start: start.position(), end: end.position() } : item)
          settings.current.annotations = next; setAnnotations(next); editVersion.current++; setDirty(true); setSaveMessage('')
        }
        start.on('dragmove', redrawArrow); end.on('dragmove', redrawArrow)
        start.on('dragend', saveArrow); end.on('dragend', saveArrow)
        layer.add(arrow, start, end)
      })
      const groups = new Map<string, InstanceType<typeof K.Group>>()
      const entityIndex = new Map(entities.map((item, index) => [item.id, index]))
      visible.forEach((item) => {
        const index = entityIndex.get(item.id) ?? 0
        const position = settings.current.positions[item.id] ?? { x: 45 + (index % 4) * 300, y: 45 + Math.floor(index / 4) * 170 }
        const group = new K.Group({ ...position, draggable: true })
        group.add(new K.Rect({ width: 180, height: 70, cornerRadius: 9, fill: '#f4eee5', stroke: '#806e5f', strokeWidth: 2 }))
        group.add(new K.Text({ x: 10, y: 12, width: 160, text: item.title, fontSize: 15, fill: '#251f1b', ellipsis: true, wrap: 'none' }))
        group.add(new K.Text({ x: 10, y: 42, width: 160, text: item.type, fontSize: 12, fill: '#67584d' }))
        groups.set(item.id, group)
        group.on('dragend', () => {
          settings.current.positions = { ...settings.current.positions, [item.id]: group.position() }
          markDirty()
        })
        group.on('click tap', () => {
          if (!connection.current.active) return
          if (!connection.current.source || connection.current.target) { setSource(item.id); setTarget('') }
          else setTarget(item.id)
        })
      })
      const lanes = relationshipLanes(visibleRelations)
      const arrows = visibleRelations.map((edge) => {
        const style = styles.find((item) => item.type === edge.type)!
        const arrow = new K.Line({ stroke: style.color, strokeWidth: 2, hitStrokeWidth: 18, tension: 0.5, dash: strokeDash(style.stroke) })
        const start = style.tip === 'triangle'
          ? new K.RegularPolygon({ sides: 3, radius: 7, fill: style.color, listening: false, visible: !edge.directional })
          : style.tip === 'diamond' ? new K.RegularPolygon({ sides: 4, radius: 6, fill: style.color, listening: false, visible: !edge.directional })
            : new K.Circle({ radius: 4, fill: style.color, listening: false, visible: !edge.directional })
        const end = style.tip === 'triangle'
          ? new K.RegularPolygon({ sides: 3, radius: 7, fill: style.color, listening: false })
          : style.tip === 'diamond'
            ? new K.RegularPolygon({ sides: 4, radius: 6, fill: style.color, listening: false })
            : new K.Circle({ radius: 4, fill: style.color, listening: false })
        const directionArrow = new K.RegularPolygon({ sides: 3, radius: 7, fill: style.color, listening: false, visible: edge.directional && style.tip !== 'triangle' })
        const symbol = style.symbol === 'circle' ? new K.Circle({ radius: 4, fill: style.color, listening: false })
          : new K.RegularPolygon({ sides: 4, radius: 5, rotation: style.symbol === 'square' ? 45 : 0, fill: style.color, listening: false, visible: style.symbol !== 'none' })
        arrow.on('click tap', () => setSelectedId(edge.id))
        layer.add(arrow, start, end, directionArrow, symbol)
        return { edge, arrow, start, end, directionArrow, symbol, style }
      })
      groups.forEach((group) => layer.add(group))
      const redraw = () => arrows.forEach(({ edge, arrow, start, end, directionArrow, symbol, style }) => {
        const a = groups.get(edge.sourceId)?.position(); const b = groups.get(edge.targetId)?.position()
        if (!a || !b) return
        const points = relationshipPoints(a, b, lanes.get(edge.id) ?? 0, edge.sourceId === edge.targetId)
        arrow.points(points)
        const last = { x: points[points.length - 2], y: points[points.length - 1] }
        const angle = Math.atan2(last.y - points[points.length - 3], last.x - points[points.length - 4])
        start.position({ x: points[0], y: points[1] })
        const shift = edge.directional && style.tip !== 'triangle' ? 13 : 0
        end.position({ x: last.x - Math.cos(angle) * shift, y: last.y - Math.sin(angle) * shift })
        directionArrow.position(last); directionArrow.rotation(angle * 180 / Math.PI + 90)
        symbol.position({ x: points[2], y: points[3] })
        if (edge.directional && style.tip === 'triangle') end.rotation(angle * 180 / Math.PI + 90)
      })
      groups.forEach((group) => group.on('dragmove', redraw)); redraw()
      const fit = () => {
        const result = fitGraph([...groups.values()].map((group) => group.position()).concat(annotations.flatMap((item) => [item.start, item.end])), stage.width(), stage.height())
        stage.scale({ x: result.scale, y: result.scale }); stage.position({ x: result.x, y: result.y })
      }
      const zoom = (point: { x: number; y: number }, next: number) => {
        const old = stage.scaleX(); next = Math.min(3, Math.max(0.05, next))
        stage.position({ x: point.x - (point.x - stage.x()) / old * next, y: point.y - (point.y - stage.y()) / old * next }); stage.scale({ x: next, y: next })
      }
      camera.current = { fit, zoom: (factor) => zoom({ x: stage.width() / 2, y: stage.height() / 2 }, stage.scaleX() * factor) }
      if (focus && groups.has(focus)) {
        const point = groups.get(focus)!.position()
        stage.position({ x: stage.width() / 2 - point.x - 90, y: stage.height() / 2 - point.y - 35 })
      } else fit()
      stage.on('wheel', (event) => {
        event.evt.preventDefault(); const point = stage.getPointerPosition(); if (!point) return
        zoom(point, stage.scaleX() * (event.evt.deltaY < 0 ? 1.1 : 1 / 1.1))
      })
      stage.on('click tap', (event) => {
        if (!free.current.active || event.target !== stage) return
        const pointer = stage.getPointerPosition(); if (!pointer) return
        const point = stage.getAbsoluteTransform().copy().invert().point(pointer)
        if (!free.current.start || free.current.end) { setFreeStart(point); setFreeEnd(null) } else setFreeEnd(point)
      })
      let gesture: { distance: number; center: { x: number; y: number } } | undefined
      const touch = (event: TouchEvent) => {
        if (event.touches.length !== 2) { gesture = undefined; return }
        event.preventDefault(); stage.stopDrag(); groups.forEach((group) => group.stopDrag())
        const box = element.getBoundingClientRect(); const [a, b] = [event.touches[0], event.touches[1]]
        const center = { x: (a.clientX + b.clientX) / 2 - box.left, y: (a.clientY + b.clientY) / 2 - box.top }
        const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
        if (gesture && gesture.distance > 0) {
          stage.position({ x: stage.x() + center.x - gesture.center.x, y: stage.y() + center.y - gesture.center.y })
          zoom(center, stage.scaleX() * distance / gesture.distance)
        }
        gesture = { center, distance }
      }
      const endTouch = () => { gesture = undefined }
      element.addEventListener('touchmove', touch, { passive: false }); element.addEventListener('touchend', endTouch); element.addEventListener('touchcancel', endTouch)
      const observer = new ResizeObserver(() => stage.width(element.clientWidth)); observer.observe(element)
      destroy = () => { camera.current = null; observer.disconnect(); element.removeEventListener('touchmove', touch); element.removeEventListener('touchend', endTouch); element.removeEventListener('touchcancel', endTouch); stage.destroy() }
    })
    return () => { disposed = true; destroy?.() }
  }, [visible, visibleRelations, focus, entities, layoutVersion, styles, annotations])

  return <section className="mt-5 space-y-4">
    <p className="text-sm text-muted-foreground">Arraste os cartões para fixar posições; salve a organização e os estilos.</p>
    <div className="flex flex-wrap gap-3 text-sm">
      <label>Buscar <input className="ml-1 rounded border px-2 py-1" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label>Tipo de item <select className="ml-1 rounded border bg-background px-2 py-1" value={type} onChange={(event) => { const value = event.target.value; setType(value); settings.current.preferences = { ...settings.current.preferences, type: value }; markDirty() }}><option value="">Todos</option>{types.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Tipo de relação <select className="ml-1 rounded border bg-background px-2 py-1" value={relationType} onChange={(event) => { const value = event.target.value; setRelationType(value); settings.current.preferences = { ...settings.current.preferences, relationType: value }; markDirty() }}><option value="">Todos</option>{relationTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Vizinhança <select className="ml-1 rounded border bg-background px-2 py-1" value={focus} onChange={(event) => { setFocus(event.target.value); setDepth(1) }}><option value="">Mundo inteiro</option>{entities.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      {focus && <button className="rounded border px-2" onClick={() => setDepth((value) => value + 1)}>Expandir conexões</button>}
    </div>
    <p className="text-sm">{visible.length} itens e {visibleRelations.length} relações. Arraste cartões ou o fundo; use a roda ou pinça para ampliar.</p>
    <div className="flex flex-wrap gap-2 text-sm" aria-label="Controles do grafo">
      <button type="button" aria-pressed={connecting} className="rounded border px-2 py-1" onClick={() => { const next = !connection.current.active; connection.current.active = next; setConnecting(next); free.current.active = false; setFreeMode(false); setSource(''); setTarget('') }}>Conectar</button>
      <button type="button" aria-pressed={freeMode} className="rounded border px-2 py-1" onClick={() => { const next = !free.current.active; free.current.active = next; setFreeMode(next); connection.current.active = false; setConnecting(false); setFreeStart(null); setFreeEnd(null) }}>Seta livre</button>
      <button type="button" className="rounded border px-2 py-1" onClick={() => camera.current?.fit()}>Enquadrar recorte</button>
      <button type="button" className="rounded border px-2 py-1" onClick={() => camera.current?.zoom(1.2)}>Ampliar</button>
      <button type="button" className="rounded border px-2 py-1" onClick={() => camera.current?.zoom(1 / 1.2)}>Reduzir</button>
      <button type="button" className="rounded border px-2 py-1" onClick={() => { settings.current.positions = {}; markDirty(); setLayoutVersion((value) => value + 1) }}>Restaurar organização automática</button>
      <button type="button" className="rounded border px-2 py-1 disabled:opacity-50" disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Salvando…' : saveMessage && dirty ? 'Tentar salvar novamente' : 'Salvar organização e estilos'}</button>
    </div>
    <p role="status" className="text-sm">{saveMessage || (dirty ? 'Alterações ainda não salvas.' : '')}</p>
    {connecting && <CreateGraphRelation worldId={initialSettings.worldId} entities={entities} types={relationTypes} source={sourceId} target={targetId} setSource={setSource} setTarget={setTarget} onCreated={(relation) => { applyRelation(relation); setSource(''); setTarget('') }} />}
    {freeMode && <FreeArrowForm start={freeStart} end={freeEnd} setStart={setFreeStart} setEnd={setFreeEnd} add={(arrow) => { if (annotations.length >= 1000) { setSaveMessage('O limite é de 1000 setas livres.'); return }; updateAnnotations([...annotations, arrow]); setFreeStart(null); setFreeEnd(null) }} />}
    <div ref={host} className="overflow-hidden rounded border" style={{ background: '#e8dfd3', touchAction: 'none' }} aria-hidden="true" />
    <GraphStyleLegend styles={styles} relations={relations} update={updateStyle} />
    {annotations.length > 0 && <section className="rounded border p-3 text-sm"><h2 className="font-medium">Setas livres</h2><ul className="mt-2 space-y-2">{annotations.map((arrow, index) => <li key={arrow.id}>Seta {index + 1}: ({Math.round(arrow.start.x)}, {Math.round(arrow.start.y)}) → ({Math.round(arrow.end.x)}, {Math.round(arrow.end.y)}) <button type="button" className="rounded border px-2" onClick={() => updateAnnotations(annotations.filter((item) => item.id !== arrow.id))}>Apagar seta {index + 1}</button></li>)}</ul><p>Arraste as extremidades no canvas para reposicionar.</p></section>}
    <h2 className="font-serif text-lg">Itens e relações visíveis</h2>
    <ul className="space-y-1 text-sm">{visible.map((item) => <li key={item.id}><Link className="text-primary underline" href={`/entity/${item.id}`}>{item.title}</Link> <span className="text-muted-foreground">({item.type})</span></li>)}</ul>
    <ul className="space-y-1 text-sm">{visibleRelations.map((edge) => <li key={edge.id}><button type="button" className="text-left underline" aria-pressed={selectedId === edge.id} onClick={() => setSelectedId(edge.id)}>{titles.get(edge.sourceId)} {edge.directional ? '→' : '—'} {edge.label || edge.type} {edge.directional ? '→' : '—'} {titles.get(edge.targetId)}</button></li>)}</ul>
    {selected && <section aria-label="Detalhes da relação" className="rounded border p-3 text-sm">
      <h3 className="font-medium">Detalhes da relação</h3>
      <p>Tipo: {selected.type}{selected.label ? ` · Rótulo: ${selected.label}` : ''} · {selected.directional ? 'Direcional' : 'Sem direção'}</p>
      <p><Link className="text-primary underline" href={`/entity/${selected.sourceId}`}>{titles.get(selected.sourceId)}</Link> {selected.directional ? '→' : '—'} <Link className="text-primary underline" href={`/entity/${selected.targetId}`}>{titles.get(selected.targetId)}</Link></p>
      <EditGraphRelation key={selected.id} worldId={initialSettings.worldId} relation={selected} types={relationTypes} onUpdated={applyRelation} onRemoved={(id) => { setRelations((current) => current.filter((item) => item.id !== id)); setSelectedId('') }} />
    </section>}
  </section>
}
