import 'server-only'
import type { ZodType } from 'zod'
import { readJsonFile } from '@/lib/fs/atomicWrite'

export type Migration = (data: Record<string, unknown>) => Record<string, unknown>

export interface MigrationRegistry {
  /** The schema version this registry migrates records up to. */
  currentVersion: number
  /** Keyed by the version being migrated *from* (e.g. `1` migrates a v1 record to v2). */
  migrations: Record<number, Migration>
}

/**
 * Applies registered migrations in sequence until the record reaches `currentVersion`.
 * Missing `schemaVersion` is treated as `1` (pre-versioning records never shipped by this app).
 */
export function migrateToLatest(registry: MigrationRegistry, data: Record<string, unknown>): Record<string, unknown> {
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 1
  let migrated = data

  while (version < registry.currentVersion) {
    const migrate = registry.migrations[version]
    if (!migrate) {
      throw new Error(`No migration registered from schema version ${version} (target: ${registry.currentVersion})`)
    }
    migrated = migrate(migrated)
    version += 1
  }

  return migrated
}

/**
 * Reads a JSON file, migrates it to the latest schema version, and validates the result.
 * Throws if the file is missing, unparseable, un-migratable, or fails validation post-migration.
 */
export async function readMigratedJson<T>(
  filePath: string,
  registry: MigrationRegistry,
  schema: ZodType<T>,
): Promise<T> {
  const raw = await readJsonFile<Record<string, unknown>>(filePath)
  const migrated = migrateToLatest(registry, raw)
  return schema.parse(migrated)
}
