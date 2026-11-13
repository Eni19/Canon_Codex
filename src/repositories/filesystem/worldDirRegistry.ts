import 'server-only'
import { readdir, stat } from 'node:fs/promises'
import { atomicWriteJson, pathExists } from '@/lib/fs/atomicWrite'
import { getWorldJsonPath, getWorldsRootDir } from '@/lib/fs/paths'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import { readMigratedJson } from '@/lib/migrations/registry'
import { WorldSchema, type World } from '@/domain/worlds/world'
import { worldMigrations } from '@/repositories/filesystem/migrations'

/**
 * Resolves the stable `World.id` to its on-disk directory name (today, its slug). Worlds are few,
 * so a linear scan of `world.json` files is simpler than maintaining a separate id->dir index —
 * see ADR-001 for why this is fine to replace later without touching callers.
 */

async function ensureDefaultWorldSeeded(): Promise<void> {
  const rootExists = await pathExists(getWorldsRootDir())
  if (rootExists) return

  const seed = createDefaultWorldSeed()
  await atomicWriteJson(getWorldJsonPath(seed.slug), seed)
}

async function classifyWorldDirs(): Promise<{ available: string[]; missing: string[] }> {
  await ensureDefaultWorldSeeded()
  const entries = await readdir(getWorldsRootDir(), { withFileTypes: true })
  const available: string[] = []
  const missing: string[] = []
  for (const entry of entries.filter((item) => item.isDirectory())) {
    try {
      await stat(getWorldJsonPath(entry.name))
      available.push(entry.name)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      missing.push(entry.name)
    }
  }
  return { available, missing }
}

export async function listWorldDirs(): Promise<string[]> {
  return (await classifyWorldDirs()).available
}

export async function listMissingWorldMetadata(): Promise<string[]> {
  return (await classifyWorldDirs()).missing
}

export async function readWorldByDir(worldDir: string): Promise<World> {
  return readMigratedJson(getWorldJsonPath(worldDir), worldMigrations, WorldSchema)
}

export async function resolveWorldDir(worldId: string): Promise<string> {
  const dirs = await listWorldDirs()
  for (const dir of dirs) {
    const world = await readWorldByDir(dir)
    if (world.id === worldId) return dir
  }
  throw new Error(`World not found: ${worldId}`)
}
