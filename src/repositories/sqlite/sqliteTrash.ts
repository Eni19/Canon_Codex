import 'server-only'
import { parseGraphSettings } from '@/domain/relations/graphSettings'
import {
  isTrashExpired, trashCutoff, trashExpiresAt, TrashItemKindSchema, type TrashedWorld, type TrashItem, type TrashItemKind,
} from '@/domain/trash/trash'
import { WorldSchema, type World } from '@/domain/worlds/world'
import type { TrashPurgeSummary, TrashRepository } from '@/repositories/contracts/trashRepository'
import type { SqliteDatabase } from './database'
import type { SqliteWorldRepository } from './sqliteWorldRepository'

const TABLES = { entity: 'entities', board: 'boards', scene: 'scenes', playlist: 'playlists' } as const

type TrashRow = { id: string; title: string | null; type: string | null; deleted_at: string }

/** Lixeira com prazo de sete dias sobre as colunas `deleted_at` (ADR-009). */
export class SqliteTrashRepository implements TrashRepository {
  constructor(private readonly db: SqliteDatabase, private readonly worlds: SqliteWorldRepository) {}

  async listTrash(worldId: string, now = new Date()): Promise<TrashItem[]> {
    return this.db.write(() => {
      this.purge(now)
      this.db.requireActiveWorld(worldId)
      const items: TrashItem[] = []
      for (const kind of TrashItemKindSchema.options) {
        const type = kind === 'entity' ? 'type' : 'NULL'
        const rows = this.db.connection.prepare(`
          SELECT id, json_extract(document, '$.title') AS title, ${type} AS type, deleted_at
          FROM ${TABLES[kind]} WHERE world_id = ? AND deleted_at IS NOT NULL
        `).all(worldId) as TrashRow[]
        for (const row of rows) {
          items.push({
            kind, id: row.id, title: row.title || 'Sem título', deletedAt: row.deleted_at, expiresAt: trashExpiresAt(row.deleted_at),
            ...(row.type ? { entityType: row.type } : {}),
          })
        }
      }
      return items.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt) || a.title.localeCompare(b.title, 'pt-BR'))
    })
  }

  async restoreItem(worldId: string, kind: TrashItemKind, id: string, now = new Date()): Promise<void> {
    this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      const table = TABLES[TrashItemKindSchema.parse(kind)]
      const document = kind === 'entity' ? `document || coalesce(content, '')` : 'document'
      const row = this.db.connection.prepare(`SELECT ${document} AS document, deleted_at FROM ${table} WHERE world_id = ? AND id = ? AND deleted_at IS NOT NULL`)
        .get(worldId, id) as { document: string; deleted_at: string } | undefined
      if (!row || isTrashExpired(row.deleted_at, now)) throw new Error('Este item não está mais na lixeira.')
      const revision = kind === 'entity' ? ', revision = revision + 1' : ''
      this.db.connection.prepare(`UPDATE ${table} SET deleted_at = NULL${revision} WHERE world_id = ? AND id = ?`).run(worldId, id)
      // Uma imagem que saiu de uso enquanto o item estava na lixeira volta junto com ele.
      this.db.connection.prepare(`
        UPDATE assets SET deleted_at = NULL WHERE world_id = ? AND deleted_at IS NOT NULL AND instr(?, id) > 0
      `).run(worldId, row.document)
    })
  }

  async discardItem(worldId: string, kind: TrashItemKind, id: string): Promise<void> {
    this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      const table = TABLES[TrashItemKindSchema.parse(kind)]
      if (!this.db.connection.prepare(`SELECT 1 FROM ${table} WHERE world_id = ? AND id = ? AND deleted_at IS NOT NULL`).get(worldId, id)) {
        throw new Error('Este item não está mais na lixeira.')
      }
      this.erase(worldId, kind, id)
      if (kind === 'entity') this.worlds.reconcileLifecycle(worldId)
    })
  }

  async listTrashedWorlds(now = new Date()): Promise<TrashedWorld[]> {
    return this.db.write(() => {
      this.purge(now)
      const rows = this.db.connection.prepare(`
        SELECT id, json_extract(document, '$.name') AS name, deleted_at FROM worlds WHERE deleted_at IS NOT NULL
      `).all() as { id: string; name: string; deleted_at: string }[]
      return rows.map((row) => ({ id: row.id, name: row.name, deletedAt: row.deleted_at, expiresAt: trashExpiresAt(row.deleted_at) }))
        .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt) || a.name.localeCompare(b.name, 'pt-BR'))
    })
  }

  async restoreWorld(worldId: string, now = new Date()): Promise<World> {
    return this.db.write(() => {
      const row = this.db.connection.prepare('SELECT document, deleted_at FROM worlds WHERE id = ? AND deleted_at IS NOT NULL')
        .get(worldId) as { document: string; deleted_at: string } | undefined
      if (!row || isTrashExpired(row.deleted_at, now)) throw new Error('Este Codex não está mais na lixeira.')
      const stored = WorldSchema.parse(JSON.parse(row.document))
      // Outro Codex ativo pode ter ocupado o slug enquanto este estava na lixeira.
      const world = WorldSchema.parse({ ...stored, slug: this.worlds.availableSlug(stored.slug) })
      this.db.connection.prepare('UPDATE worlds SET deleted_at = NULL, slug = ?, document = ? WHERE id = ?')
        .run(world.slug, JSON.stringify(world), world.id)
      return world
    })
  }

  async discardWorld(worldId: string): Promise<void> {
    this.db.write(() => {
      if (!this.db.connection.prepare('SELECT 1 FROM worlds WHERE id = ? AND deleted_at IS NOT NULL').get(worldId)) {
        throw new Error('Este Codex não está mais na lixeira.')
      }
      this.eraseWorld(worldId)
    })
  }

  async purgeExpired(now = new Date()): Promise<TrashPurgeSummary> {
    return this.db.write(() => this.purge(now))
  }

  private purge(now: Date): TrashPurgeSummary {
    const cutoff = trashCutoff(now)
    const summary: TrashPurgeSummary = { worlds: 0, items: 0, assets: 0 }
    for (const { id } of this.db.connection.prepare('SELECT id FROM worlds WHERE deleted_at IS NOT NULL AND deleted_at <= ?').all(cutoff)) {
      this.eraseWorld(String(id))
      summary.worlds += 1
    }
    // Itens de um Codex que está na lixeira esperam o destino do Codex.
    for (const { id: worldId } of this.db.connection.prepare('SELECT id FROM worlds WHERE deleted_at IS NULL').all()) {
      const world = String(worldId)
      let erasedEntity = false
      for (const kind of TrashItemKindSchema.options) {
        const rows = this.db.connection.prepare(`SELECT id FROM ${TABLES[kind]} WHERE world_id = ? AND deleted_at IS NOT NULL AND deleted_at <= ?`)
          .all(world, cutoff)
        for (const { id } of rows) {
          this.erase(world, kind, String(id))
          summary.items += 1
          erasedEntity ||= kind === 'entity'
        }
      }
      if (erasedEntity) this.worlds.reconcileLifecycle(world)
      summary.assets += this.purgeAssets(world, cutoff)
    }
    return summary
  }

  /** Imagens vencidas só são apagadas quando nenhum documento do mundo, nem na lixeira, cita o ID. */
  private purgeAssets(worldId: string, cutoff: string): number {
    const rows = this.db.connection.prepare(`
      SELECT asset.id FROM assets asset WHERE asset.world_id = ? AND asset.deleted_at IS NOT NULL AND asset.deleted_at <= ?
        AND NOT EXISTS (SELECT 1 FROM entities WHERE world_id = asset.world_id AND (instr(document, asset.id) > 0 OR instr(coalesce(content, ''), asset.id) > 0))
        AND NOT EXISTS (SELECT 1 FROM boards WHERE world_id = asset.world_id AND instr(document, asset.id) > 0)
        AND NOT EXISTS (SELECT 1 FROM scenes WHERE world_id = asset.world_id AND instr(document, asset.id) > 0)
        AND NOT EXISTS (SELECT 1 FROM playlists WHERE world_id = asset.world_id AND instr(document, asset.id) > 0)
        AND NOT EXISTS (SELECT 1 FROM worlds WHERE id = asset.world_id AND instr(document, asset.id) > 0)
    `).all(worldId, cutoff)
    for (const { id } of rows) {
      this.db.connection.prepare('DELETE FROM asset_variants WHERE world_id = ? AND asset_id = ?').run(worldId, id)
      this.db.connection.prepare('DELETE FROM assets WHERE world_id = ? AND id = ?').run(worldId, id)
    }
    return rows.length
  }

  private erase(worldId: string, kind: TrashItemKind, id: string): void {
    if (kind !== 'entity') {
      this.db.connection.prepare(`DELETE FROM ${TABLES[kind]} WHERE world_id = ? AND id = ?`).run(worldId, id)
      return
    }
    const connection = this.db.connection
    connection.prepare('DELETE FROM timeline_appearances WHERE world_id = ? AND timeline_id = ?').run(worldId, id)
    connection.prepare('DELETE FROM timelines WHERE world_id = ? AND id = ?').run(worldId, id)
    // Relações de outros registros para este deixam de existir; a revisão avisa a indexação dos artigos.
    connection.prepare(`
      UPDATE entities SET revision = revision + 1 WHERE world_id = ? AND id != ? AND id IN (
        SELECT source_id FROM relations WHERE world_id = ? AND target_id = ?
      )
    `).run(worldId, id, worldId, id)
    connection.prepare('DELETE FROM relations WHERE world_id = ? AND (source_id = ? OR target_id = ?)').run(worldId, id, id)
    connection.prepare('DELETE FROM entities WHERE world_id = ? AND id = ?').run(worldId, id)
    this.forgetGraphPosition(worldId, id)
  }

  private forgetGraphPosition(worldId: string, id: string): void {
    const row = this.db.connection.prepare('SELECT document FROM graph_settings WHERE world_id = ?').get(worldId)
    if (!row) return
    const settings = parseGraphSettings(JSON.parse(String(row.document)))
    const inFolder = settings.folders.some((folder) => folder.members.includes(id))
    if (!(id in settings.positions) && !inFolder) return
    const positions = { ...settings.positions }
    delete positions[id]
    const folders = settings.folders.map((folder) => ({ ...folder, members: folder.members.filter((member) => member !== id) }))
    this.db.connection.prepare('UPDATE graph_settings SET document = ? WHERE world_id = ?')
      .run(JSON.stringify({ ...settings, positions, folders, revision: settings.revision + 1 }), worldId)
  }

  private eraseWorld(worldId: string): void {
    for (const table of [
      'asset_variants', 'assets', 'timeline_appearances', 'timelines', 'relations', 'entities',
      'boards', 'scenes', 'playlists', 'histories', 'graph_settings',
    ]) {
      this.db.connection.prepare(`DELETE FROM ${table} WHERE world_id = ?`).run(worldId)
    }
    this.db.connection.prepare('DELETE FROM worlds WHERE id = ?').run(worldId)
  }
}
