'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getDateFieldEditorValue,
  validateCalendarDateValue,
  type CalendarDateBoundary,
  type CalendarDateValue,
} from '@/domain/worlds/calendar-date'
import type { Calendar } from '@/domain/worlds/calendar'

type Precision = 'year' | 'month' | 'day'
type BoundaryKey = 'start' | 'end'
type BoundaryDraft = {
  year: string
  month: string
  day: string
  approximate: boolean
}

const EMPTY_BOUNDARY: BoundaryDraft = { year: '', month: '', day: '', approximate: false }

export function CalendarDateField({
  propertyKey,
  propertyLabel,
  calendar,
  defaultValue,
}: {
  propertyKey: string
  propertyLabel: string
  calendar: Calendar
  defaultValue: unknown
}) {
  const initialValue = useMemo(() => getDateFieldEditorValue(calendar, defaultValue), [calendar, defaultValue])
  const initialObject = initialValue && typeof initialValue === 'object' ? initialValue : null
  const [start, setStart] = useState<BoundaryDraft>(() => boundaryToDraft(initialObject?.start))
  const [end, setEnd] = useState<BoundaryDraft>(() => boundaryToDraft(initialObject?.end))
  const [hasEnd, setHasEnd] = useState(Boolean(initialObject?.end))
  const [legacyValue, setLegacyValue] = useState(typeof initialValue === 'string' ? initialValue : '')

  const value = useMemo(() => {
    if (legacyValue) return null
    return {
      start: draftToBoundary(start),
      ...(hasEnd ? { end: draftToBoundary(end) } : {}),
    } satisfies CalendarDateValue
  }, [end, hasEnd, legacyValue, start])
  const validationError = useMemo(() => {
    if (!value) return null
    if (!start.year.trim()) return null
    const result = validateCalendarDateValue(calendar, value)
    return result.success ? null : result.error
  }, [calendar, start.year, value])
  const serializedValue = legacyValue || (value && start.year.trim() ? JSON.stringify(value) : '')

  function updateBoundary(key: BoundaryKey, patch: Partial<BoundaryDraft>) {
    if (key === 'start') setStart((current) => ({ ...current, ...patch }))
    else setEnd((current) => ({ ...current, ...patch }))
    setLegacyValue('')
  }

  function setPrecision(key: BoundaryKey, precision: Precision) {
    const current = key === 'start' ? start : end
    const next = precision === 'year'
      ? { ...current, month: '', day: '' }
      : precision === 'month'
        ? { ...current, month: current.month || '1', day: '' }
        : { ...current, month: current.month || '1', day: current.day || '1' }
    updateBoundary(key, next)
  }

  function renderBoundary(key: BoundaryKey, label: string, draft: BoundaryDraft) {
    const precision = getPrecision(draft)
    return (
      <fieldset className="rounded-lg border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">{label}</legend>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:grid-cols-[7rem_1fr_auto]">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Precisão
            <select
              aria-label={`Precisão do ${label.toLowerCase()}`}
              value={precision}
              onChange={(event) => setPrecision(key, event.target.value as Precision)}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
            >
              <option value="year">Ano</option>
              <option value="month">Ano e mês</option>
              <option value="day">Dia completo</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Ano
            <Input
              id={key === 'start' ? `property-${propertyKey}-year` : `property-${propertyKey}-end-year`}
              aria-label={`Ano do ${label.toLowerCase()}`}
              inputMode="numeric"
              value={draft.year}
              onChange={(event) => updateBoundary(key, { year: event.target.value })}
              placeholder="0 ou -1"
            />
          </label>
          <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground sm:col-span-1 sm:self-end sm:pb-1">
            <input
              type="checkbox"
              checked={draft.approximate}
              onChange={(event) => updateBoundary(key, { approximate: event.target.checked })}
            />
            Aproximada
          </label>
        </div>

        {precision !== 'year' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Mês
              <select
                aria-label={`Mês do ${label.toLowerCase()}`}
                value={draft.month}
                onChange={(event) => updateBoundary(key, { month: event.target.value, day: precision === 'day' ? draft.day : '' })}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
              >
                <option value="">Escolha o mês</option>
                {calendar.months.map((month, index) => <option key={`${index + 1}-${month.name}`} value={index + 1}>{month.name}</option>)}
              </select>
            </label>
            {precision === 'day' && (
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Dia
                <Input
                  aria-label={`Dia do ${label.toLowerCase()}`}
                  inputMode="numeric"
                  value={draft.day}
                  onChange={(event) => updateBoundary(key, { day: event.target.value })}
                  placeholder="1"
                />
              </label>
            )}
          </div>
        )}
      </fieldset>
    )
  }

  return (
    <div className="flex flex-col gap-2 sm:col-span-2" data-date-editor={propertyKey}>
      <Label htmlFor={`property-${propertyKey}-year`}>{propertyLabel}</Label>
      <input type="hidden" name={propertyKey} value={serializedValue ?? ''} />
      {legacyValue ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Data ISO legada
            <Input value={legacyValue} onChange={(event) => setLegacyValue(event.target.value)} placeholder="AAAA-MM-DD" />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">Este valor antigo continua editável. Use AAAA-MM-DD para corrigir ou manter a data durante a transição.</p>
        </div>
      ) : (
        <>
          {renderBoundary('start', 'Início', start)}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={hasEnd} onChange={(event) => { setHasEnd(event.target.checked); setLegacyValue('') }} />
            Informar fim do intervalo
          </label>
          {hasEnd && renderBoundary('end', 'Fim', end)}
          {validationError && <p role="alert" className="text-xs text-destructive">{validationError}</p>}
          <p className="text-xs text-muted-foreground">Aceita ano, mês ou dia; anos negativos e ano zero não usam o calendário nativo do navegador.</p>
        </>
      )}
    </div>
  )
}

function boundaryToDraft(boundary: CalendarDateBoundary | undefined): BoundaryDraft {
  return boundary
    ? {
        year: String(boundary.year),
        month: boundary.month === undefined ? '' : String(boundary.month),
        day: boundary.day === undefined ? '' : String(boundary.day),
        approximate: boundary.approximate === true,
      }
    : EMPTY_BOUNDARY
}

function draftToBoundary(draft: BoundaryDraft): CalendarDateBoundary {
  const year = draft.year.trim() === '' ? undefined : Number(draft.year)
  const month = draft.month.trim() === '' ? undefined : Number(draft.month)
  const day = draft.day.trim() === '' ? undefined : Number(draft.day)
  return { year: year as number, ...(month === undefined ? {} : { month }), ...(day === undefined ? {} : { day }), approximate: draft.approximate }
}

function getPrecision(draft: BoundaryDraft): Precision {
  if (draft.day !== '') return 'day'
  if (draft.month !== '') return 'month'
  return 'year'
}
