'use client'

import { useActionState } from 'react'
import { updateCampaignTodayAction } from '@/app/actions/calendar'
import type { Calendar } from '@/domain/worlds/calendar'
import type { CalendarExactDate } from '@/domain/worlds/calendar-exact-date'

function TodayForm({ worldId, calendar, today, date, operation }: { worldId: string; calendar: Calendar; today: CalendarExactDate | null; date: CalendarExactDate; operation: 'set' | 'advance' }) {
  const [state, action, pending] = useActionState(updateCampaignTodayAction, {})
  return <form action={action} className="space-y-1">
    <input type="hidden" name="worldId" value={worldId} />
    <input type="hidden" name="expectedToday" value={JSON.stringify(today)} />
    <input type="hidden" name="expectedCalendar" value={JSON.stringify(calendar)} />
    <input type="hidden" name="date" value={JSON.stringify(date)} />
    <input type="hidden" name="operation" value={operation} />
    <button disabled={pending} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50" type="submit">{pending ? 'Salvando…' : operation === 'set' ? 'Definir como hoje' : 'Avançar um dia'}</button>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state.saved && <p role="status" className="text-sm">Data da campanha salva.</p>}
  </form>
}

export function CampaignTodayControls({ worldId, calendar, today, selected }: { worldId: string; calendar: Calendar; today: CalendarExactDate | null; selected: CalendarExactDate }) {
  return <div className="mt-3 flex flex-wrap gap-2">
    <TodayForm key={`set:${JSON.stringify(today)}:${JSON.stringify(selected)}`} worldId={worldId} calendar={calendar} today={today} date={selected} operation="set" />
    {today && <TodayForm key={`advance:${JSON.stringify(today)}`} worldId={worldId} calendar={calendar} today={today} date={today} operation="advance" />}
  </div>
}
