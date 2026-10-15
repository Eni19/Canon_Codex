'use server'

import { revalidatePath } from 'next/cache'
import { CalendarDateValueSchema, type CalendarDateValue } from '@/domain/worlds/calendar-date'
import { TimelineAppearanceFieldsSchema, TimelineAppearanceSchema, TimelineScaleSchema, type TimelineAppearance, type TimelineAppearanceFields } from '@/domain/timelines/timeline'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export type AddTimelineAppearanceState = { error?: string; saved?: boolean; entityId?: string }

function parseDate(formData: FormData, key: string): CalendarDateValue | null {
  const raw = formData.get(key)
  if (typeof raw !== 'string' || !raw.trim()) return null
  return CalendarDateValueSchema.parse(JSON.parse(raw))
}

function parseFields(formData: FormData, date: CalendarDateValue | null): TimelineAppearanceFields {
  const title = String(formData.get('appearanceTitle') ?? '').trim() || null
  const note = String(formData.get('appearanceNote') ?? '').trim() || null
  const rawScale = String(formData.get('minimumScale') ?? '')
  return TimelineAppearanceFieldsSchema.parse({ title, note, date,
    minimumScale: rawScale ? TimelineScaleSchema.parse(rawScale) : null, showCover: formData.get('showCover') === 'yes' })
}

export async function addTimelineAppearanceAction(_: AddTimelineAppearanceState, formData: FormData): Promise<AddTimelineAppearanceState> {
  const world = await getCurrentWorld()
  if (formData.get('worldId') !== world.id) return { error: 'O mundo ativo mudou. Reabra a linha do tempo.' }
  const timelineId = formData.get('timelineId')
  const entityId = formData.get('entityId')
  const expectedUpdatedAt = formData.get('expectedUpdatedAt')
  if (typeof timelineId !== 'string' || typeof entityId !== 'string' || typeof expectedUpdatedAt !== 'string') {
    return { error: 'A Linha do Tempo ou o registro não foi identificado.' }
  }
  try {
    const fields = parseFields(formData, parseDate(formData, 'appearanceDate'))
    const { date, ...presentation } = fields
    await getWorldRepository().addTimelineAppearance(world.id, timelineId, entityId, date, expectedUpdatedAt, presentation)
    revalidatePath(`/entity/${timelineId}`)
    return { saved: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível incluir o registro.' }
  }
}

export async function updateTimelineAppearanceAction(_: AddTimelineAppearanceState, formData: FormData): Promise<AddTimelineAppearanceState> {
  const world = await getCurrentWorld()
  if (formData.get('worldId') !== world.id) return { error: 'O mundo ativo mudou. Reabra a linha do tempo.' }
  const timelineId = formData.get('timelineId')
  const appearanceId = formData.get('appearanceId')
  const expectedUpdatedAt = formData.get('expectedUpdatedAt')
  if (typeof timelineId !== 'string' || typeof appearanceId !== 'string' || typeof expectedUpdatedAt !== 'string') return { error: 'A aparição não foi identificada.' }
  try {
    const fields = parseFields(formData, parseDate(formData, `appearanceDate_${appearanceId}`))
    await getWorldRepository().updateTimelineAppearance(world.id, timelineId, appearanceId, fields, expectedUpdatedAt)
    revalidatePath(`/entity/${timelineId}`)
    return { saved: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível salvar o cartão.' }
  }
}

export async function createTimelineEventAction(_: AddTimelineAppearanceState, formData: FormData): Promise<AddTimelineAppearanceState & { entityId?: string }> {
  const world = await getCurrentWorld()
  if (formData.get('worldId') !== world.id) return { error: 'O mundo ativo mudou. Reabra a linha do tempo.' }
  const timelineId = formData.get('timelineId')
  const expectedUpdatedAt = formData.get('expectedUpdatedAt')
  const title = formData.get('title')
  if (typeof timelineId !== 'string' || typeof expectedUpdatedAt !== 'string' || typeof title !== 'string') return { error: 'Preencha o título do Evento.' }
  try {
    const date = parseDate(formData, 'quickEventDate')
    if (!date) return { error: 'Informe a data do Evento.' }
    const { entity } = await getWorldRepository().createTimelineEvent(world.id, timelineId, title, date, expectedUpdatedAt)
    revalidatePath(`/entity/${timelineId}`)
    revalidatePath('/event')
    revalidatePath('/all')
    return { saved: true, entityId: entity.id }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível criar o Evento.' }
  }
}

async function requireActiveWorld(worldId: string): Promise<void> {
  if ((await getCurrentWorld()).id !== worldId) throw new Error('O mundo ativo mudou. Reabra a linha do tempo.')
}

export async function addAllTimelineAppearancesAction(worldId: string, timelineId: string, expectedUpdatedAt: string): Promise<{ added: number }> {
  await requireActiveWorld(worldId)
  const result = await getWorldRepository().addAllTimelineAppearances(worldId, timelineId, expectedUpdatedAt)
  revalidatePath(`/entity/${timelineId}`)
  return { added: result.added }
}

export async function removeTimelineAppearanceAction(worldId: string, timelineId: string, appearanceId: string, expectedUpdatedAt: string): Promise<{ removed: TimelineAppearance; index: number; updatedAt: string }> {
  await requireActiveWorld(worldId)
  const result = await getWorldRepository().removeTimelineAppearance(worldId, timelineId, appearanceId, expectedUpdatedAt)
  revalidatePath(`/entity/${timelineId}`)
  return { removed: result.removed, index: result.index, updatedAt: result.timeline.updatedAt }
}

export async function restoreTimelineAppearanceAction(worldId: string, timelineId: string, input: TimelineAppearance, index: number, expectedUpdatedAt: string): Promise<void> {
  await requireActiveWorld(worldId)
  const appearance = TimelineAppearanceSchema.parse(input)
  await getWorldRepository().restoreTimelineAppearance(worldId, timelineId, appearance, index, expectedUpdatedAt)
  revalidatePath(`/entity/${timelineId}`)
}
