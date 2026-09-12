import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import { getWorldRepository } from '@/repositories'
import { createWorld, deleteWorld, importWorldsFromFolder, renameWorld, WorldImportError } from './worldLibrary'

describe('world library', () => {
  let workspaceDir: string
  let externalRoot: string

  beforeEach(async () => {
    workspaceDir = await mkdtemp(path.join(tmpdir(), 'codex-library-'))
    externalRoot = await mkdtemp(path.join(tmpdir(), 'external-codex-'))
    process.env.WIKI_WORKSPACE_DIR = workspaceDir
    await getWorldRepository().listWorlds()
  })

  afterEach(async () => {
    delete process.env.WIKI_WORKSPACE_DIR
    await Promise.all([
      rm(workspaceDir, { recursive: true, force: true }),
      rm(externalRoot, { recursive: true, force: true }),
    ])
  })

  it('creates an isolated world with the default entity catalog', async () => {
    const created = await createWorld('Novo Universo', 'Arquivo independente')
    const worlds = await getWorldRepository().listWorlds()
    expect(worlds).toHaveLength(2)
    expect(created).toMatchObject({ name: 'Novo Universo', slug: 'novo-universo', description: 'Arquivo independente' })
    expect(created.entityTypes.some((type) => type.id === 'character')).toBe(true)
  })

  it('renames a world without changing its identity or folder', async () => {
    const created = await createWorld('Nome Inicial')

    const renamed = await renameWorld(created.id, 'Arquivo Renomeado')

    expect(renamed).toMatchObject({ id: created.id, slug: created.slug, name: 'Arquivo Renomeado' })
    const stored = (await getWorldRepository().listWorlds()).find((world) => world.id === created.id)
    expect(stored?.name).toBe('Arquivo Renomeado')
  })

  it('moves a deleted world to the internal trash and keeps another world available', async () => {
    const created = await createWorld('Temporário')

    const nextWorld = await deleteWorld(created.id)

    expect(nextWorld?.id).not.toBe(created.id)
    expect((await getWorldRepository().listWorlds()).some((world) => world.id === created.id)).toBe(false)
    const trashEntries = await readdir(path.join(workspaceDir, 'trash', 'worlds'))
    expect(trashEntries.some((entry) => entry.startsWith(created.slug + '-'))).toBe(true)
  })

  it('allows the library to stay empty after deleting its only world', async () => {
    const [onlyWorld] = await getWorldRepository().listWorlds()

    const nextWorld = await deleteWorld(onlyWorld.id)

    expect(nextWorld).toBeNull()
    expect(await getWorldRepository().listWorlds()).toEqual([])
  })
  it('imports every world from another Canon Codex root', async () => {
    const sourceDir = path.join(externalRoot, 'workspace', 'worlds', 'importado')
    await mkdir(sourceDir, { recursive: true })
    const seed = createDefaultWorldSeed()
    const external = { ...seed, id: crypto.randomUUID(), slug: 'importado', name: 'Arquivo Importado' }
    await writeFile(path.join(sourceDir, 'world.json'), JSON.stringify(external), 'utf8')

    const imported = await importWorldsFromFolder(externalRoot)

    expect(imported).toHaveLength(1)
    expect(imported[0].name).toBe('Arquivo Importado')
    expect((await getWorldRepository().listWorlds()).some((world) => world.id === external.id)).toBe(true)
  })

  it('rejects a second import of the same world identity', async () => {
    const sourceDir = path.join(externalRoot, 'mundo')
    await mkdir(sourceDir, { recursive: true })
    const external = { ...createDefaultWorldSeed(), id: crypto.randomUUID(), slug: 'externo', name: 'Externo' }
    await writeFile(path.join(sourceDir, 'world.json'), JSON.stringify(external), 'utf8')
    await importWorldsFromFolder(sourceDir)

    await expect(importWorldsFromFolder(sourceDir)).rejects.toThrow(WorldImportError)
  })
})
