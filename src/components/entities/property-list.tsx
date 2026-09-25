import { PropertyField, type ReferenceOption } from '@/components/entities/property-field'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import type { Calendar } from '@/domain/worlds/calendar'

export function PropertyList({
  properties,
  values,
  referenceOptionsByKey,
  calendar,
}: {
  properties: EntityTypeDefinition['properties']
  values: Record<string, unknown>
  referenceOptionsByKey: Record<string, ReferenceOption[]>
  calendar: Calendar
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
          calendar={calendar}
        />
      ))}
    </div>
  )
}
