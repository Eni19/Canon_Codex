'use client'

import { useActionState, useState } from 'react'
import { updateCalendarSeasonsAction, type CalendarActionState } from '@/app/actions/calendar'
import type { Calendar } from '@/domain/worlds/calendar'
import type { CalendarSeason } from '@/domain/worlds/calendar-season'

function nextStart(calendar: Calendar, seasons: CalendarSeason[]) {
  for (let month = 1; month <= calendar.months.length; month++) {
    for (let day = 1; day <= Math.min(calendar.months[month - 1].length, 37); day++) {
      if (!seasons.some((season) => season.start.month === month && season.start.day === day)) return { month, day }
    }
  }
  return null
}

export function CalendarSeasonsForm({ initialSeasons, calendar, worldId }: { initialSeasons: CalendarSeason[]; calendar: Calendar; worldId: string }) {
  const [seasons, setSeasons] = useState(initialSeasons)
  const [state, action, pending] = useActionState(updateCalendarSeasonsAction, {} as CalendarActionState)
  const [initialSnapshot] = useState(() => JSON.stringify(initialSeasons))
  const [calendarSnapshot] = useState(() => JSON.stringify(calendar))
  const next = nextStart(calendar, seasons)
  const changed = JSON.stringify(seasons) !== (state.savedSeasons ?? initialSnapshot)

  function update(index: number, patch: Partial<CalendarSeason>) {
    setSeasons((current) => current.map((season, i) => i === index ? { ...season, ...patch } : season))
  }

  return <form action={action} onReset={(event) => event.preventDefault()} className="space-y-4 rounded-lg border p-4">
    <input type="hidden" name="worldId" value={worldId} />
    <input type="hidden" name="seasons" value={JSON.stringify(seasons)} />
    <input type="hidden" name="expectedSeasons" value={state.savedSeasons ?? initialSnapshot} />
    <input type="hidden" name="expectedCalendar" value={calendarSnapshot} />
    <p className="text-sm text-muted-foreground">Escolha o nome, a cor e a data em que cada estação começa. Ela dura até a próxima, inclusive na virada do ano.</p>
    {seasons.length > 0 && <div className="rounded-md border p-3"><p className="text-xs font-medium uppercase tracking-wide">Prévia das estações</p><ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">{seasons.map((season) => <li key={season.id} className="flex items-center gap-2 text-sm"><span aria-hidden="true" className="size-3 rounded-full border" style={{ backgroundColor: season.color }} /><span>{season.name || 'Sem nome'} · {season.start.day} de {calendar.months[season.start.month - 1]?.name ?? 'mês inválido'}</span></li>)}</ul></div>}
    {seasons.length === 0 && <p className="text-sm">Nenhuma estação configurada.</p>}
    {seasons.map((season, index) => <fieldset key={season.id} className="grid gap-3 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-4">
      <legend className="max-w-full px-1 font-medium wrap-anywhere">{season.name || `Estação ${index + 1}`}</legend>
      <label className="text-sm">Nome<input required maxLength={80} className="mt-1 block w-full rounded-md border bg-background px-3 py-2" value={season.name} onChange={(event) => update(index, { name: event.target.value })} /></label>
      <label className="text-sm">Cor<input type="color" className="mt-1 block h-10 w-20" value={season.color} onChange={(event) => update(index, { color: event.target.value })} /></label>
      <label className="text-sm">Mês de início<select className="mt-1 block w-full rounded-md border bg-background px-3 py-2" value={season.start.month} onChange={(event) => update(index, { start: { ...season.start, month: Number(event.target.value) } })}>{calendar.months.map((month, i) => <option key={i} value={i + 1}>{month.name}</option>)}</select></label>
      <label className="text-sm">Dia de início<input required type="number" min="1" max={calendar.months[season.start.month - 1]?.length ?? 1} step="1" className="mt-1 block w-full rounded-md border bg-background px-3 py-2" value={season.start.day} onChange={(event) => update(index, { start: { ...season.start, day: Number(event.target.value) } })} /></label>
      <button type="button" className="justify-self-start rounded-md border px-3 py-2 text-sm text-destructive" onClick={() => setSeasons((current) => current.filter((_, i) => i !== index))}>Remover {season.name || `estação ${index + 1}`}</button>
    </fieldset>)}
    <div className="flex flex-wrap gap-3"><button type="button" disabled={seasons.length >= 36 || !next} className="rounded-md border px-4 py-2 text-sm disabled:opacity-50" onClick={() => { if (next) setSeasons((current) => [...current, { id: crypto.randomUUID(), name: `Estação ${current.length + 1}`, color: '#d4af37', start: next }]) }}>Adicionar estação</button>
      <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{pending ? 'Salvando…' : 'Salvar estações'}</button></div>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {changed ? <p role="status" className="text-sm">Alterações ainda não salvas.</p> : state.saved && <p role="status" className="text-sm text-primary">Estações salvas neste mundo.</p>}
    <p className="text-xs text-muted-foreground">Cada início precisa ser único e existir todos os anos. Mudanças estruturais ficam bloqueadas enquanto houver estações salvas.</p>
  </form>
}
