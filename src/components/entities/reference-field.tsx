'use client'

import { useState } from 'react'
import { CardPickerField } from '@/components/ui/card-picker'
import type { ReferenceOption } from './property-field'

export function ReferenceField({
  fieldId,
  name,
  label,
  options,
  initialValue,
}: {
  fieldId: string
  name: string
  label: string
  options: ReferenceOption[]
  initialValue?: string
}) {
  const [selected, setSelected] = useState(initialValue ?? '')
  const lowerLabel = label.toLocaleLowerCase('pt-BR')
  return (
    <CardPickerField
      id={fieldId}
      name={name}
      value={selected}
      onChange={setSelected}
      items={options}
      clearable
      title={'Escolher ' + lowerLabel}
      placeholder={'Escolher ' + lowerLabel + '...'}
      searchPlaceholder={'Buscar ' + lowerLabel + ' por nome'}
      emptyMessage="Nenhum registro encontrado."
    />
  )
}
