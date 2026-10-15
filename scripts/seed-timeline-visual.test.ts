import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { it, expect } from 'vitest'
import sharp from 'sharp'
import { emptyContentDocument } from '@/domain/content/contentDocument'
import { FileSystemWorldRepository } from '@/repositories/filesystem/fileSystemWorldRepository'
import { FileSystemAssetStore } from '@/repositories/filesystem/fileSystemAssetStore'
import { createTimelineStressFixture } from './timeline-stress-fixture'

// Opt-in fixture. Never reads or copies the user's private data or existing demo world.
it('prepara 500 aparições e estados editoriais para a verificação visual TL-12', async () => {
  const temporaryRoot = path.resolve(tmpdir())
  const root = path.resolve(temporaryRoot, 'canon-timeline-visual-tl12')
  if (path.dirname(root) !== temporaryRoot || path.basename(root) !== 'canon-timeline-visual-tl12') throw new Error('Destino sintético inválido')
  await rm(root, { recursive: true, force: true })
  process.env.WIKI_WORKSPACE_DIR = root
  const { world, records, line, timeline } = createTimelineStressFixture()
  world.name = 'Atlas das eras · laboratório sintético'
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
  const repo = new FileSystemWorldRepository()
  const editorial = await repo.createEntity(world.id, { type: 'timeline', title: 'Crônica das Marés' })
  const empty = await repo.createEntity(world.id, { type: 'timeline', title: 'Uma história por escrever' })
  const undated = await repo.createEntity(world.id, { type: 'timeline', title: 'Fragmentos sem data' })
  const image = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="400"><rect width="960" height="400" fill="#253139"/><circle cx="705" cy="125" r="65" fill="#d8b773"/><path d="M0 310L210 90L410 310L590 165L850 360L960 250V400H0Z" fill="#3e5556"/><path d="M0 350Q270 290 500 360T960 340V400H0Z" fill="#16272d"/><path d="M0 376Q310 330 600 380T960 370" stroke="#d8b773" fill="none" opacity=".4"/></svg>')).png().toBuffer()
  const cover = await new FileSystemAssetStore().importFromBuffer(world.id, image, 'paisagem-sintetica.png', 'image/png')
  const definitions = [
    { type: 'event', title: 'O primeiro farol', year: -12, note: 'À beira do mar desconhecido, uma luz inaugurou a era das travessias.', cover: true },
    { type: 'event', title: 'O pacto das marés', year: 0, note: 'O ano zero: as cidades do litoral passaram a contar uma história em comum.' },
    { type: 'character', title: 'A cartógrafa do horizonte', year: 8, note: 'Mapas, relatos e uma promessa de regressar. Um mesmo período pode guardar muitas vozes.' },
    { type: 'event', title: 'A partida para o arquipélago', year: 8, note: 'Três embarcações deixaram o porto na mesma manhã.', cover: true },
    { type: 'event', title: 'Os anos de céu aberto', year: 9, note: 'Uma travessia de vários anos, registrada como intervalo aproximado.', interval: true },
    { type: 'document', title: 'Carta de um porto distante', year: 10, note: 'O cartão conserva sua nota e data mesmo quando o registro está na lixeira.', trash: true },
    { type: 'location', title: 'A ilha que ainda não tem nome', year: null, note: 'Um lugar lembrado nas cartas, ainda sem posição na cronologia.' },
  ]
  let data = await repo.getTimeline(world.id, editorial.id)
  for (const item of definitions) {
    const record = await repo.createEntity(world.id, { type: item.type, title: item.title })
    if (item.cover) await repo.updateEntity(world.id, record.id, { coverAssetId: cover.id })
    const date = item.year === null ? null : { start: { year: item.year, month: 3, day: 4, ...(item.interval ? { approximate: true } : {}) }, ...(item.interval ? { end: { year: 12, month: 3, day: 4 } } : {}) }
    data = await repo.addTimelineAppearance(world.id, editorial.id, record.id, date, data.updatedAt, { note: item.note, minimumScale: 'century', showCover: Boolean(item.cover) })
    if (item.trash) await repo.deleteEntity(world.id, record.id)
  }
  let undatedData = await repo.getTimeline(world.id, undated.id)
  undatedData = await repo.addTimelineAppearance(world.id, undated.id, records[0].id, null, undatedData.updatedAt, { note: 'Uma lembrança ainda sem data.' })
  expect(undatedData.appearances).toHaveLength(1)
  expect(timeline.appearances).toHaveLength(500)
  expect(data.appearances).toHaveLength(7)
  const routes = { root, performance: line.id, editorial: editorial.id, empty: empty.id, undated: undated.id }
  await writeFile(path.join(root, 'tl12-routes.json'), JSON.stringify(routes, null, 2))
  console.info(JSON.stringify(routes))
}, 30000)
