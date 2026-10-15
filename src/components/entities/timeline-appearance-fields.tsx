'use client'

import { CalendarDateField } from '@/components/entities/calendar-date-field'
import type { TimelineAppearanceFields } from '@/domain/timelines/timeline'
import type { Calendar } from '@/domain/worlds/calendar'

const scales = [
  { value: 'century', label: 'Século' },
  { value: 'decade', label: 'Década' },
  { value: 'year', label: 'Ano' },
  { value: 'month', label: 'Mês' },
  { value: 'day', label: 'Dia' },
] as const

export function TimelineAppearanceFields({ calendar, dateKey, defaults, dateLabel = 'Data da aparição (opcional)' }: {
  calendar: Calendar
  dateKey: string
  defaults?: TimelineAppearanceFields
  dateLabel?: string
}) {
  return <div className="space-y-3">
    <label className="block text-sm font-medium">Título do cartão (opcional)
      <input name="appearanceTitle" defaultValue={defaults?.title ?? ''} maxLength={120} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
    </label>
    <label className="block text-sm font-medium">Nota curta (opcional)
      <textarea name="appearanceNote" defaultValue={defaults?.note ?? ''} maxLength={500} rows={2} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
    </label>
    <CalendarDateField propertyKey={dateKey} propertyLabel={dateLabel} calendar={calendar} defaultValue={defaults?.date} />
    <label className="block text-sm font-medium">Escala mínima
      <select name="minimumScale" defaultValue={defaults?.minimumScale ?? ''} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
        <option value="">Não definida</option>
        {scales.map((scale) => <option key={scale.value} value={scale.value}>{scale.label}</option>)}
      </select>
    </label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="showCover" value="yes" defaultChecked={defaults?.showCover ?? true} />Mostrar capa do registro, se houver</label>
  </div>
}
