'use client'

import { useActionState, useState } from 'react'
import { updateCalendarLandmarksAction, type CalendarActionState } from '@/app/actions/calendar'
import { formatCalendarDateForPreview, isIntercalaryRuleActive, type Calendar } from '@/domain/worlds/calendar'
import type { CalendarExactDate } from '@/domain/worlds/calendar-exact-date'
import type { CalendarLandmarks } from '@/domain/worlds/calendar-landmarks'

type Landmark = CalendarLandmarks['landmarks'][number]
type MonthDay = { month: number; day: number }
const fieldClass = 'mt-1 block w-full rounded-md border bg-background px-3 py-2'

function previewDate(calendar: Calendar, date: MonthDay | CalendarExactDate) {
  if ('intercalaryRuleId' in date) {
    const rule = calendar.intercalaryRules.find((item) => item.id === date.intercalaryRuleId)
    return rule && isIntercalaryRuleActive(rule, date.year) ? `${rule.name} · ano ${date.year}` : 'Dia intercalar indisponível neste ano'
  }
  return 'year' in date ? formatCalendarDateForPreview(calendar, date) : `${date.day} de ${calendar.months[date.month - 1]?.name ?? 'mês inválido'}`
}

function MonthDayFields({ calendar, label, value, onChange }: { calendar: Calendar; label: string; value: MonthDay; onChange: (value: MonthDay) => void }) {
  return <div className="grid grid-cols-2 gap-2"><label className="text-sm">Mês {label}<select className={fieldClass} value={value.month} onChange={(event) => onChange({ ...value, month: Number(event.target.value) })}>{calendar.months.map((month, index) => <option key={index} value={index + 1}>{month.name}</option>)}</select></label>
    <label className="text-sm">Dia {label}<input className={fieldClass} type="number" required min="1" step="1" value={value.day} onChange={(event) => onChange({ ...value, day: Number(event.target.value) })} /></label></div>
}

function ExactDateFields({ calendar, label, value, onChange }: { calendar: Calendar; label: string; value: CalendarExactDate; onChange: (value: CalendarExactDate) => void }) {
  const intercalaries = calendar.intercalaryRules.filter((rule) => !rule.extendsMonth)
  return <div className="space-y-2"><div className="grid grid-cols-2 gap-2"><label className="text-sm">Ano {label}<input className={fieldClass} type="number" required step="1" value={value.year} onChange={(event) => onChange({ ...value, year: Number(event.target.value) })} /></label>
    {intercalaries.length > 0 && <label className="text-sm">Tipo de data {label}<select className={fieldClass} value={'intercalaryRuleId' in value ? value.intercalaryRuleId : ''} onChange={(event) => onChange(event.target.value ? { year: value.year, intercalaryRuleId: event.target.value } : { year: value.year, month: 1, day: 1 })}><option value="">Dia do mês</option>{intercalaries.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}</select></label>}</div>
    {'month' in value && <MonthDayFields calendar={calendar} label={label} value={value} onChange={(date) => onChange({ year: value.year, ...date })} />}</div>
}

