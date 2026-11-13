'use client'

import { useActionState, useState } from 'react'
import { CalendarPlus, Check, Plus, Trash2 } from 'lucide-react'
import { updateCalendarAction, type CalendarActionState } from '@/app/actions/calendar'
import { CalendarSchema, changesCalendarStructure, formatCalendarDateForPreview, getCalendarYearLength, getMonthLength, isIntercalaryRuleActive, MAX_DAYS_IN_MONTH, type Calendar, type IntercalaryRule } from '@/domain/worlds/calendar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: CalendarActionState = {}
const previewYears = [-1, 0, 1]

export function CalendarSettingsForm({ initialCalendar, worldId }: { initialCalendar: Calendar; worldId: string }) {
  const [calendar, setCalendar] = useState(initialCalendar)
  const [state, action, pending] = useActionState(updateCalendarAction, initialState)
  const [previewYear, setPreviewYear] = useState(0)
  const draft = CalendarSchema.safeParse(calendar)
  const saved = CalendarSchema.parse(initialCalendar)
  const changed = JSON.stringify(draft.success ? draft.data : calendar) !== JSON.stringify(saved)
  const structural = changesCalendarStructure(saved, calendar)

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
        id: crypto.randomUUID(),
        name: 'Dia intercalar',
        month: 1,
        everyYears: 4,
        yearOffset: 0,
        extendsMonth: false,
      }],
    }))
  }

  const previewDate = { month: calendar.origin.month, day: calendar.origin.day }
  const issues = draft.success ? [] : draft.error.issues

  function fieldError(path: string) {
    const issue = issues.find((item) => item.path.join('.') === path)
    return issue && <p className="mt-1 text-xs text-destructive">{issue.message}</p>
  }

  return (
    <form action={action} onReset={(event) => event.preventDefault()} onSubmit={(event) => {
      if (draft.success && structural && !window.confirm('Salvar as mudanças de duração dos meses ou dos dias intercalares? Elas alteram a contagem de dias deste calendário.')) event.preventDefault()
    }} className="flex flex-col gap-6">
      <input type="hidden" name="calendar" value={JSON.stringify(calendar)} readOnly />
      <input type="hidden" name="worldId" value={worldId} readOnly />

      <Card>
        <CardHeader>
          <CardTitle>Unidades do calendário</CardTitle>
          <CardDescription>Defina a duração do dia e a ordem dos dias da semana e dos meses.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="max-w-xs">
            <Label htmlFor="hours-per-day">Horas por dia</Label>
            <Input id="hours-per-day" className="mt-2" type="number" min={1} value={calendar.hoursPerDay} onChange={(event) => setCalendar((current) => ({ ...current, hoursPerDay: Number(event.target.value) }))} />
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Dias da semana</legend>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {calendar.daysOfWeek.map((name, index) => <div key={index}>
                <Label htmlFor={`weekday-${index}`} className="text-xs">Dia {index + 1}</Label>
                <Input id={`weekday-${index}`} className="mt-1" required maxLength={40} value={name} onChange={(event) => setCalendar((current) => ({ ...current, daysOfWeek: current.daysOfWeek.map((day, i) => i === index ? event.target.value : day) }))} />
                {fieldError(`daysOfWeek.${index}`)}
              </div>)}
            </div>
          </fieldset>

          <div className="max-w-xs">
            <Label htmlFor="weekday-offset">Dia da semana no primeiro dia do ano zero</Label>
            <select id="weekday-offset" className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={calendar.weekdayOffset} onChange={(event) => setCalendar((current) => ({ ...current, weekdayOffset: Number(event.target.value) }))}>
              {calendar.daysOfWeek.map((day, index) => <option key={index} value={index}>{day || `Dia ${index + 1}`}</option>)}
            </select>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-sm font-medium">Meses</p><p className="mt-1 text-xs text-muted-foreground">Até 36 meses de 1 a {MAX_DAYS_IN_MONTH.toLocaleString('pt-BR')} dias.</p></div>
              <Button type="button" variant="outline" size="sm" onClick={addMonth} disabled={calendar.months.length >= 36}><Plus />Adicionar mês</Button>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {calendar.months.map((month, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(3.2rem,7rem)_auto] items-start gap-2">
                <div><Label htmlFor={`month-name-${index}`} className="text-xs text-muted-foreground">Mês {index + 1}</Label><Input id={`month-name-${index}`} className="mt-1" required maxLength={60} value={month.name} onChange={(event) => updateMonth(index, { name: event.target.value })} />{fieldError(`months.${index}.name`)}</div>
                <div><Label htmlFor={`month-length-${index}`} className="text-xs text-muted-foreground">Dias</Label><Input id={`month-length-${index}`} className="mt-1" required type="number" min={1} max={MAX_DAYS_IN_MONTH} value={month.length} onChange={(event) => updateMonth(index, { length: Number(event.target.value) })} />{fieldError(`months.${index}.length`)}</div>
                <Button type="button" variant="ghost" size="icon" className="mt-4" aria-label={`Remover ${month.name}`} disabled={calendar.months.length === 1} onClick={() => {
                  const affected = calendar.intercalaryRules.some((rule) => rule.month === index + 1) || calendar.origin.month === index + 1
                  if (affected && !window.confirm('Remover este mês? As regras ligadas a ele serão removidas e, se a origem estiver nele, ela passará para o primeiro dia do primeiro mês.')) return
                  setCalendar((current) => ({ ...current, months: current.months.filter((_, monthIndex) => monthIndex !== index), origin: current.origin.month === index + 1 ? { ...current.origin, month: 1, day: 1 } : current.origin.month > index + 1 ? { ...current.origin, month: current.origin.month - 1 } : current.origin, intercalaryRules: current.intercalaryRules.filter((rule) => rule.month !== index + 1).map((rule) => rule.month > index + 1 ? { ...rule, month: rule.month - 1 } : rule) }))
                }}><Trash2 /></Button>
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
            <div><Label htmlFor="origin-month">Mês da origem</Label><select id="origin-month" className="mt-2 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={calendar.origin.month} onChange={(event) => setCalendar((current) => ({ ...current, origin: { ...current.origin, month: Number(event.target.value) } }))}>{calendar.months.map((month, index) => <option key={index} value={index + 1}>{month.name}</option>)}</select></div>
            <div><Label htmlFor="origin-day">Dia da origem</Label><Input id="origin-day" className="mt-2" type="number" min={1} value={calendar.origin.day} onChange={(event) => setCalendar((current) => ({ ...current, origin: { ...current.origin, day: Number(event.target.value) } }))} />{fieldError('origin.day')}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Dias intercalares</CardTitle><CardDescription>Acrescente um dia ao mês ou crie uma data independente depois dele.</CardDescription></div><Button type="button" variant="outline" size="sm" onClick={addRule} disabled={calendar.intercalaryRules.length >= 100}><CalendarPlus />Adicionar regra</Button></div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {calendar.intercalaryRules.length === 0 && <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhuma regra intercalar configurada.</p>}
          {calendar.intercalaryRules.map((rule, index) => <div key={rule.id} className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><Label htmlFor={`rule-name-${index}`}>Nome</Label><Input id={`rule-name-${index}`} className="mt-1" placeholder="Ex.: Dia extra" value={rule.name} onChange={(event) => updateRule(index, { name: event.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Nome que aparece para quem lê a data.</p></div>
            <div><Label htmlFor={`rule-month-${index}`}>Mês de referência</Label><select id={`rule-month-${index}`} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={rule.month} onChange={(event) => updateRule(index, { month: Number(event.target.value) })}>{calendar.months.map((month, i) => <option key={i} value={i + 1}>{month.name}</option>)}</select></div>
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
          <div className="sm:col-span-3 rounded-md border p-3">
            <Label htmlFor="structure-preview-year">Consultar duração e intercalares por ano</Label>
            <Input id="structure-preview-year" className="mt-2 w-28" type="number" min={-1000000} max={1000000} value={previewYear} onChange={(event) => setPreviewYear(Number(event.target.value))} />
            {draft.success && Number.isSafeInteger(previewYear) && Math.abs(previewYear) <= 1000000 && <div className="mt-2 text-sm"><p>{getCalendarYearLength(draft.data, previewYear).toLocaleString('pt-BR')} dias no ano</p><ul className="mt-1 grid gap-1 sm:grid-cols-2">{draft.data.months.map((month, index) => <li key={index}>{month.name} · {getMonthLength(draft.data, previewYear, index + 1)} dias</li>)}</ul>{draft.data.intercalaryRules.some((rule) => isIntercalaryRuleActive(rule, previewYear)) && <p className="mt-2">Dias intercalares ativos · {draft.data.intercalaryRules.filter((rule) => isIntercalaryRuleActive(rule, previewYear)).map((rule) => rule.name).join(', ')}</p>}</div>}
          </div>
        </CardContent>
      </Card>

      {state.error && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{state.error}</div>}
      {structural && <p className="rounded-md border p-3 text-sm">Mudar a duração dos meses ou as regras intercalares altera a contagem dos dias. O mundo pode bloquear o salvamento se já houver datas que dependem da estrutura atual.</p>}
      {changed ? <p role="status" className="text-sm">Alterações ainda não salvas.</p> : state.saved && <div role="status" className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary"><Check className="size-4" />Calendário salvo neste mundo.</div>}
      <div className="flex flex-wrap justify-end gap-2">{changed && <Button type="button" variant="outline" disabled={pending} onClick={() => setCalendar(initialCalendar)}>Descartar alterações</Button>}<Button type="submit" size="lg" disabled={pending}>{pending ? 'Salvando…' : 'Salvar estrutura'}</Button></div>
    </form>
  )
}
