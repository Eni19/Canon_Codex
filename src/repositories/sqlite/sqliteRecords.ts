import 'server-only'
import { z } from 'zod'
import { ContentDocumentSchema, emptyContentDocument, type ContentDocument } from '@/domain/content/contentDocument'
import { EntitySchema, type Entity, type NewEntityInput } from '@/domain/entities/entity'
import { RelationSchema } from '@/domain/relations/relation'
import type { Backlink, EntityListFilter } from '@/repositories/contracts/worldRepository'
import { buildNewEntity } from '@/repositories/filesystem/entityCreation'
import type { SqliteDatabase } from './database'

export interface ArticleSource {
  entity: Entity
  content: ContentDocument
  revision: number
}

const metadataSchema = EntitySchema.omit({ relations: true })

export class SqliteRecords {
  constructor(private readonly db: SqliteDatabase) {}

  get(worldId: string, id: string, includeDeleted = false): Entity | null {
    this.db.requireActiveWorld(worldId)
    const row = this.db.connection.prepare(`
      SELECT id, document FROM entities WHERE world_id = ? AND id = ? AND (deleted_at IS NULL OR ?)
    `).get(worldId, id, Number(includeDeleted))
    return row ? this.decode(worldId, String(row.id), row.document) : null
  }

  list(worldId: string, filter?: EntityListFilter, trashed = false): Entity[] {
    this.db.requireActiveWorld(worldId)
    const rows = this.db.connection.prepare(`
      SELECT id, document FROM entities
      WHERE world_id = ? AND (deleted_at IS NOT NULL) = ? AND (? IS NULL OR type = ?) ORDER BY id
    `).all(worldId, Number(trashed), filter?.type ?? null, filter?.type ?? null)
    return rows.map((row) => this.decode(worldId, String(row.id), row.document))
      .filter((entity) => !filter?.tag || entity.tags.includes(filter.tag))
  }

  create(worldId: string, input: NewEntityInput, content = emptyContentDocument()): Entity {
    return this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      const entity = buildNewEntity(worldId, input)
      this.insert(entity, content, null)
      return entity
    })
  }

  insert(entity: Entity, content: ContentDocument | null, deletedAt: string | null): void {
    const { relations, ...metadata } = EntitySchema.parse(entity)
    this.db.connection.prepare(`
      INSERT INTO entities (world_id, id, type, document, content, deleted_at) VALUES (?, ?, ?, ?, ?, ?)
    `).run(entity.worldId, entity.id, entity.type, JSON.stringify(metadata),
      content ? JSON.stringify(ContentDocumentSchema.parse(content)) : null, deletedAt)
    this.replaceRelations(entity.worldId, entity.id, relations)
  }

  update(entity: Entity, content?: ContentDocument): Entity {
    const { relations, ...metadata } = EntitySchema.parse(entity)
    const serialized = content === undefined ? null : JSON.stringify(ContentDocumentSchema.parse(content))
    this.db.connection.prepare(`
      UPDATE entities SET type = ?, document = ?, content = COALESCE(?, content), revision = revision + 1
      WHERE world_id = ? AND id = ?
    `).run(entity.type, JSON.stringify(metadata), serialized, entity.worldId, entity.id)
    this.replaceRelations(entity.worldId, entity.id, relations)
    return entity
  }

  delete(worldId: string, id: string): void {
    const result = this.db.connection.prepare(`
      UPDATE entities SET deleted_at = ?, revision = revision + 1 WHERE world_id = ? AND id = ? AND deleted_at IS NULL
    `).run(new Date().toISOString(), worldId, id)
    if (!result.changes) throw new Error(`Entity not found: ${id}`)
  }

  getContent(worldId: string, id: string): ContentDocument {
    this.db.requireActiveWorld(worldId)
    const row = this.db.connection.prepare(`
      SELECT content FROM entities WHERE world_id = ? AND id = ? AND deleted_at IS NULL
    `).get(worldId, id)
    return this.decodeContent(row?.content)
  }

  saveContent(worldId: string, id: string, content: ContentDocument): void {
    const parsed = ContentDocumentSchema.parse(content)
    const result = this.db.connection.prepare(`
      UPDATE entities SET content = ?, revision = revision + 1 WHERE world_id = ? AND id = ? AND deleted_at IS NULL
    `).run(JSON.stringify(parsed), worldId, id)
    if (!result.changes) throw new Error(`Entity not found: ${id}`)
  }

  listArticleSources(worldId: string, afterId: string | undefined, limit: number): ArticleSource[] {
    return this.db.read(() => {
      this.db.requireActiveWorld(worldId)
      const after = afterId === undefined ? '' : z.uuid().parse(afterId)
      const count = z.number().int().min(1).max(200).parse(limit)
      return this.db.connection.prepare(`
        SELECT id, document, content, revision FROM entities
        WHERE world_id = ? AND deleted_at IS NULL AND id > ? ORDER BY id LIMIT ?
      `).all(worldId, after, count).map((row) => ({
        entity: this.decode(worldId, String(row.id), row.document),
        content: this.decodeContent(row.content),
        revision: Number(row.revision),
      }))
    })
  }

  getBacklinks(worldId: string, targetId: string): Backlink[] {
    this.db.requireActiveWorld(worldId)
    const rows = this.db.connection.prepare(`
      SELECT source.id, source.document, relation.document AS relation FROM relations relation
      JOIN entities source ON source.world_id = relation.world_id AND source.id = relation.source_id
      WHERE relation.world_id = ? AND relation.target_id = ? AND source.deleted_at IS NULL
      ORDER BY source.id, relation.position
    `).all(worldId, targetId)
    return rows.map((row) => ({
      entity: this.decode(worldId, String(row.id), row.document),
      relation: RelationSchema.parse(JSON.parse(String(row.relation))),
    }))
  }

  private decode(worldId: string, id: string, document: unknown): Entity {
    const metadata = metadataSchema.parse(JSON.parse(String(document)))
    const relations = this.db.connection.prepare(`
      SELECT document FROM relations WHERE world_id = ? AND source_id = ? ORDER BY position
    `).all(worldId, id).map((row) => RelationSchema.parse(JSON.parse(String(row.document))))
    return { ...metadata, relations }
  }

  private decodeContent(document: unknown): ContentDocument {
    return document ? ContentDocumentSchema.parse(JSON.parse(String(document))) : emptyContentDocument()
  }

  private replaceRelations(worldId: string, id: string, relations: Entity['relations']): void {
    this.db.connection.prepare('DELETE FROM relations WHERE world_id = ? AND source_id = ?').run(worldId, id)
    if (!relations.length) return
    const insert = this.db.connection.prepare(`
      INSERT INTO relations (world_id, source_id, id, target_id, position, document) VALUES (?, ?, ?, ?, ?, ?)
    `)
    relations.forEach((relation, index) => {
      if (relation.sourceId !== id) throw new Error('A relação pertence a outro registro.')
      insert.run(worldId, id, relation.id, relation.targetId, index, JSON.stringify(relation))
    })
  }
}
