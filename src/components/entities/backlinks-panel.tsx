import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Backlink } from '@/repositories/contracts/worldRepository'

export function BacklinksPanel({ backlinks }: { backlinks: Backlink[] }) {
  if (backlinks.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma referência de outras páginas ainda.</p>
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {backlinks.map(({ entity, relation }) => (
        <li key={relation.id} className="flex items-center gap-2 text-sm">
          <Link href={`/entity/${entity.id}`} className="font-medium text-primary hover:underline">
            {entity.title}
          </Link>
          <ArrowLeft className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">{relation.label ?? relation.type}</span>
        </li>
      ))}
    </ul>
  )
}