export function CalendarLandmarksForm({ initialLandmarks, calendar, worldId, initialDate }: { initialLandmarks: CalendarLandmarks; calendar: Calendar; worldId: string; initialDate: CalendarExactDate }) {
  const [content, setContent] = useState(initialLandmarks)
  const [state, action, pending] = useActionState(updateCalendarLandmarksAction, {} as CalendarActionState)
  const [initialSnapshot] = useState(() => JSON.stringify(initialLandmarks))
  const [calendarSnapshot] = useState(() => JSON.stringify(calendar))
  const changed = JSON.stringify(content) !== (state.savedLandmarks ?? initialSnapshot)
  const startingDate = initialDate
  const standardStart = (): MonthDay => 'month' in startingDate ? { month: startingDate.month, day: startingDate.day } : { month: calendar.origin.month, day: calendar.origin.day }

  function updateMark(id: string, edit: (mark: Landmark) => Landmark) {
    setContent((current) => ({ ...current, landmarks: current.landmarks.map((mark) => mark.id === id ? edit(mark) : mark) }))
  }

  return <form action={action} onReset={(event) => event.preventDefault()} className="space-y-5 rounded-lg border p-4">
    <input type="hidden" name="worldId" value={worldId} />
    <input type="hidden" name="landmarks" value={JSON.stringify(content)} />
    <input type="hidden" name="expectedLandmarks" value={state.savedLandmarks ?? initialSnapshot} />
    <input type="hidden" name="expectedCalendar" value={calendarSnapshot} />
    <p className="text-sm text-muted-foreground">Crie categorias e marque acontecimentos únicos ou anuais. Intervalos incluem o dia inicial e o final.</p>
    {content.landmarks.length > 0 && <section className="rounded-md border bg-muted p-3" aria-label="Prévia dos marcos"><h3 className="text-xs font-medium uppercase tracking-wide">Prévia dos marcos</h3><ul className="mt-3 space-y-2">{content.landmarks.slice(0, 5).map((mark) => {
      const category = content.categories.find((item) => item.id === mark.categoryId)
      return <li key={mark.id} className="flex items-start gap-2 text-sm"><span aria-hidden="true" className="mt-1 size-3 shrink-0 rounded-full border" style={{ backgroundColor: category?.color }} /><span className="min-w-0 wrap-anywhere"><strong>{mark.title || 'Marco sem título'}</strong> · {category?.name || 'Sem categoria'} · {mark.kind === 'annual' ? 'todos os anos' : 'uma vez'}<small className="block text-muted-foreground">{previewDate(calendar, mark.start)}{mark.end && ` até ${previewDate(calendar, mark.end)}`}</small></span></li>
    })}</ul>{content.landmarks.length > 5 && <p className="mt-2 text-xs text-muted-foreground">Mais {content.landmarks.length - 5} marco(s) na lista abaixo.</p>}</section>}
    <section className="space-y-3"><h3 className="font-medium">Categorias</h3>
      {content.categories.length === 0 && <p className="text-sm">Adicione uma categoria para começar.</p>}
      {content.categories.map((category, index) => {
        const used = content.landmarks.some((mark) => mark.categoryId === category.id)
        return <div key={category.id} className="flex flex-wrap items-end gap-3 rounded-md border p-3"><label className="text-sm">Nome da categoria {index + 1}<input required maxLength={80} className={fieldClass} value={category.name} onChange={(event) => setContent((current) => ({ ...current, categories: current.categories.map((item) => item.id === category.id ? { ...item, name: event.target.value } : item) }))} /></label>
          <label className="text-sm">Cor<input type="color" className="mt-1 block h-10 w-20" value={category.color} onChange={(event) => setContent((current) => ({ ...current, categories: current.categories.map((item) => item.id === category.id ? { ...item, color: event.target.value } : item) }))} /></label>
          <button type="button" disabled={used} title={used ? 'Remova ou reclassifique os marcos desta categoria primeiro.' : undefined} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50" onClick={() => setContent((current) => ({ ...current, categories: current.categories.filter((item) => item.id !== category.id) }))}>Remover categoria</button>{used && <span className="text-xs text-muted-foreground">Em uso por um marco.</span>}</div>
      })}
      <button type="button" disabled={content.categories.length >= 100} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50" onClick={() => setContent((current) => ({ ...current, categories: [...current.categories, { id: crypto.randomUUID(), name: `Categoria ${current.categories.length + 1}`, color: '#d4af37' }] }))}>Adicionar categoria</button>
    </section>
    <section className="space-y-3"><h3 className="font-medium">Marcos</h3>
      {content.landmarks.length === 0 && <p className="text-sm">Nenhum marco configurado.</p>}
      {content.landmarks.map((mark, index) => <fieldset key={mark.id} className="space-y-3 rounded-md border p-4"><legend className="px-1 font-medium">Marco {index + 1}</legend>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Título<input required maxLength={120} className={fieldClass} value={mark.title} onChange={(event) => updateMark(mark.id, (item) => ({ ...item, title: event.target.value }))} /></label>
          <label className="text-sm">Categoria<select className={fieldClass} value={mark.categoryId} onChange={(event) => updateMark(mark.id, (item) => ({ ...item, categoryId: event.target.value }))}>{content.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>
        <label className="block text-sm">Descrição<textarea maxLength={1000} rows={2} className={fieldClass} value={mark.description} onChange={(event) => updateMark(mark.id, (item) => ({ ...item, description: event.target.value }))} /></label>
        <label className="block text-sm">Repetição<select className={fieldClass} value={mark.kind} onChange={(event) => updateMark(mark.id, (item) => {
          if (event.target.value === item.kind) return item
          const { id, title, description, categoryId } = item
          if (event.target.value === 'annual') return { id, title, description, categoryId, kind: 'annual', start: 'month' in item.start ? { month: item.start.month, day: item.start.day } : standardStart() }
          return item.kind === 'annual' ? { id, title, description, categoryId, kind: 'once', start: { year: startingDate.year, ...item.start } } : item
        })}><option value="once">Uma vez</option><option value="annual">Todos os anos</option></select></label>
        <p className="text-xs text-muted-foreground">Ao mudar a repetição, o fim do intervalo é removido; confira as datas antes de salvar.</p>
        {mark.kind === 'once' ? <ExactDateFields calendar={calendar} label="inicial" value={mark.start} onChange={(date) => updateMark(mark.id, (item) => item.kind === 'once' ? { ...item, start: date } : item)} /> : <MonthDayFields calendar={calendar} label="inicial" value={mark.start} onChange={(date) => updateMark(mark.id, (item) => item.kind === 'annual' ? { ...item, start: date } : item)} />}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(mark.end)} onChange={(event) => updateMark(mark.id, (item) => {
          if (!event.target.checked) return { ...item, end: undefined }
          return item.kind === 'once' ? { ...item, end: item.start } : { ...item, end: item.start }
        })} />Informar fim do intervalo</label>
        {mark.end && (mark.kind === 'once' ? <ExactDateFields calendar={calendar} label="final" value={mark.end} onChange={(date) => updateMark(mark.id, (item) => item.kind === 'once' ? { ...item, end: date } : item)} /> : <MonthDayFields calendar={calendar} label="final" value={mark.end} onChange={(date) => updateMark(mark.id, (item) => item.kind === 'annual' ? { ...item, end: date } : item)} />)}
        <button type="button" className="rounded-md border px-3 py-2 text-sm text-destructive" onClick={() => setContent((current) => ({ ...current, landmarks: current.landmarks.filter((item) => item.id !== mark.id) }))}>Remover {mark.title || `marco ${index + 1}`}</button>
      </fieldset>)}
      <button type="button" disabled={!content.categories.length || content.landmarks.length >= 5000} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50" onClick={() => setContent((current) => ({ ...current, landmarks: [...current.landmarks, { id: crypto.randomUUID(), title: `Marco ${current.landmarks.length + 1}`, description: '', categoryId: current.categories[0].id, kind: 'once', start: startingDate }] }))}>Adicionar marco</button>
      {!content.categories.length && <p className="text-xs text-muted-foreground">Crie uma categoria antes de adicionar um marco.</p>}
      <p className="text-xs text-muted-foreground">Um intervalo anual cujo fim antecede o início termina no ano seguinte. Datas anuais que não existirem em um ano serão ignoradas nesse ano.</p>
    </section>
    <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{pending ? 'Salvando…' : 'Salvar marcos e categorias'}</button>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {changed ? <p role="status" className="text-sm">Alterações ainda não salvas.</p> : state.saved && <p role="status" className="text-sm text-primary">Marcos e categorias salvos neste mundo.</p>}
  </form>
}
