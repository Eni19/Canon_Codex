'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { createTimelineEventAction, type AddTimelineAppearanceState } from '@/app/actions/timelines'
import { CalendarDateField } from '@/components/entities/calendar-date-field'
import type { Calendar } from '@/domain/worlds/calendar'

const initialState: AddTimelineAppearanceState = {}

export function TimelineQuickEventForm({ worldId, timelineId, updatedAt, calendar }: {
  worldId: string
  timelineId: string
  updatedAt: string
  calendar: Calendar
}) {
  const [state, action, pending] = useActionState(createTimelineEventAction, initialState)
  return <form action={action} className="space-y-4 rounded-lg border border-border bg-card p-4">
    <input type="hidden" name="worldId" value={worldId} />
    <input type="hidden" name="timelineId" value={timelineId} />
    <input type="hidden" name="expectedUpdatedAt" value={updatedAt} />
    <h2 className="font-serif text-xl">Criar Evento rápido</h2>
    <p className="text-sm text-muted-foreground">Cria um Evento e um cartão nesta linha com a mesma data inicial.</p>
    <label className="block text-sm font-medium">Título do Evento
      <input name="title" required maxLength={200} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
    </label>
    <CalendarDateField propertyKey="quickEventDate" propertyLabel="Data do Evento" calendar={calendar} defaultValue={undefined} />
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state.entityId && <p role="status" className="text-sm text-primary">Evento criado. <Link href={`/entity/${state.entityId}/edit`} className="underline">Abrir editor completo</Link></p>}
    <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{pending ? 'Criando…' : 'Criar Evento e cartão'}</button>
  </form>
}
