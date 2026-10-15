'use client'

import { useActionState } from 'react'
import { updateTimelineAppearanceAction, type AddTimelineAppearanceState } from '@/app/actions/timelines'
import { TimelineAppearanceFields } from '@/components/entities/timeline-appearance-fields'
import type { TimelineAppearance } from '@/domain/timelines/timeline'
import type { Calendar } from '@/domain/worlds/calendar'

const initialState: AddTimelineAppearanceState = {}

export function TimelineEditForm({ worldId, timelineId, updatedAt, appearance, calendar }: {
  worldId: string
  timelineId: string
  updatedAt: string
  appearance: TimelineAppearance
  calendar: Calendar
}) {
  const [state, action, pending] = useActionState(updateTimelineAppearanceAction, initialState)
  // React resets successful action forms; cancel the native reset so controlled date
  // selects stay consistent with their draft and subsequent submissions.
  return <form action={action} onReset={(event) => event.preventDefault()} className="mt-3 space-y-3 text-sm">
      <input type="hidden" name="worldId" value={worldId} />
      <input type="hidden" name="timelineId" value={timelineId} />
      <input type="hidden" name="appearanceId" value={appearance.id} />
      <input type="hidden" name="expectedUpdatedAt" value={updatedAt} />
      <TimelineAppearanceFields calendar={calendar} dateKey={`appearanceDate_${appearance.id}`} defaults={appearance} />
      {state.error && <p role="alert" className="text-destructive">{state.error}</p>}
      {state.saved && <p role="status" className="text-primary">Cartão salvo.</p>}
      <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">{pending ? 'Salvando…' : 'Salvar cartão'}</button>
  </form>
}
