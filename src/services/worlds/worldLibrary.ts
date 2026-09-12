import 'server-only'

import { cp, readdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import type { World } from '@/domain/worlds/world'
import { atomicWriteJson, ensureDir, pathExists } from '@/lib/fs/atomicWrite'
import { getWorkspaceRoot, getWorldDir, getWorldJsonPath, getWorldsRootDir } from '@/lib/fs/paths'
import { newId } from '@/lib/ids'
import { readMigratedJson } from '@/lib/migrations/registry'
import { slugify } from '@/lib/slugify'
import { getWorldRepository } from '@/repositories'
import { worldMigrations } from '@/repositories/filesystem/migrations'
import { readWorldByDir, resolveWorldDir } from '@/repositories/filesystem/worldDirRegistry'
import { WorldSchema } from '@/domain/worlds/world'

export class WorldImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorldImportError'
  }
}

async function uniqueSlug(base: string): Promise<string> {
  const entries = await readdir(getWorldsRootDir(), { withFileTypes: true }).catch(() => [])
  const used = new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name.toLowerCase()))
  const safeBase = slugify(base) || 'novo-codex'
  if (!used.has(safeBase)) return safeBase
  let suffix = 2
  while (used.has(safeBase + '-' + suffix)) suffix += 1
  return safeBase + '-' + suffix
}

export async function createWorld(name: string, description?: string): Promise<World> {
  const cleanName = name.trim()
  if (!cleanName) throw new Error('Informe um nome para o novo Codex.')
  const slug = await uniqueSlug(cleanName)
  const now = new Date().toISOString()
  const seed = createDefaultWorldSeed()
  const world = WorldSchema.parse({
    ...seed,
    id: newId(),
    slug,
    name: cleanName,
    description: description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  })
  await atomicWriteJson(getWorldJsonPath(slug), world)
  return world
}

async function discoverWorldFolders(sourcePath: string): Promise<string[]> {
  const resolved = path.resolve(sourcePath.replace(/^["']|["']$/g, ''))
  let info
  try { info = await stat(resolved) } catch { throw new WorldImportError('A pasta informada não foi encontrada.') }
  if (!info.isDirectory()) throw new WorldImportError('O caminho precisa apontar para uma pasta.')

  if (await pathExists(path.join(resolved, 'world.json'))) return [resolved]
  const roots = [
    path.join(resolved, 'workspace', 'worlds'),
    path.join(resolved, 'worlds'),
    resolved,
  ]
  for (const root of roots) {
    if (!(await pathExists(root))) continue
    const entries = await readdir(/* turbopackIgnore: true */ root, { withFileTypes: true })
    const folders: string[] = []
    for (const entry of entries) {
      if (entry.isDirectory() && await pathExists(path.join(root, entry.name, 'world.json'))) folders.push(path.join(root, entry.name))
    }
    if (folders.length) return folders
  }
  throw new WorldImportError('Nenhum mundo válido foi encontrado. Escolha uma pasta com world.json ou a raiz de outro Canon Codex.')
}

export async function importWorldsFromFolder(sourcePath: string): Promise<World[]> {
  if (!sourcePath.trim()) throw new WorldImportError('Informe a pasta que deseja carregar.')
  const sources = await discoverWorldFolders(sourcePath)
  const existing = await getWorldRepository().listWorlds()
  const existingIds = new Set(existing.map((world) => world.id))

  const candidates = await Promise.all(sources.map(async (source) => {
    try {
      const world = await readMigratedJson(path.join(source, 'world.json'), worldMigrations, WorldSchema)
      return { source, world }
    } catch {
      throw new WorldImportError('A pasta contém um world.json inválido ou incompatível.')
    }
  }))

  const incomingIds = new Set<string>()
  for (const { world } of candidates) {
    if (existingIds.has(world.id)) throw new WorldImportError('O Codex “' + world.name + '” já está nesta biblioteca.')
    if (incomingIds.has(world.id)) throw new WorldImportError('A pasta contém duas cópias do mesmo Codex.')
    incomingIds.add(world.id)
  }

  const imported: World[] = []
  const createdDirectories: string[] = []
  try {
    for (const { source, world: sourceWorld } of candidates) {
      const slug = await uniqueSlug(sourceWorld.slug || sourceWorld.name)
      const destination = getWorldDir(slug)
      await cp(source, destination, { recursive: true, errorOnExist: true, force: false })
      createdDirectories.push(destination)
      const world = WorldSchema.parse({ ...sourceWorld, slug })
      await atomicWriteJson(getWorldJsonPath(slug), world)
      imported.push(world)
    }
  } catch (error) {
    await Promise.all(createdDirectories.map((directory) => rm(directory, { recursive: true, force: true })))
    if (error instanceof WorldImportError) throw error
    throw new WorldImportError('Não foi possível copiar o Codex para a biblioteca local.')
  }

  if (!imported.length) throw new WorldImportError('Nenhum Codex novo foi importado.')
  return imported
}

export async function renameWorld(worldId: string, name: string): Promise<World> {
  const cleanName = name.trim()
  if (!cleanName) throw new Error('Informe um nome para o Codex.')
  const worldDir = await resolveWorldDir(worldId)
  const current = await readWorldByDir(worldDir)
  const next = WorldSchema.parse({ ...current, name: cleanName, updatedAt: new Date().toISOString() })
  await atomicWriteJson(getWorldJsonPath(worldDir), next)
  return next
}

export async function deleteWorld(worldId: string): Promise<World | null> {
  const worlds = await getWorldRepository().listWorlds()
  const target = worlds.find((world) => world.id === worldId)
  if (!target) throw new Error('Codex não encontrado.')
  const nextWorld = worlds.find((world) => world.id !== worldId) ?? null
  const worldDir = await resolveWorldDir(worldId)
  const source = getWorldDir(worldDir)
  const trash = path.join(getWorkspaceRoot(), 'trash', 'worlds')
  await ensureDir(trash)
  await rename(source, path.join(trash, worldDir + '-' + Date.now()))
  return nextWorld
}
