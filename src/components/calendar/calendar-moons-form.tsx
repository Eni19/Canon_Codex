'use client'

import { useActionState, useState } from 'react'
import { updateCalendarMoonsAction, type CalendarActionState } from '@/app/actions/calendar'
import { getMonthLength, type Calendar } from '@/domain/worlds/calendar'
import { projectMoonPhase, type CalendarMoon } from '@/domain/worlds/calendar-moon'
import { exactDateToOrdinal, type CalendarExactDate } from '@/domain/worlds/calendar-exact-date'
import { MoonDisc } from './moon-disc'

export function CalendarMoonsForm({ initialMoons, calendar, worldId, initialDate }: { initialMoons: CalendarMoon[]; calendar: Calendar; worldId: string; initialDate: CalendarExactDate }) {
  const [moons, setMoons] = useState(initialMoons)
  const [state, action, pending] = useActionState(updateCalendarMoonsAction, {} as CalendarActionState)
  const [initialSnapshot] = useState(() => JSON.stringify(initialMoons))
  const [calendarSnapshot] = useState(() => JSON.stringify(calendar))
  const changed = JSON.stringify(moons) !== (state.savedMoons ?? initialSnapshot)

  function update(index: number, patch: Partial<CalendarMoon>) {
    setMoons((current) => current.map((moon, i) => i === index ? { ...moon, ...patch } : moon))
  }

  return <form action={action} onReset={(event) => event.preventDefault()} className="space-y-4 rounded-lg border p-4">
    <input type="hidden" name="worldId" value={worldId} />
    <input type="hidden" name="moons" value={JSON.stringify(moons)} />
    <input type="hidden" name="expectedMoons" value={state.savedMoons ?? initialSnapshot} />
    <input type="hidden" name="expectedCalendar" value={calendarSnapshot} />
    <p className="text-sm text-muted-foreground">Configure até cinco luas. A data de referência é um dia de lua nova no calendário deste mundo.</p>
    {moons.length > 0 && <section className="rounded-md border bg-muted p-3" aria-label="Prévia das luas no dia selecionado"><h3 className="text-xs font-medium uppercase tracking-wide">Prévia no dia selecionado</h3><ul className="mt-3 flex flex-wrap gap-x-5 gap-y-3">{moons.map((moon) => {
      try {
        const phase = projectMoonPhase(calendar, moon, exactDateToOrdinal(calendar, initialDate))
        return <li key={moon.id} className="flex items-center gap-2 text-sm"><MoonDisc color={moon.color} position={phase.position} className="size-6 shrink-0" /><span><strong>{moon.name}</strong> · {phase.phase} · {Math.round(phase.illuminated * 100)}% iluminada</span></li>
      } catch {
        return <li key={moon.id} className="text-sm">{moon.name || 'Lua sem nome'} · confira o ciclo e a data de lua nova para ver a prévia.</li>
      }
    })}</ul></section>}
    {moons.length === 0 && <p className="text-sm">Nenhuma lua configurada.</p>}
    {moons.map((moon, index) => <fieldset key={moon.id} className="grid gap-3 rounded-md border p-4 sm:grid-cols-2">
      <legend className="max-w-full px-1 font-medium wrap-anywhere">{moon.name || `Lua ${index + 1}`}</legend>
      <label className="text-sm">Nome<input required maxLength={80} className="mt-1 block w-full rounded-md border bg-background px-3 py-2" value={moon.name} onChange={(event) => update(index, { name: event.target.value })} /></label>
      <label className="text-sm">Cor<input type="color" className="mt-1 block h-10 w-20" value={moon.color} onChange={(event) => update(index, { color: event.target.value })} /></label>
      <label className="text-sm">Duração do ciclo (dias)<input required type="number" min="0.001" max="1000000" step="0.001" className="mt-1 block w-full rounded-md border bg-background px-3 py-2" value={moon.cycleDays} onChange={(event) => update(index, { cycleDays: Number(event.target.value) })} /><span className="mt-1 block text-xs text-muted-foreground">Tempo de uma lua nova até a próxima. Ex.: 28 dias.</span></label>
      <div className="sm:col-span-2"><p className="mb-2 text-sm font-medium">Data de lua nova</p><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm">Ano<input required type="number" step="1" className="mt-1 block w-full rounded-md border bg-background px-3 py-2" value={moon.newMoon.year} onChange={(event) => update(index, { newMoon: { ...moon.newMoon, year: Number(event.target.value) } })} /></label>
        <label className="text-sm">Mês<select className="mt-1 block w-full rounded-md border bg-background px-3 py-2" value={moon.newMoon.month} onChange={(event) => update(index, { newMoon: { ...moon.newMoon, month: Number(event.target.value) } })}>{calendar.months.map((month, i) => <option key={i} value={i + 1}>{month.name}</option>)}</select></label>
        <label className="text-sm">Dia<input required type="number" min="1" max={Number.isSafeInteger(moon.newMoon.year) ? getMonthLength(calendar, moon.newMoon.year, moon.newMoon.month) : undefined} step="1" className="mt-1 block w-full rounded-md border bg-background px-3 py-2" value={moon.newMoon.day} onChange={(event) => update(index, { newMoon: { ...moon.newMoon, day: Number(event.target.value) } })} /></label>
      </div></div>
      <button type="button" className="justify-self-start rounded-md border px-3 py-2 text-sm text-destructive" onClick={() => setMoons((current) => current.filter((_, i) => i !== index))}>Remover {moon.name || `lua ${index + 1}`}</button>
    </fieldset>)}
    <div className="flex flex-wrap gap-3"><button type="button" disabled={moons.length >= 5} className="rounded-md border px-4 py-2 text-sm disabled:opacity-50" onClick={() => setMoons((current) => [...current, { id: crypto.randomUUID(), name: `Lua ${current.length + 1}`, color: '#d4af37', cycleDays: 28, newMoon: { year: 0, month: calendar.origin.month, day: calendar.origin.day } }])}>Adicionar lua</button>
      <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{pending ? 'Salvando…' : 'Salvar luas'}</button></div>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {changed ? <p role="status" className="text-sm">Alterações ainda não salvas.</p> : state.saved && <p role="status" className="text-sm text-primary">Luas salvas neste mundo.</p>}
    <p className="text-xs text-muted-foreground">As luas salvas aparecem na grade mensal. Alterações estruturais ficam bloqueadas enquanto houver luas. A troca de origem mostra o deslocamento das referências lunares antes da confirmação.</p>
  </form>
}
