import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ReferenceListField } from '@/components/entities/reference-list-field'
import type { PropertyDefinition } from '@/domain/entities/entityType'

export interface ReferenceOption {
  id: string
  title: string
}

const NATIVE_SELECT_CLASS =
  'border-input bg-transparent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'

export function PropertyField({
  property,
  defaultValue,
  referenceOptions,
}: {
  property: PropertyDefinition
  defaultValue: unknown
  referenceOptions?: ReferenceOption[]
}) {
  const fieldId = 'property-' + property.key
  const selectedReferences = new Set(Array.isArray(defaultValue) ? defaultValue.filter((value): value is string => typeof value === 'string') : [])

  if (property.kind === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <Checkbox id={fieldId} name={property.key} defaultChecked={defaultValue === true} />
        <Label htmlFor={fieldId} className="font-normal">{property.label}</Label>
      </div>
    )
  }

  if (property.kind === 'image' || property.kind === 'gallery') {
    return <div className="flex flex-col gap-1.5"><Label>{property.label}</Label><p className="text-xs text-muted-foreground">Propriedades de imagem chegam em uma próxima iteração.</p></div>
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId}>{property.label}</Label>
      {property.kind === 'enum' && (
        <select id={fieldId} name={property.key} defaultValue={typeof defaultValue === 'string' ? defaultValue : ''} className={NATIVE_SELECT_CLASS}>
          <option value="">Nenhuma seleção</option>
          {property.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      )}
      {property.kind === 'reference' && (
        <select id={fieldId} name={property.key} defaultValue={typeof defaultValue === 'string' ? defaultValue : ''} className={NATIVE_SELECT_CLASS}>
          <option value="">Nenhuma seleção</option>
          {referenceOptions?.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
        </select>
      )}
      {property.kind === 'referenceList' && (
        <ReferenceListField
          fieldId={fieldId}
          name={property.key}
          label={property.label}
          options={referenceOptions ?? []}
          initialValue={[...selectedReferences]}
        />
      )}
      {property.kind === 'tags' && <Input id={fieldId} name={property.key} defaultValue={Array.isArray(defaultValue) ? (defaultValue as string[]).join(', ') : ''} placeholder="separadas por vírgula" />}
      {property.kind === 'number' && <Input id={fieldId} name={property.key} type="number" defaultValue={typeof defaultValue === 'number' ? defaultValue : ''} />}
      {property.kind === 'date' && <Input id={fieldId} name={property.key} type="date" defaultValue={typeof defaultValue === 'string' ? defaultValue : ''} />}
      {property.kind === 'text' && <Input id={fieldId} name={property.key} defaultValue={typeof defaultValue === 'string' ? defaultValue : ''} />}
      {property.kind === 'textarea' && <Textarea id={fieldId} name={property.key} rows={6} defaultValue={typeof defaultValue === 'string' ? defaultValue : ''} />}
    </div>
  )
}

