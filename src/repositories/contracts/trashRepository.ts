import type { TrashedWorld, TrashItem, TrashItemKind } from '@/domain/trash/trash'
import type { World } from '@/domain/worlds/world'

export interface TrashPurgeSummary {
  worlds: number
  items: number
  assets: number
}

/**
 * Lixeira com prazo (ADR-009). Itens excluídos ficam `TRASH_RETENTION_DAYS` dias restauráveis e
 * depois são apagados de forma definitiva. Só o driver SQLite implementa este contrato.
 */
export interface TrashRepository {
  /** Descarta os vencidos antes de listar, para nunca mostrar um item fora do prazo. */
  listTrash(worldId: string, now?: Date): Promise<TrashItem[]>
  restoreItem(worldId: string, kind: TrashItemKind, id: string, now?: Date): Promise<void>
  /** Apaga o item de forma definitiva e limpa aparições, relações e referências a ele. */
  discardItem(worldId: string, kind: TrashItemKind, id: string): Promise<void>

  listTrashedWorlds(now?: Date): Promise<TrashedWorld[]>
  restoreWorld(worldId: string, now?: Date): Promise<World>
  discardWorld(worldId: string): Promise<void>

  /** Apaga em uma transação tudo o que passou do prazo: mundos, itens e imagens sem uso. */
  purgeExpired(now?: Date): Promise<TrashPurgeSummary>
}
