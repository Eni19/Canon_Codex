'use client'

import { useActionState } from 'react'
import { updateTimelineScaleDefaultsAction, type TimelineSettingsState } from '@/app/actions/timeline-settings'
import { TIMELINE_SCALES, TIMELINE_SCALE_LABELS } from '@/domain/timelines/timelineNavigation'
import type { TimelineScale } from '@/domain/timelines/timelineScale'

const initialState: TimelineSettingsState = {}

export function TimelineScaleSettings({ worldId, types, defaults }: {
  worldId: string; types: { id: string; label: string }[]; defaults: Record<string, TimelineScale>
}) {
  const [state, action, pending] = useActionState(updateTimelineScaleDefaultsAction, initialState)
  return <details className="rounded-lg border border-border p-4">
    <summary className="cursor-pointer text-sm font-medium">Escala mínima por tipo neste mundo</summary>
    <form key={types.map((type) => `${type.id}:${defaults[type.id]}`).join('|')} action={action} className="mt-4 space-y-3">
      <input type="hidden" name="worldId" value={worldId} />
      <p className="text-xs text-muted-foreground">Define em qual zoom cada tipo aparece. O cartão pode substituir este padrão.</p>
      {types.map((type) => <label key={type.id} className="flex items-center justify-between gap-3 text-sm">
        <span>{type.label}</span>
        <select name={`scale:${type.id}`} defaultValue={defaults[type.id]} className="rounded-md border border-input bg-background px-2 py-1 text-sm">
          {TIMELINE_SCALES.map((scale) => <option key={scale} value={scale}>{TIMELINE_SCALE_LABELS[scale]}</option>)}
        </select>
      </label>)}
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.saved && <p role="status" className="text-sm">Escalas salvas.</p>}
      <button type="submit" disabled={pending} className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50">{pending ? 'Salvando…' : 'Salvar escalas'}</button>
    </form>
  </details>
}
