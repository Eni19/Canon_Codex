'use client'

import { useState } from 'react'
import { CardPickerMultiField } from '@/components/ui/card-picker'
import { useReferenceSelection } from './reference-selection-context'
import type { ReferenceOption } from './property-field'

export function ReferenceListField({
  fieldId,
  name,
  label,
  options,
  initialValue,
  restrictToKey,
}: {
  fieldId: string
  name: string
  label: string
  options: ReferenceOption[]
  initialValue: string[]
  /** Offer only items currently selected in another list field (e.g. leaders chosen among members). */
  restrictToKey?: string
}) {
  const shared = useReferenceSelection()
  const [selected, setSelected] = useState(initialValue)
  const source = restrictToKey ? shared?.selections[restrictToKey] : undefined
  // Leaders (and similar) must stay a subset of their source list, even after a source item is removed.
  const value = source ? selected.filter((id) => source.includes(id)) : selected

  const update = (next: string[]) => {
    setSelected(next)
    shared?.setSelection(name, next)
  }

  const lowerLabel = label.toLocaleLowerCase('pt-BR')
  return (
    <CardPickerMultiField
      id={fieldId}
      name={name}
      value={value}
      onChange={update}
      items={options}
      pickableIds={restrictToKey ? source ?? [] : undefined}
      title={'Escolher ' + lowerLabel}
      addLabel={'Adicionar ' + lowerLabel}
      emptyText="Nenhuma associação selecionada."
      searchPlaceholder={'Buscar ' + lowerLabel + ' por nome'}
      emptyMessage={restrictToKey ? 'Nenhum candidato disponível. Escolha antes os itens de origem.' : 'Nenhum registro encontrado.'}
    />
  )
}
