import 'server-only'

import type { ContentDocument } from '@/domain/content/contentDocument'
import type { CalendarDateValue } from '@/domain/worlds/calendar-date'
import { getWorldRepository } from '@/repositories'

export const TALDOREI_COMPLETE_WORLD_ID = '3c421d4a-a1f0-4da8-a047-184617200836'

const eventYears: Record<string, { year: number; estimated: boolean }> = {
  'A Fundação': { year: -5000, estimated: true },
  'A Cisma': { year: -4000, estimated: true },
  'Era do Arcanum': { year: -1200, estimated: true },
  'A Calamidade': { year: -100, estimated: true },
  'A Divergência': { year: 0, estimated: false },
  'Guerra Dispersa': { year: 500, estimated: true },
  'Ascensão de Zan Tal’Dorei': { year: 510, estimated: true },
  'Fim da monarquia de Tal’Dorei': { year: 810, estimated: true },
  'Conclave Croma em Emon': { year: 810, estimated: true },
  'Ascensão e derrota d’O Sussurrado': { year: 812, estimated: true },
  'Tal’Dorei em 836 P.D.': { year: 836, estimated: false },
  'Despertar dos serpentinos Vos’skyriss': { year: 836, estimated: true },
}

function expectedDate(title: string): CalendarDateValue | undefined {
  const value = eventYears[title]
  if (!value) return undefined
  return { start: { year: value.year, ...(value.estimated ? { approximate: true } : {}) } }
}

function isOldConclaveDate(title: string, value: unknown): boolean {
  if (title !== 'Conclave Croma em Emon' || !value || typeof value !== 'object') return false
  const start = (value as { start?: { year?: number; approximate?: boolean } }).start
  return start?.year === 816 && start.approximate === true
}

function mergeDetails(document: ContentDocument): ContentDocument | null {
  if (document.pages.length <= 1) return null
  const blocks: unknown[] = []
  for (const page of document.pages) {
    if (!page.body || typeof page.body !== 'object') return null
    const body = page.body as { type?: unknown; content?: unknown }
    if (body.type !== 'doc' || !Array.isArray(body.content)) return null
    blocks.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: page.title }] })
    blocks.push(...body.content)
  }
  return {
    ...document,
    pages: [{ id: 'principal', title: 'Principal', body: { type: 'doc', content: blocks } }],
  }
}

/** Reopen-time upgrade of the bundled atlas. Existing custom dates are kept. */
export async function normalizeTaldoreiEvents(worldId: string): Promise<void> {
  if (worldId !== TALDOREI_COMPLETE_WORLD_ID) return
  const repository = getWorldRepository()
  const events = await repository.listEntities(worldId, { type: 'event' })
  const eventById = new Map(events.map((event) => [event.id, event]))
  for (const event of events) {
    const suggested = expectedDate(event.title)
    if (!suggested) continue
    const shouldSetDate = !event.properties.eventDate || isOldConclaveDate(event.title, event.properties.eventDate)
    const shouldSetBasis = !event.properties.dateBasis
    if (shouldSetDate || shouldSetBasis) {
      const basis = eventYears[event.title].estimated
        ? 'Ano estimado para ordenar a linha do tempo; o livro não informa um ano exato para este evento.'
        : 'Ano indicado pela cronologia do livro.'
      const updated = await repository.updateEntity(worldId, event.id, {
        properties: { ...event.properties, ...(shouldSetDate ? { eventDate: suggested } : {}),
          ...(shouldSetBasis ? { dateBasis: basis } : {}) },
        expectedUpdatedAt: event.updatedAt,
      })
      eventById.set(event.id, updated)
    }
    const document = await repository.getContent(worldId, event.id)
    const merged = mergeDetails(document)
    if (merged) await repository.saveContent(worldId, event.id, merged)
  }
  const timelines = await repository.listEntities(worldId, { type: 'timeline' })
  for (const record of timelines) {
    let timeline = await repository.getTimeline(worldId, record.id)
    for (const appearance of timeline.appearances) {
      const event = eventById.get(appearance.entityId)
      if (!event) continue
      const date = event.properties.eventDate as CalendarDateValue | undefined
      if (!date || appearance.date && !isOldConclaveDate(event.title, appearance.date)) continue
      timeline = await repository.updateTimelineAppearance(worldId, record.id, appearance.id,
        { title: appearance.title, note: appearance.note, date,
          minimumScale: appearance.minimumScale, showCover: appearance.showCover }, timeline.updatedAt)
    }
  }
}
