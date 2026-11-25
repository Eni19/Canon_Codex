import type { SqliteDatabase } from './database'

type Document = { id: string; worldId: string; updatedAt: string }

export class DocumentTable<T extends Document> {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly table: 'boards' | 'scenes' | 'playlists',
    private readonly schema: { parse(value: unknown): T },
  ) {}

  read<R>(worldId: string, operation: () => R): R {
    return this.db.read(() => {
      this.db.requireActiveWorld(worldId)
      return operation()
    })
  }

  write<R>(worldId: string, operation: () => R): R {
    return this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      return operation()
    })
  }

  list(worldId: string): T[] {
    const rows = this.db.connection
      .prepare(`SELECT document FROM ${this.table} WHERE world_id = ? AND deleted_at IS NULL ORDER BY id`)
      .all(worldId) as { document: string }[]
    return rows
      .map(({ document }) => this.schema.parse(JSON.parse(document)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  get(worldId: string, id: string): T | null {
    const row = this.db.connection
      .prepare(`SELECT document FROM ${this.table} WHERE world_id = ? AND id = ? AND deleted_at IS NULL`)
      .get(worldId, id) as { document: string } | undefined
    return row ? this.schema.parse(JSON.parse(row.document)) : null
  }

  insert(value: T): T {
    this.db.connection
      .prepare(`INSERT INTO ${this.table} (world_id, id, document) VALUES (?, ?, ?)`)
      .run(value.worldId, value.id, JSON.stringify(value))
    return value
  }

  update(worldId: string, id: string, value: T): T {
    this.db.connection
      .prepare(`UPDATE ${this.table} SET document = ? WHERE world_id = ? AND id = ? AND deleted_at IS NULL`)
      .run(JSON.stringify(value), worldId, id)
    return value
  }

  delete(worldId: string, id: string): boolean {
    const result = this.db.connection
      .prepare(`UPDATE ${this.table} SET deleted_at = ? WHERE world_id = ? AND id = ? AND deleted_at IS NULL`)
      .run(new Date().toISOString(), worldId, id)
    return Number(result.changes) > 0
  }
}
