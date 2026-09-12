import Link from 'next/link'
import { ArrowRight, X } from 'lucide-react'
import { addRelationAction, removeRelationAction } from '@/app/actions/relations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Relation } from '@/domain/relations/relation'

export interface RelationTargetOption {
  id: string
  title: string
  typeLabel: string
}

const SELECT_CLASS =
  'border-input bg-transparent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'

export function RelationsPanel({
  entityId,
  relations,
  entityTitleById,
  targetOptions,
}: {
  entityId: string
  relations: Relation[]
  entityTitleById: Record<string, string>
  targetOptions: RelationTargetOption[]
}) {
  const boundAdd = addRelationAction.bind(null, entityId)

  return (
    <div className="flex flex-col gap-3">
      {relations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma relação ainda.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {relations.map((relation) => {
            const boundRemove = removeRelationAction.bind(null, entityId, relation.id)
            return (
              <li key={relation.id} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{relation.label ?? relation.type}</span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Link href={`/entity/${relation.targetId}`} className="truncate font-medium text-primary hover:underline">
                  {entityTitleById[relation.targetId] ?? relation.targetId}
                </Link>
                <form action={boundRemove} className="ml-auto shrink-0">
                  <button
                    type="submit"
                    aria-label="Remover relação"
                    className="rounded-sm text-muted-foreground hover:text-danger focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <X className="size-3.5" />
                  </button>
                </form>
              </li>
            )
          })}
        </ul>
      )}

      <details className="rounded-md border border-border">
        <summary className="cursor-pointer px-3 py-2 text-sm text-muted-foreground select-none">+ Adicionar relação</summary>
        <form action={boundAdd} className="flex flex-col gap-2 border-t border-border p-3">
          <select name="targetId" required defaultValue="" className={SELECT_CLASS}>
            <option value="" disabled>
              Selecione uma entidade...
            </option>
            {targetOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title} — {option.typeLabel}
              </option>
            ))}
          </select>
          <Input name="type" placeholder="Tipo de relação (ex: conhece, investiga)" required />
          <Input name="label" placeholder="Rótulo (opcional)" />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="directional" defaultChecked />
            Direcional
          </label>
          <Button type="submit" size="sm" className="self-start">
            Adicionar
          </Button>
        </form>
      </details>
    </div>
  )
}
