'use client'

import { useActionState, useState } from 'react'
import { CalendarPlus, Check, Plus, Trash2 } from 'lucide-react'
import { updateCalendarAction, type CalendarActionState } from '@/app/actions/calendar'
import { formatCalendarDateForPreview, MAX_DAYS_IN_MONTH, type Calendar, type IntercalaryRule } from '@/domain/worlds/calendar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const initialState: CalendarActionState = {}
const previewYears = [-1, 0, 1]

export function CalendarSettingsForm({ initialCalendar, worldId }: { initialCalendar: Calendar; worldId: string }) {
  const [calendar, setCalendar] = useState(initialCalendar)
  const [state, action, pending] = useActionState(updateCalendarAction, initialState)

  function updateDays(value: string) {
    const days = value.split('\n').slice(0, 7)
    setCalendar((current) => ({ ...current, daysOfWeek: current.daysOfWeek.map((_, index) => days[index] ?? '') }))
  }

  function updateMonth(index: number, patch: Partial<Calendar['months'][number]>) {
    setCalendar((current) => ({ ...current, months: current.months.map((month, monthIndex) => monthIndex === index ? { ...month, ...patch } : month) }))
  }

  function updateRule(index: number, patch: Partial<IntercalaryRule>) {
    setCalendar((current) => ({ ...current, intercalaryRules: current.intercalaryRules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule) }))
  }

  function addMonth() {
    setCalendar((current) => ({ ...current, months: [...current.months, { name: `Mês ${current.months.length + 1}`, length: 30 }] }))
  }

  function addRule() {
    setCalendar((current) => ({
      ...current,
      intercalaryRules: [...current.intercalaryRules, {
        id: `rule-${Date.now()}`,
        name: 'Dia intercalar',
        month: Math.min(1, current.months.length),
        everyYears: 4,
        yearOffset: 0,
        extendsMonth: false,
      }],
    }))
  }

  const previewDate = { month: calendar.origin.month, day: calendar.origin.day }

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="calendar" value={JSON.stringify(calendar)} readOnly />
      <input type="hidden" name="worldId" value={worldId} readOnly />

      <Card>
        <CardHeader>
          <CardTitle>Unidades do calendário</CardTitle>
          <CardDescription>Os dias avançam continuamente; meses podem ter comprimentos diferentes.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="max-w-xs">
            <Label htmlFor="hours-per-day">Horas por dia</Label>
            <Input id="hours-per-day" className="mt-2" type="number" min={1} value={calendar.hoursPerDay} onChange={(event) => setCalendar((current) => ({ ...current, hoursPerDay: Number(event.target.value) }))} />
          </div>

          <div>
            <Label htmlFor="days-of-week">Nomes dos dias da semana</Label>
            <Textarea id="days-of-week" className="mt-2 font-mono text-sm" rows={7} value={calendar.daysOfWeek.join('\n')} onChange={(event) => updateDays(event.target.value)} aria-describedby="days-help" />
            <p id="days-help" className="mt-1 text-xs text-muted-foreground">Informe exatamente sete nomes, um por linha.</p>
          </div>

          <div className="max-w-xs">
            <Label htmlFor="weekday-offset">Dia da semana no primeiro dia do ano zero</Label>
            <select id="weekday-offset" className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={calendar.weekdayOffset} onChange={(event) => setCalendar((current) => ({ ...current, weekdayOffset: Number(event.target.value) }))}>
              {calendar.daysOfWeek.map((day, index) => <option key={index} value={index}>{day || `Dia ${index + 1}`}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div><Label>Meses</Label><p className="mt-1 text-xs text-muted-foreground">Cada comprimento é contado em dias completos.</p></div>
              <Button type="button" variant="outline" size="sm" onClick={addMonth}><Plus />Adicionar mês</Button>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {calendar.months.map((month, index) => <div key={index} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
                <div><Label htmlFor={`month-name-${index}`} className="text-xs text-muted-foreground">Mês {index + 1}</Label><Input id={`month-name-${index}`} className="mt-1" value={month.name} onChange={(event) => updateMonth(index, { name: event.target.value })} /></div>
                <div><Label htmlFor={`month-length-${index}`} className="text-xs text-muted-foreground">Dias</Label><Input id={`month-length-${index}`} className="mt-1" type="number" min={1} max={MAX_DAYS_IN_MONTH} value={month.length} onChange={(event) => updateMonth(index, { length: Number(event.target.value) })} /><p className="mt-1 text-xs text-muted-foreground">Máximo: {MAX_DAYS_IN_MONTH.toLocaleString('pt-BR')}.</p></div>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${month.name}`} disabled={calendar.months.length === 1} onClick={() => setCalendar((current) => ({ ...current, months: current.months.filter((_, monthIndex) => monthIndex !== index), origin: current.origin.month === index + 1 ? { ...current.origin, month: 1, day: 1 } : current.origin.month > index + 1 ? { ...current.origin, month: current.origin.month - 1 } : current.origin, intercalaryRules: current.intercalaryRules.filter((rule) => rule.month !== index + 1).map((rule) => rule.month > index + 1 ? { ...rule, month: rule.month - 1 } : rule) }))}><Trash2 /></Button>
              </div>)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eras e origem</CardTitle>
          <CardDescription>O ano zero é completo e pode começar a origem em qualquer mês e dia válidos.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><Label htmlFor="era-before">Era anterior</Label><Input id="era-before" className="mt-2" value={calendar.eras.before} onChange={(event) => setCalendar((current) => ({ ...current, eras: { ...current.eras, before: event.target.value } }))} /></div>
          <div><Label htmlFor="era-after">Era posterior</Label><Input id="era-after" className="mt-2" value={calendar.eras.after} onChange={(event) => setCalendar((current) => ({ ...current, eras: { ...current.eras, after: event.target.value } }))} /></div>
          <div><Label htmlFor="origin-name">Nome da origem</Label><Input id="origin-name" className="mt-2" value={calendar.origin.name} onChange={(event) => setCalendar((current) => ({ ...current, origin: { ...current.origin, name: event.target.value } }))} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label htmlFor="origin-month">Mês da origem</Label><Input id="origin-month" className="mt-2" type="number" min={1} max={calendar.months.length} value={calendar.origin.month} onChange={(event) => setCalendar((current) => ({ ...current, origin: { ...current.origin, month: Number(event.target.value) } }))} /></div>
            <div><Label htmlFor="origin-day">Dia da origem</Label><Input id="origin-day" className="mt-2" type="number" min={1} value={calendar.origin.day} onChange={(event) => setCalendar((current) => ({ ...current, origin: { ...current.origin, day: Number(event.target.value) } }))} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3"><div><CardTitle>Dias intercalares</CardTitle><CardDescription>Adicione um dia ao fim de um mês ou depois dele em anos recorrentes. Saltos e inclusões permitem ciclos como o gregoriano.</CardDescription></div><Button type="button" variant="outline" size="sm" onClick={addRule}><CalendarPlus />Adicionar regra</Button></div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {calendar.intercalaryRules.length === 0 && <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhuma regra intercalar configurada.</p>}
          {calendar.intercalaryRules.map((rule, index) => <div key={rule.id} className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><Label htmlFor={`rule-name-${index}`}>Nome</Label><Input id={`rule-name-${index}`} className="mt-1" placeholder="Ex.: Dia extra" value={rule.name} onChange={(event) => updateRule(index, { name: event.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Nome que aparece para quem lê a data.</p></div>
            <div><Label htmlFor={`rule-month-${index}`}>Depois do mês</Label><Input id={`rule-month-${index}`} className="mt-1" type="number" min={1} max={calendar.months.length} value={rule.month} onChange={(event) => updateRule(index, { month: Number(event.target.value) })} aria-describedby={`rule-month-help-${index}`} /><p id={`rule-month-help-${index}`} className="mt-1 text-xs text-muted-foreground">1 coloca o dia após o primeiro mês.</p></div>
            <div><Label htmlFor={`rule-every-${index}`}>A cada (anos)</Label><Input id={`rule-every-${index}`} className="mt-1" type="number" min={1} value={rule.everyYears} onChange={(event) => updateRule(index, { everyYears: Number(event.target.value) })} aria-describedby={`rule-every-help-${index}`} /><p id={`rule-every-help-${index}`} className="mt-1 text-xs text-muted-foreground">4 repete a regra a cada quatro anos.</p></div>
            <div><Label htmlFor={`rule-offset-${index}`}>Deslocamento</Label><Input id={`rule-offset-${index}`} className="mt-1" type="number" min={0} value={rule.yearOffset} onChange={(event) => updateRule(index, { yearOffset: Number(event.target.value) })} aria-describedby={`rule-offset-help-${index}`} /><p id={`rule-offset-help-${index}`} className="mt-1 text-xs text-muted-foreground">0 usa anos divisíveis pelo ciclo; 1 desloca um ano.</p></div>
            <div><Label htmlFor={`rule-skip-${index}`}>Salta a cada (opcional)</Label><Input id={`rule-skip-${index}`} className="mt-1" type="number" min={1} placeholder="Ex.: 100" value={rule.skipEveryYears ?? ''} onChange={(event) => updateRule(index, { skipEveryYears: event.target.value ? Number(event.target.value) : undefined, includeEveryYears: event.target.value ? rule.includeEveryYears : undefined })} aria-describedby={`rule-skip-help-${index}`} /><p id={`rule-skip-help-${index}`} className="mt-1 text-xs text-muted-foreground">100 pula os anos divisíveis por 100.</p></div>
            <div><Label htmlFor={`rule-include-${index}`}>Inclui a cada (opcional)</Label><Input id={`rule-include-${index}`} className="mt-1" type="number" min={1} placeholder="Ex.: 400" value={rule.includeEveryYears ?? ''} onChange={(event) => updateRule(index, { includeEveryYears: event.target.value ? Number(event.target.value) : undefined })} aria-describedby={`rule-include-help-${index}`} /><p id={`rule-include-help-${index}`} className="mt-1 text-xs text-muted-foreground">400 recoloca uma ocorrência entre os anos pulados.</p></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rule.extendsMonth} onChange={(event) => updateRule(index, { extendsMonth: event.target.checked })} />Contar como último dia do mês</label>
            <Button type="button" variant="ghost" size="sm" className="justify-self-start text-destructive" onClick={() => setCalendar((current) => ({ ...current, intercalaryRules: current.intercalaryRules.filter((_, ruleIndex) => ruleIndex !== index) }))}><Trash2 />Remover regra</Button>
          </div>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Prévia de datas</CardTitle><CardDescription>O mesmo cálculo é usado por toda a aplicação e não depende de Date do JavaScript.</CardDescription></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {previewYears.map((year) => <div key={year} className="rounded-md border border-border bg-muted/20 p-3"><p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Ano {year}</p><p className="mt-2 text-sm">{formatCalendarDateForPreview(calendar, { year, ...previewDate })}</p></div>)}
          <p className="sm:col-span-3 text-xs text-muted-foreground">Os campos de data já existentes continuam armazenados e exibidos como valores ISO legíveis; esta tela configura a convenção usada pelas linhas do tempo.</p>
        </CardContent>
      </Card>

      {state.error && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{state.error}</div>}
      {state.saved && <div role="status" className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary"><Check className="size-4" />Calendário salvo neste mundo.</div>}
      <div className="flex justify-end"><Button type="submit" size="lg" disabled={pending}>{pending ? 'Salvando…' : 'Salvar calendário'}</Button></div>
    </form>
  )
}
