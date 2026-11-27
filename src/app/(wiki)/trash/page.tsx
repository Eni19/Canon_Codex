import { connection } from 'next/server'
import { Clapperboard, LayoutDashboard, Music, Trash2 } from 'lucide-react'
import { discardTrashItemAction, restoreTrashItemAction } from '@/app/actions/trash'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import { TrashItemActions } from '@/components/trash/trash-item-actions'
import { describeTrashRemaining, TRASH_RETENTION_DAYS, type TrashItem } from '@/domain/trash/trash'
import type { World } from '@/domain/worlds/world'
import { getTrashRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })

const KIND_LABELS = { board: 'Quadro', scene: 'Cena', playlist: 'Playlist' } as const

export default async function TrashPage() {
  await connection()
  const world = await getCurrentWorld()
  const trash = getTrashRepository()
  const items = trash ? await trash.listTrash(world.id) : []
  const now = new Date()

  return <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-10">
    <header className="mb-8 flex items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-[0.22em] text-primary uppercase">{world.name}</p>
        <h1 className="font-serif text-4xl font-semibold">Lixeira</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Registros, quadros, cenas e playlists excluídos ficam aqui por {TRASH_RETENTION_DAYS} dias. Depois disso são apagados de vez.
        </p>
      </div>
      <Trash2 className="hidden size-12 text-primary/50 sm:block"/>
    </header>

    {!trash
      ? <p className="rounded-md border border-border bg-card/45 p-5 text-sm text-muted-foreground">
          A lixeira com restauração exige o armazenamento SQLite. Converta a biblioteca com <code>pnpm storage import</code> para usá-la.
        </p>
      : items.length === 0
        ? <div className="grid min-h-60 place-items-center border border-dashed border-border bg-card/25 p-8 text-center">
            <div><Trash2 className="mx-auto mb-4 size-10 text-primary/60"/><h2 className="font-serif text-2xl">A lixeira está vazia</h2></div>
          </div>
        : <ul className="divide-y divide-border border-y border-border">
            {items.map((item) => <li key={`${item.kind}-${item.id}`} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-primary"><KindIcon item={item} world={world}/></span>
                <div className="min-w-0">
                  <p className="text-[0.65rem] tracking-[0.18em] text-primary uppercase">{kindLabel(item, world)}</p>
                  <h2 className="truncate font-serif text-lg">{item.title}</h2>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Excluído em {dateFormat.format(new Date(item.deletedAt))} · <time dateTime={item.expiresAt} title={dateFormat.format(new Date(item.expiresAt))}>{describeTrashRemaining(item.expiresAt, now)}</time>
                  </p>
                </div>
              </div>
              <TrashItemActions
                title={item.title}
                restore={restoreTrashItemAction.bind(null, world.id, item.kind, item.id)}
                discard={discardTrashItemAction.bind(null, world.id, item.kind, item.id)}
              />
            </li>)}
          </ul>}
  </div>
}

function kindLabel(item: TrashItem, world: World): string {
  if (item.kind !== 'entity') return KIND_LABELS[item.kind]
  return world.entityTypes.find((type) => type.id === item.entityType)?.label ?? 'Registro'
}

function KindIcon({ item, world }: { item: TrashItem; world: World }) {
  if (item.kind === 'board') return <LayoutDashboard className="size-4"/>
  if (item.kind === 'scene') return <Clapperboard className="size-4"/>
  if (item.kind === 'playlist') return <Music className="size-4"/>
  const icon = world.entityTypes.find((type) => type.id === item.entityType)?.icon
  return icon ? <EntityTypeIcon name={icon} className="size-4"/> : <Trash2 className="size-4"/>
}
