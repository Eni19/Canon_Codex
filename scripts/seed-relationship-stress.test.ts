import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createRelationshipStressFixture } from './relationship-stress-fixture'

it('creates a fresh synthetic world exclusively under the temporary directory', async () => {
  const configured = process.env.RELATIONSHIP_STRESS_ROOT
  if (!configured) throw new Error('RELATIONSHIP_STRESS_ROOT deve apontar para uma pasta temporária ainda inexistente.')
  const root = path.resolve(configured); const relative = path.relative(path.resolve(tmpdir()), root)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('A pasta de teste precisa estar dentro do diretório temporário.')
  await mkdir(root) // Fails rather than overwriting an existing directory.
  const { world, entities } = createRelationshipStressFixture({ allTypes: process.env.RELATIONSHIP_STRESS_TYPES === 'all' })
  const worldDir = path.join(root, 'worlds', world.slug)
  await mkdir(worldDir, { recursive: true })
  await writeFile(path.join(worldDir, 'world.json'), JSON.stringify(world))
  await Promise.all(entities.map(async (entity) => {
    const directory = path.join(worldDir, 'entities', entity.id)
    await mkdir(directory, { recursive: true })
    await writeFile(path.join(directory, 'metadata.json'), JSON.stringify(entity))
  }))
  expect(entities.reduce((count, entity) => count + entity.relations.length, 0)).toBe(1500)
})
