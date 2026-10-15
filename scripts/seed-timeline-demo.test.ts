import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'
import { pathExists } from '@/lib/fs/atomicWrite'
import { getWorldJsonPath } from '@/lib/fs/paths'
import { slugify } from '@/lib/slugify'
import { FileSystemAssetStore } from '@/repositories/filesystem/fileSystemAssetStore'
import { FileSystemWorldRepository } from '@/repositories/filesystem/fileSystemWorldRepository'
import { createWorld } from '@/services/worlds/worldLibrary'

it('cria uma única vez o mundo sintético permanente para teste manual', async () => {
  const root = path.resolve(process.cwd(), 'demo-data')
  process.env.WIKI_WORKSPACE_DIR = root
  await mkdir(root, { recursive: true })
  const name = 'Laboratório da Linha do Tempo'
  if (await pathExists(getWorldJsonPath(slugify(name)))) return

  const world = await createWorld(name, 'Dados sintéticos para testar calendário, cartões, biblioteca, arraste e Desfazer.')
  const repo = new FileSystemWorldRepository()
  const origin = await repo.createOriginEvent(world.id, { type: 'event', title: 'Marco do ano zero', properties: { eventDate: { start: { year: 0, month: 1, day: 1 } } } })
  const ancient = await repo.createEntity(world.id, { type: 'event', title: 'Primeira aliança', properties: { eventDate: { start: { year: -12, month: 4, day: 3 } } } })
  const voyage = await repo.createEntity(world.id, { type: 'event', title: 'Expedição ao vale', properties: { eventDate: { start: { year: 8, month: 6, day: 12 } } } })
  const conflict = await repo.createEntity(world.id, { type: 'event', title: 'Conflito dos portões', properties: { eventDate: { start: { year: 15, month: 2 }, end: { year: 17, month: 9 } } } })
  await repo.createEntity(world.id, { type: 'event', title: 'Registro ISO para conversão', properties: { eventDate: '2024-02-29' } })
  const hero = await repo.createEntity(world.id, { type: 'character', title: 'Lia das Cartas' })
  await repo.createEntity(world.id, { type: 'character', title: 'Noé do Farol' })
  const scholar = await repo.createEntity(world.id, { type: 'character', title: 'Íris, a cronista' })
  const city = await repo.createEntity(world.id, { type: 'location', title: 'Cidade de Bruma' })
  await repo.createEntity(world.id, { type: 'location', title: 'Vale Azul' })
  await repo.createEntity(world.id, { type: 'organization', title: 'Arquivo Solar' })
  await repo.createEntity(world.id, { type: 'artifact', title: 'Bússola de vidro' })
  const removedRecord = await repo.createEntity(world.id, { type: 'document', title: 'Carta arquivada' })
  const timeline = await repo.createEntity(world.id, { type: 'timeline', title: 'Crônica principal' })
  const thematic = await repo.createEntity(world.id, { type: 'timeline', title: 'Viagens e descobertas' })

  const imagePath = path.join(root, 'capa-sintetica.svg')
  await writeFile(imagePath, '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#17324a"/><circle cx="320" cy="180" r="110" fill="#d5aa61"/><path d="M0 300L250 80L640 300" fill="none" stroke="#f4e9cf" stroke-width="30"/></svg>')
  const asset = await new FileSystemAssetStore().importFromPath(world.id, imagePath)
  await repo.updateEntity(world.id, voyage.id, { coverAssetId: asset.id })

  let data = await repo.getTimeline(world.id, timeline.id)
  data = await repo.addTimelineAppearance(world.id, timeline.id, ancient.id, { start: { year: -12, month: 4, day: 3 } }, data.updatedAt)
  data = await repo.addTimelineAppearance(world.id, timeline.id, origin.id, { start: { year: 0, month: 1, day: 1 } }, data.updatedAt)
  data = await repo.addTimelineAppearance(world.id, timeline.id, voyage.id, { start: { year: 8, month: 6, day: 12 } }, data.updatedAt, { title: 'A partida', note: 'Primeira aparição da expedição.', showCover: true })
  data = await repo.addTimelineAppearance(world.id, timeline.id, voyage.id, { start: { year: 9, month: 1 } }, data.updatedAt, { title: 'O retorno', note: 'Mesmo registro, outro cartão e outra data.', showCover: false })
  data = await repo.addTimelineAppearance(world.id, timeline.id, conflict.id, { start: { year: 15, month: 2 }, end: { year: 17, month: 9 } }, data.updatedAt)
  data = await repo.addTimelineAppearance(world.id, timeline.id, hero.id, null, data.updatedAt, { note: 'Item sem data para a seção separada.' })
  data = await repo.addTimelineAppearance(world.id, timeline.id, city.id, { start: { year: -4 } }, data.updatedAt)
  data = await repo.addTimelineAppearance(world.id, timeline.id, removedRecord.id, null, data.updatedAt, { title: 'Carta fora do arquivo', note: 'Alvo na lixeira para testar indisponibilidade.' })
  await repo.deleteEntity(world.id, removedRecord.id)

  let thematicData = await repo.getTimeline(world.id, thematic.id)
  thematicData = await repo.addTimelineAppearance(world.id, thematic.id, voyage.id, { start: { year: 8, month: 6, day: 12 } }, thematicData.updatedAt)
  thematicData = await repo.addTimelineAppearance(world.id, thematic.id, scholar.id, null, thematicData.updatedAt)

  expect(data.appearances).toHaveLength(8)
  expect(thematicData.appearances).toHaveLength(2)
})
