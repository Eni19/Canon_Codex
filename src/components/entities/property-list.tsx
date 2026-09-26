'use client'

import { PropertyField, type ReferenceOption } from '@/components/entities/property-field'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'

export function PropertyList({
  properties,
  values,
  referenceOptionsByKey,
}: {
  properties: EntityTypeDefinition['properties']
  values: Record<string, unknown>
  referenceOptionsByKey: Record<string, ReferenceOption[]>
}) {
  if (properties.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {properties.map((property) => (
        <PropertyField
          key={property.key}
          property={property}
          defaultValue={values[property.key]}
          referenceOptions={referenceOptionsByKey[property.key]}
        />
      ))}
    </div>
  )
}
