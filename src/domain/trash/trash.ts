import { z } from 'zod'

/** Dias que um item fica na lixeira antes do descarte definitivo (ADR-009). */
export const TRASH_RETENTION_DAYS = 7

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

export const TrashItemKindSchema = z.enum(['entity', 'board', 'scene', 'playlist'])
export type TrashItemKind = z.infer<typeof TrashItemKindSchema>

/** Um registro, quadro, cena ou playlist excluído de um mundo ativo. */
export interface TrashItem {
  kind: TrashItemKind
  id: string
  title: string
  /** Tipo do registro; só existe quando `kind` é `entity`. */
  entityType?: string
  deletedAt: string
  expiresAt: string
}

/** Um Codex inteiro excluído da biblioteca. */
export interface TrashedWorld {
  id: string
  name: string
  deletedAt: string
  expiresAt: string
}

/** Momento em que um item excluído em `deletedAt` deixa de poder ser restaurado. */
export function trashExpiresAt(deletedAt: string): string {
  const time = Date.parse(deletedAt)
  if (Number.isNaN(time)) throw new Error(`Data de exclusão inválida: ${deletedAt}`)
  return new Date(time + TRASH_RETENTION_DAYS * DAY).toISOString()
}

/** Itens com `deleted_at` menor ou igual a este instante já venceram o prazo. */
export function trashCutoff(now: Date): string {
  return new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY).toISOString()
}

export function isTrashExpired(deletedAt: string, now: Date): boolean {
  return Date.parse(trashExpiresAt(deletedAt)) <= now.getTime()
}

/** Texto curto do tempo que falta até o descarte definitivo, arredondado para baixo. */
export function describeTrashRemaining(expiresAt: string, now: Date): string {
  const remaining = Date.parse(expiresAt) - now.getTime()
  if (remaining <= 0) return 'Será apagado agora'
  if (remaining < HOUR) return 'Será apagado em menos de 1 hora'
  if (remaining < DAY) {
    const hours = Math.floor(remaining / HOUR)
    return `Será apagado em ${hours} ${hours === 1 ? 'hora' : 'horas'}`
  }
  const days = Math.floor(remaining / DAY)
  return `Será apagado em ${days} ${days === 1 ? 'dia' : 'dias'}`
}
