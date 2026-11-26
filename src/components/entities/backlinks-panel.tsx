import Link from 'next/link'
import { ArrowLeft, ArrowLeftRight, Minus } from 'lucide-react'
import { relationDirection } from '@/domain/relations/relation'
import type { Backlink } from '@/repositories/contracts/worldRepository'

export function BacklinksPanel({ backlinks }: { backlinks: Backlink[] }) {
  if (backlinks.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma referência de outras páginas ainda.</p>
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {backlinks.map(({ entity, relation }) => {
        const direction = relationDirection(relation)
        const Icon = direction === 'both' ? ArrowLeftRight : direction === 'none' ? Minus : ArrowLeft
        return <li key={relation.id} className="flex items-center gap-2 text-sm">
          <Link href={`/entity/${entity.id}`} className="font-medium text-primary hover:underline">
            {entity.title}
          </Link>
          <Icon className="size-3.5 text-muted-foreground" role="img" aria-label={direction === 'both' ? 'Duas direções' : direction === 'none' ? 'Sem direção' : 'Uma direção'} />
          <span className="text-muted-foreground">{relation.label ?? relation.type}</span>
        </li>
      })}
    </ul>
  )
}
