import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir, cpus, platform, release } from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { expect, it } from 'vitest'
import { FileSystemWorldRepository } from './fileSystemWorldRepository'

// Explicitly invoked baseline; all fixtures live in a new temporary directory.
it.skipIf(process.env.CALENDAR_BENCH !== '1')('profiles the existing event metadata scan with synthetic records', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'canon-calendar-bench-'))
  const previous = process.env.WIKI_WORKSPACE_DIR
  process.env.WIKI_WORKSPACE_DIR = temporary
  try {
    const repo = new FileSystemWorldRepository()
    const world = (await repo.listWorlds())[0]
    const root = path.join(temporary, 'worlds', world.slug, 'entities')
    const date = new Date().toISOString()
    const results: unknown[] = [{ platform: platform(), release: release(), cpu: cpus()[0]?.model, node: process.version }]
    for (const size of [500, 5000]) {
      for (let base = size === 500 ? 0 : 500; base < size; base += 100) {
        await Promise.all(Array.from({ length: Math.min(100, size - base) }, async (_, offset) => {
          const n = base + offset
          const id = randomUUID()
          const dir = path.join(root, id)
          await mkdir(dir, { recursive: true })
          const entity = { id, worldId: world.id, type: n % 10 === 0 ? 'event' : 'character', title: `Registro sintético ${n}`, slug: `registro-${n}`, aliases: [], tags: [], properties: {}, relations: [], schemaVersion: 4, createdAt: date, updatedAt: date }
          await writeFile(path.join(dir, 'metadata.json'), JSON.stringify(entity))
        }))
      }
      const runs: number[] = []
      for (let i = 0; i < 3; i++) {
        const start = performance.now()
        const entities = await repo.listEntities(world.id, { type: 'event' })
        runs.push(Math.round((performance.now() - start) * 10) / 10)
        expect(entities).toHaveLength(size / 10)
      }
      const agendaRuns: number[] = []
      for (let i = 0; i < 3; i++) {
        const start = performance.now()
        const events = await repo.listCalendarAgenda(world.id)
        agendaRuns.push(Math.round((performance.now() - start) * 10) / 10)
        expect(events).toHaveLength(size / 10)
      }
      results.push({ size, events: size / 10, milliseconds: runs, agendaMilliseconds: agendaRuns })
    }
    if (process.env.CALENDAR_BENCH_OUTPUT) await writeFile(process.env.CALENDAR_BENCH_OUTPUT, JSON.stringify(results, null, 2))
  } finally {
    if (previous === undefined) delete process.env.WIKI_WORKSPACE_DIR
    else process.env.WIKI_WORKSPACE_DIR = previous
    await rm(temporary, { recursive: true, force: true })
  }
}, 180_000)
