import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { WorldSchema } from '@/domain/worlds/world'
import { EntitySchema } from '@/domain/entities/entity'
import { ContentDocumentSchema } from '@/domain/content/contentDocument'
import { TimelineDataSchema } from '@/domain/timelines/timeline'
import { validateCalendarDateValue } from '@/domain/worlds/calendar-date'
import { importWorldsFromFolder } from './worldLibrary'
import { getWorldRepository } from '@/repositories'
import { normalizeTaldoreiEvents } from './normalizeTaldoreiEvents'

const root = path.join(process.cwd(), 'world-packs', 'taldorei-renascido-completo')

describe('Tal’Dorei world pack', () => {
  it('is importable and preserves the extracted text of every PDF page', () => {
    const world = WorldSchema.parse(JSON.parse(readFileSync(path.join(root, 'world.json'), 'utf8')))
    const folders = readdirSync(path.join(root, 'entities'))
    const records = folders.map((folder) => {
      const directory = path.join(root, 'entities', folder)
      return {
        metadata: EntitySchema.parse(JSON.parse(readFileSync(path.join(directory, 'metadata.json'), 'utf8'))),
        content: ContentDocumentSchema.parse(JSON.parse(readFileSync(path.join(directory, 'content.json'), 'utf8'))),
      }
    })
    expect(records).toHaveLength(215)
    expect(world.entityTypes).toHaveLength(17)
    expect(world.entityTypes.every((type) => type.showInSidebar)).toBe(true)
    expect(new Set(records.map(({ metadata }) => metadata.type)).size).toBe(17)
    expect(records.every(({ metadata }) => metadata.worldId === world.id)).toBe(true)
    expect(records.filter(({ metadata }) => metadata.type === 'organization')).toHaveLength(27)
    expect(records.filter(({ metadata }) => metadata.type === 'location' && metadata.properties.locationType === 'Região')).toHaveLength(13)
    const events = records.filter(({ metadata }) => metadata.type === 'event')
    expect(events).toHaveLength(12)
    for (const { metadata, content } of events) {
      expect(validateCalendarDateValue(world.calendar, metadata.properties.eventDate).success).toBe(true)
      expect(metadata.properties.dateBasis).toEqual(expect.any(String))
      expect(content.pages).toHaveLength(1)
    }
    expect(records.find(({ metadata }) => metadata.title === 'Emon')?.metadata.properties.population).toBe('365.026')
    expect(records.find(({ metadata }) => metadata.title === 'Martelo-do-Rochedo')?.metadata.properties.population).toBe('73.550')
    const pdfPages = records.filter(({ metadata }) => metadata.type === 'document')
      .flatMap(({ content }) => content.pages.map((page) => Number(page.id.replace('pagina-', ''))))
    expect(pdfPages.sort((a, b) => a - b)).toEqual(Array.from({ length: 284 }, (_, index) => index + 1))
    const locationIds = new Set(records.filter(({ metadata }) => metadata.type === 'location').map(({ metadata }) => metadata.id))
    const entityIds = new Set(records.map(({ metadata }) => metadata.id))
    expect(records.reduce((count, { metadata }) => count + metadata.relations.length, 0)).toBeGreaterThan(100)
    for (const { metadata } of records) {
      if (metadata.type === 'location' && metadata.properties.parentLocation) {
        expect(locationIds.has(String(metadata.properties.parentLocation))).toBe(true)
      }
      for (const relation of metadata.relations) {
        expect(relation.sourceId).toBe(metadata.id)
        expect(entityIds.has(relation.targetId)).toBe(true)
      }
      const definitions = world.entityTypes.find((type) => type.id === metadata.type)?.properties ?? []
      for (const definition of definitions) {
        const value = metadata.properties[definition.key]
        if (definition.kind === 'reference' && value) expect(entityIds.has(String(value))).toBe(true)
        if (definition.kind === 'referenceList' && Array.isArray(value)) {
          for (const reference of value) expect(entityIds.has(String(reference))).toBe(true)
        }
      }
    }
    const timelines = records.filter(({ metadata }) => metadata.type === 'timeline')
    const eventIds = new Set(events.map(({ metadata }) => metadata.id))
    expect(timelines).toHaveLength(2)
    for (const { metadata } of timelines) {
      const timeline = TimelineDataSchema.parse(JSON.parse(readFileSync(path.join(root, 'entities', metadata.id, 'timeline.json'), 'utf8')))
      expect(timeline.appearances.length).toBeGreaterThan(0)
      for (const appearance of timeline.appearances) {
        expect(entityIds.has(appearance.entityId)).toBe(true)
        if (eventIds.has(appearance.entityId)) expect(appearance.date).not.toBeNull()
        if (appearance.date) expect(validateCalendarDateValue(world.calendar, appearance.date).success).toBe(true)
      }
    }
  })

  it('imports into an isolated synthetic library and opens records and timelines', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'taldorei-pack-test-'))
    const previous = process.env.WIKI_WORKSPACE_DIR
    process.env.WIKI_WORKSPACE_DIR = temporaryRoot
    try {
      const [world] = await importWorldsFromFolder(root)
      const repository = getWorldRepository()
      const records = await repository.listEntities(world.id)
      expect(records).toHaveLength(215)
      const timeline = records.find((record) => record.type === 'timeline' && record.title === 'História de Tal’Dorei')
      expect(timeline).toBeDefined()
      expect((await repository.getTimeline(world.id, timeline!.id)).appearances.length).toBeGreaterThan(0)
      const emon = records.find((record) => record.title === 'Emon')
      expect(emon).toBeDefined()
      expect((await repository.getContent(world.id, emon!.id)).pages.length).toBeGreaterThan(0)

      const foundation = records.find((record) => record.title === 'A Fundação')!
      const foundationTimeline = records.find((record) => record.type === 'timeline' && record.title === 'História de Exandria')!
      const otherProperties = { ...foundation.properties }
      delete otherProperties.eventDate
      delete otherProperties.dateBasis
      await repository.updateEntity(world.id, foundation.id, { properties: otherProperties })
      await repository.saveContent(world.id, foundation.id, {
        format: 'tiptap-json', schemaVersion: 2,
        pages: [
          { id: 'um', title: 'Página um', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Trecho sintético A' }] }] } },
          { id: 'dois', title: 'Página dois', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Trecho sintético B' }] }] } },
        ],
      })
      let timelineData = await repository.getTimeline(world.id, foundationTimeline.id)
      const appearance = timelineData.appearances.find((item) => item.entityId === foundation.id)!
      timelineData = await repository.updateTimelineAppearance(world.id, foundationTimeline.id, appearance.id,
        { title: appearance.title, note: appearance.note, date: null,
          minimumScale: appearance.minimumScale, showCover: appearance.showCover }, timelineData.updatedAt)
      const schism = records.find((record) => record.title === 'A Cisma')!
      await repository.updateEntity(world.id, schism.id, {
        properties: { ...schism.properties, eventDate: { start: { year: -3900, approximate: true } } },
      })
      const conclave = records.find((record) => record.title === 'Conclave Croma em Emon')!
      await repository.updateEntity(world.id, conclave.id, {
        properties: { ...conclave.properties, eventDate: { start: { year: 816, approximate: true } } },
      })
      let talTimeline = await repository.getTimeline(world.id, timeline!.id)
      const oldConclaveAppearance = talTimeline.appearances.find((item) => item.entityId === conclave.id)!
      talTimeline = await repository.updateTimelineAppearance(world.id, timeline!.id, oldConclaveAppearance.id,
        { title: oldConclaveAppearance.title, note: oldConclaveAppearance.note,
          date: { start: { year: 816, approximate: true } }, minimumScale: oldConclaveAppearance.minimumScale,
          showCover: oldConclaveAppearance.showCover }, talTimeline.updatedAt)
      await normalizeTaldoreiEvents(world.id)
      expect((await repository.getEntity(world.id, foundation.id))?.properties.eventDate).toEqual({ start: { year: -5000, approximate: true } })
      expect((await repository.getEntity(world.id, schism.id))?.properties.eventDate).toEqual({ start: { year: -3900, approximate: true } })
      expect((await repository.getEntity(world.id, conclave.id))?.properties.eventDate).toEqual({ start: { year: 810, approximate: true } })
      const normalized = await repository.getContent(world.id, foundation.id)
      expect(normalized.pages).toHaveLength(1)
      expect(JSON.stringify(normalized.pages[0].body)).toContain('Trecho sintético A')
      expect(JSON.stringify(normalized.pages[0].body)).toContain('Trecho sintético B')
      timelineData = await repository.getTimeline(world.id, foundationTimeline.id)
      expect(timelineData.appearances.find((item) => item.entityId === foundation.id)?.date).toEqual({ start: { year: -5000, approximate: true } })
      talTimeline = await repository.getTimeline(world.id, timeline!.id)
      expect(talTimeline.appearances.find((item) => item.entityId === conclave.id)?.date).toEqual({ start: { year: 810, approximate: true } })
    } finally {
      if (previous === undefined) delete process.env.WIKI_WORKSPACE_DIR
      else process.env.WIKI_WORKSPACE_DIR = previous
      if (!path.resolve(temporaryRoot).startsWith(path.resolve(tmpdir()) + path.sep)) throw new Error('Diretório temporário inesperado.')
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  }, 20_000)
})
