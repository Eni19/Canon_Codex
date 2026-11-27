import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import type { WorldRepository } from '@/repositories/contracts/worldRepository'
import { FileSystemWorldRepository } from '@/repositories/filesystem/fileSystemWorldRepository'
import { SqliteDatabase } from '@/repositories/sqlite/database'
import { SqliteWorldRepository } from '@/repositories/sqlite/sqliteWorldRepository'
import { GET } from './route'

let repo: WorldRepository
let worldId: string
vi.mock('@/repositories', () => ({ getWorldRepository: () => repo }))
vi.mock('@/services/worlds/getCurrentWorld', () => ({ getCurrentWorld: () => ({ id: worldId }) }))

async function search(title: string) {
  const response = await GET(new Request('http://localhost/api/entities/search?q=' + title))
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  return response.json()
}

it('combina texto, tipo e etiqueta inteira no mundo ativo antes do limite', async () => {
  const db = new SqliteDatabase(':memory:')
  try {
    const sqlite = new SqliteWorldRepository(db)
    repo = sqlite
    worldId = sqlite.createWorld('Mundo ativo').id
    const otherWorld = sqlite.createWorld('Outro mundo').id
    await repo.createEntity(otherWorld, { type: 'location', title: 'Aurora', tags: ['capital'] })
    await repo.createEntity(worldId, { type: 'character', title: 'Aurora', tags: ['capital'] })
    await repo.createEntity(worldId, { type: 'location', title: 'Aurora', tags: ['capital histórica'] })
    await repo.createEntity(worldId, { type: 'location', title: 'Mirante', tags: ['capital'] })
    const expected = await repo.createEntity(worldId, { type: 'location', title: 'Cidade de Aurora', tags: ['Capital'] })

    const url = 'http://localhost/api/entities/search?q=Aurora&type=location&tag=CAPITAL'
    for (const suffix of ['', '&limit=1']) {
      const response = await GET(new Request(url + suffix))
      expect(await response.json()).toMatchObject([{ id: expected.id }])
    }
  } finally {
    db.close()
  }
})

it.each(['filesystem', 'sqlite'])('reflete cada alteração na consulta seguinte com %s', async driver => {
  const directory = await mkdtemp(path.join(tmpdir(), 'canon-search-'))
  vi.stubEnv('WIKI_WORKSPACE_DIR', directory)
  let db: SqliteDatabase | undefined
  try {
    if (driver === 'sqlite') {
      db = new SqliteDatabase(path.join(directory, 'test.sqlite'))
      const sqlite = new SqliteWorldRepository(db)
      worldId = sqlite.createWorld('Teste').id
      repo = sqlite
    } else {
      repo = new FileSystemWorldRepository()
      worldId = (await repo.listWorlds())[0].id
    }
    expect(await search('Zafira')).toEqual([])
    const entity = await repo.createEntity(worldId, { type: 'character', title: 'Zafira' })
    expect(await search('Zafira')).toMatchObject([{ id: entity.id, title: 'Zafira' }])
    expect(await search('Quorum')).toEqual([])
    await repo.updateEntity(worldId, entity.id, { title: 'Quorum' })
    expect(await search('Quorum')).toMatchObject([{ id: entity.id, title: 'Quorum' }])
    expect(await search('Zafira')).toEqual([])
    await repo.deleteEntity(worldId, entity.id)
    expect(await search('Quorum')).toEqual([])
  } finally {
    db?.close()
    vi.unstubAllEnvs()
    await rm(directory, { recursive: true, force: true })
  }
})
