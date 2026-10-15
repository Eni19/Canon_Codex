import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { it, expect } from 'vitest'
import { emptyContentDocument } from '@/domain/content/contentDocument'
import { createTimelineStressFixture } from './timeline-stress-fixture'

it('gera cenário isolado de 500 aparições para perfil e verificação manual', async () => {
  const root = path.join(tmpdir(), 'canon-timeline-performance-tl11')
  const { world, records, line, timeline } = createTimelineStressFixture()
  const directory = path.join(root, 'worlds', world.slug)
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'world.json'), JSON.stringify(world))
  for (const record of [...records, line]) {
    const folder = path.join(directory, 'entities', record.id)
    await mkdir(folder, { recursive: true })
    await writeFile(path.join(folder, 'metadata.json'), JSON.stringify(record))
    await writeFile(path.join(folder, 'content.json'), JSON.stringify(emptyContentDocument()))
  }
  await writeFile(path.join(directory, 'entities', line.id, 'timeline.json'), JSON.stringify(timeline))
  expect(timeline.appearances).toHaveLength(500)
  console.info(`Synthetic WIKI_WORKSPACE_DIR: ${root}\nRoute: /entity/${line.id}?scale=day`)
})
