import { mkdtemp } from 'node:fs/promises'
import { tmpdir, cpus } from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { SqliteDatabase } from '@/repositories/sqlite/database'
import { SqliteWorldRepository } from '@/repositories/sqlite/sqliteWorldRepository'
import { schedulePaletteSearch } from '@/components/wiki/palette-search'
import { searchEntities } from '@/services/search/searchEntities'

it('prepara 1.000 fichas e mede até a entrega da lista ao componente', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'canon-search-perf-'))
  const file = path.join(directory, 'search.sqlite')
  const db = new SqliteDatabase(file)
  const repo = new SqliteWorldRepository(db)
  const world = repo.createWorld('Benchmark CANCOD-26')
  vi.stubEnv('WIKI_WORKSPACE_DIR', directory)
  vi.stubEnv('SQLITE_DATABASE_PATH', file)
  vi.stubEnv('PERSISTENCE_DRIVER', 'sqlite')
  try {
    const titles = ['Aurora', 'Mirante', 'Zafira', 'Quorum']
    for (let i = 0; i < 1000; i++) {
      await repo.createEntity(world.id, { type: 'character', title: titles[i] ?? 'Registro ' + i,
        aliases: i === 2 ? ['Coruja'] : [], tags: i === 3 ? ['lunar'] : [] })
    }
    expect(await repo.listEntities(world.id)).toHaveLength(1000)
    vi.stubGlobal('fetch', async (url: string) => Response.json(
      await searchEntities(world.id, new URL(url, 'http://localhost').searchParams.get('q') ?? '')
    ))
    const times: number[] = []
    for (let round = 0; round <= 10; round++) {
      for (const [i, query] of ['Auorra', 'Mirante', 'Coruja', '#lunar'].entries()) {
        const start = performance.now()
        const result = await new Promise<string>(resolve => schedulePaletteSearch(query, items => resolve(items[0]?.title)))
        const elapsed = performance.now() - start
        expect(result).toBe(titles[i])
        if (round) times.push(elapsed)
      }
    }
    console.info({ directory, cpu: cpus()[0].model, node: process.version,
      callbackP95: times.sort((a, b) => a - b)[Math.ceil(times.length * 0.95) - 1] })
  } finally {
    db.close()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  }
}, 120000)
