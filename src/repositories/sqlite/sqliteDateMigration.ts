import 'server-only'

import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import type { Entity } from '@/domain/entities/entity'
import type { DateMigrationPreview } from '@/domain/worlds/dateMigration'
import type { World } from '@/domain/worlds/world'
import {
  parseDateMigrationSnapshots,
  planDateMigration,
  validateDateMigrationManifest,
  type DateMigrationManifest,
} from '@/repositories/filesystem/dateMigration'
import type { SqliteDatabase } from './database'
import type { SqliteRecords } from './sqliteRecords'

function recordPath(entityId: string, deletedAt: string | null): string {
  const directory = deletedAt === null ? `entities/${entityId}` : `trash/entity-${entityId}-${Date.parse(deletedAt)}`
  return `${directory}/metadata.json`
}

function pending(history: DateMigrationManifest[]): DateMigrationManifest | undefined {
  return history.find(({ state }) => state === 'applying' || state === 'restoring')
}

export class SqliteDateMigration {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly records: SqliteRecords,
    private readonly readWorld: (id: string) => World,
  ) {}

  async previewDateMigration(worldId: string): Promise<DateMigrationPreview> {
    return this.db.read(() => {
      const { preview } = this.plan(worldId)
      const history = this.histories(worldId)
      const unfinished = pending(history)
      const latest = history.at(-1)
      return {
        ...preview,
        ...(unfinished ? { recovery: { id: unfinished.id, state: unfinished.state } } : {}),
        ...(latest ? { latestBackup: { id: latest.id, state: latest.state } } : {}),
      }
    })
  }

  async startDateMigration(worldId: string, expectedFingerprint: string): Promise<string> {
    return this.db.write(() => {
      const { preview, completionFingerprint, entries } = this.plan(worldId)
      if (preview.fingerprint !== expectedFingerprint) throw new Error('Os dados mudaram desde a prévia. Atualize a página e revise novamente.')
      if (pending(this.histories(worldId))) throw new Error('Existe uma conversão interrompida. Retome ou restaure antes de começar outra.')
      if (!entries.length) throw new Error('Não há datas conversíveis neste mundo.')
      const { total, convertible, invalid, examples, problems } = preview
      const manifest = validateDateMigrationManifest({
        schemaVersion: 1, id: randomUUID(), worldId, createdAt: new Date().toISOString(), state: 'completed', entries,
        sourceFingerprint: preview.fingerprint, completionFingerprint,
        report: { total, convertible, invalid, examples, problems },
      })
      for (const entry of manifest.entries) this.records.update(parseDateMigrationSnapshots(entry).converted)
      this.db.connection.prepare("INSERT INTO histories (world_id, kind, id, document) VALUES (?, 'date', ?, ?)")
        .run(worldId, manifest.id, JSON.stringify(manifest))
      return manifest.id
    })
  }

  async recoverDateMigration(worldId: string, id: string, restore: boolean): Promise<void> {
    this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      const row = this.db.connection.prepare("SELECT document FROM histories WHERE world_id = ? AND kind = 'date' AND id = ?")
        .get(worldId, z.uuid().parse(id))
      if (!row) throw new Error('Backup da conversão não encontrado.')
      const document = JSON.parse(String(row.document)) as Record<string, unknown>
      const manifest = this.manifest(worldId, id, document)
      if ((restore && manifest.state === 'restored') || (!restore && manifest.state === 'completed')) return
      if (!restore && manifest.state === 'restoring') throw new Error('A restauração já começou; conclua-a primeiro.')
      const deletedAt = this.deletionTimes(worldId)
      for (const entry of manifest.entries) {
        const { original, converted } = parseDateMigrationSnapshots(entry)
        const current = this.records.get(worldId, original.id, true)
        const location = deletedAt.get(original.id)
        const expected = manifest.state === 'completed' ? converted : original
        const transitioning = manifest.state === 'applying' || manifest.state === 'restoring'
        if (!current || location === undefined || recordPath(original.id, location) !== entry.relativePath.replaceAll('\\', '/')
          || (!isDeepStrictEqual(current, expected) && !(transitioning && isDeepStrictEqual(current, converted)))) {
          throw new Error(`O registro ${entry.relativePath} mudou após a prévia. Revise a alteração antes de retomar ou restaurar.`)
        }
        const wanted = restore ? original : converted
        if (!isDeepStrictEqual(current, wanted)) this.records.update(wanted)
      }
      this.db.connection.prepare("UPDATE histories SET document = ? WHERE world_id = ? AND kind = 'date' AND id = ?")
        .run(JSON.stringify({ ...document, state: restore ? 'restored' : 'completed' }), worldId, id)
    })
  }

  private plan(worldId: string) {
    const world = this.readWorld(worldId)
    const deletedAt = this.deletionTimes(worldId)
    const entry = (entity: Entity, trashed: boolean) => ({
      relativePath: recordPath(entity.id, deletedAt.get(entity.id) ?? null),
      text: JSON.stringify(entity, null, 2),
      entity,
      trashed,
    })
    const records = [
      ...this.records.list(worldId).map((entity) => entry(entity, false)),
      ...this.records.list(worldId, undefined, true).map((entity) => entry(entity, true)),
    ]
    return planDateMigration(world, records)
  }

  private deletionTimes(worldId: string): Map<string, string | null> {
    return new Map(this.db.connection.prepare('SELECT id, deleted_at FROM entities WHERE world_id = ?').all(worldId)
      .map((row) => [String(row.id), row.deleted_at === null ? null : String(row.deleted_at)]))
  }

  private histories(worldId: string): DateMigrationManifest[] {
    return this.db.connection.prepare("SELECT id, document FROM histories WHERE world_id = ? AND kind = 'date' ORDER BY id")
      .all(worldId)
      .map((row) => this.manifest(worldId, String(row.id), JSON.parse(String(row.document))))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  private manifest(worldId: string, id: string, document: unknown): DateMigrationManifest {
    const manifest = validateDateMigrationManifest(document)
    if (manifest.worldId !== worldId || manifest.id !== id) throw new Error('O backup não corresponde ao mundo ou identificador.')
    return manifest
  }
}
