import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'

function DisplayValue({
  value,
  kind,
  entityTitleById,
}: {
  value: unknown
  kind: string
  entityTitleById: Record<string, string>
}) {
  if (value === undefined || value === null || value === '') {
    return <span className="text-muted-foreground">—</span>
  }

  if (kind === 'boolean') return <span>{value ? 'Sim' : 'Não'}</span>

  if (kind === 'tags' && Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((tag) => (
          <Badge key={String(tag)} variant="secondary">
            {String(tag)}
          </Badge>
        ))}
      </div>
    )
  }

  if (kind === 'reference' && typeof value === 'string') {
    return <Link href={`/entity/${value}`} className="text-primary hover:underline">{entityTitleById[value] ?? value}</Link>
  }

  if (kind === 'referenceList' && Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-2">
        {value.map((id) => (
          <Link key={String(id)} href={`/entity/${id}`} className="text-primary hover:underline">
            {entityTitleById[String(id)] ?? String(id)}
          </Link>
        ))}
      </div>
    )
  }

  return <span>{String(value)}</span>
}

export function PropertyDisplayList({
  properties,
  values,
  entityTitleById,
  columns = 2,
}: {
  properties: EntityTypeDefinition['properties']
  values: Record<string, unknown>
  entityTitleById: Record<string, string>
  columns?: 1 | 2
}) {
  const visible = properties.filter((property) => property.kind !== 'image' && property.kind !== 'gallery')
  if (visible.length === 0) return null

  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-3 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
      {visible.map((property) => (
        <div key={property.key}>
          <dt className="text-xs font-medium text-muted-foreground">{property.label}</dt>
          <dd className="mt-0.5 text-sm">
            <DisplayValue value={values[property.key]} kind={property.kind} entityTitleById={entityTitleById} />
          </dd>
        </div>
      ))}
    </dl>
  )
}
