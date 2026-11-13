'use server'

import { revalidatePath } from 'next/cache'
import { CalendarSchema } from '@/domain/worlds/calendar'
import { CalendarMoonsSchema } from '@/domain/worlds/calendar-moon'
import { CalendarSeasonsSchema } from '@/domain/worlds/calendar-season'
import { CalendarLandmarksSchema } from '@/domain/worlds/calendar-landmarks'
import { CalendarAppearanceSchema } from '@/domain/worlds/calendar-appearance'
import { CalendarExactDateSchema, exactDateAtOrdinal, exactDateToOrdinal } from '@/domain/worlds/calendar-exact-date'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export type CalendarActionState = {
  error?: string
  saved?: boolean
  savedMoons?: string
  savedSeasons?: string
  savedLandmarks?: string
  savedAppearance?: string
}

export async function updateCampaignTodayAction(_: CalendarActionState, formData: FormData): Promise<CalendarActionState> {
  const worldId = formData.get('worldId')
  const expectedToday = formData.get('expectedToday')
  const expectedCalendar = formData.get('expectedCalendar')
  const operation = formData.get('operation')
  const rawDate = formData.get('date')
  if (typeof worldId !== 'string' || typeof expectedToday !== 'string' || typeof expectedCalendar !== 'string' || typeof rawDate !== 'string' || (operation !== 'set' && operation !== 'advance')) return { error: 'Dados da data da campanha incompletos.' }
  try {
    const world = await getCurrentWorld()
    if (world.id !== worldId) return { error: 'O mundo ativo mudou. Reabra o calendário do mundo que deseja editar.' }
    const date = CalendarExactDateSchema.parse(JSON.parse(rawDate))
    if (operation === 'advance' && (!world.campaignToday || JSON.stringify(world.campaignToday) !== expectedToday)) return { error: 'A data da campanha mudou. Recarregue a página antes de avançar.' }
    const next = operation === 'advance' ? exactDateAtOrdinal(world.calendar, exactDateToOrdinal(world.calendar, date) + 1) : date
    if (operation === 'advance' && JSON.stringify(date) !== expectedToday) return { error: 'A data da campanha mudou. Recarregue a página antes de avançar.' }
    if (Math.abs(next.year) > 1000000) return { error: 'A data está além do limite de navegação do calendário.' }
    await getWorldRepository().updateCampaignToday(worldId, next, expectedToday, expectedCalendar)
    revalidatePath('/calendar')
    revalidatePath('/', 'layout')
    return { saved: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível salvar a data da campanha.' }
  }
}

export async function updateCalendarAppearanceAction(previous: CalendarActionState, formData: FormData): Promise<CalendarActionState> {
  const fail = (error: string): CalendarActionState => ({ error, savedAppearance: previous.savedAppearance })
  const worldId = formData.get('worldId')
  const raw = formData.get('appearance')
  const expected = formData.get('expectedAppearance')
  if (typeof worldId !== 'string' || !worldId || typeof raw !== 'string' || typeof expected !== 'string') return fail('Dados do tema incompletos.')
  let input: unknown
  try { input = JSON.parse(raw) } catch { return fail('A configuração de aparência é inválida.') }
  const parsed = CalendarAppearanceSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues.map((issue) => issue.message).join(' '))
  try {
    const world = await getCurrentWorld()
    if (world.id !== worldId) return fail('O mundo ativo mudou. Reabra o calendário do mundo que deseja editar.')
    const updated = await getWorldRepository().updateCalendarAppearance(worldId, parsed.data, expected)
    revalidatePath('/calendar')
    return { saved: true, savedAppearance: JSON.stringify(updated.calendarAppearance) }
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Não foi possível salvar a aparência.')
  }
}

export async function updateCalendarLandmarksAction(previous: CalendarActionState, formData: FormData): Promise<CalendarActionState> {
  const fail = (error: string): CalendarActionState => ({ error, savedLandmarks: previous.savedLandmarks })
  const worldId = formData.get('worldId')
  const raw = formData.get('landmarks')
  const expectedLandmarks = formData.get('expectedLandmarks')
  const expectedCalendar = formData.get('expectedCalendar')
  if (typeof worldId !== 'string' || !worldId || typeof raw !== 'string' || typeof expectedLandmarks !== 'string' || typeof expectedCalendar !== 'string') return fail('Dados dos marcos incompletos.')
  let input: unknown
  try { input = JSON.parse(raw) } catch { return fail('A configuração dos marcos é inválida.') }
  const parsed = CalendarLandmarksSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues.map((issue) => issue.message).join(' '))
  try {
    const world = await getCurrentWorld()
    if (world.id !== worldId) return fail('O mundo ativo mudou. Reabra o calendário do mundo que deseja editar.')
    const updated = await getWorldRepository().updateCalendarLandmarks(worldId, parsed.data, expectedLandmarks, expectedCalendar)
    revalidatePath('/calendar')
    return { saved: true, savedLandmarks: JSON.stringify(updated.calendarLandmarks) }
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Não foi possível salvar os marcos.')
  }
}

export async function updateCalendarSeasonsAction(previous: CalendarActionState, formData: FormData): Promise<CalendarActionState> {
  const fail = (error: string): CalendarActionState => ({ error, savedSeasons: previous.savedSeasons })
  const worldId = formData.get('worldId')
  const raw = formData.get('seasons')
  const expectedSeasons = formData.get('expectedSeasons')
  const expectedCalendar = formData.get('expectedCalendar')
  if (typeof worldId !== 'string' || !worldId || typeof raw !== 'string' || typeof expectedSeasons !== 'string' || typeof expectedCalendar !== 'string') return fail('Dados das estações incompletos.')
  let input: unknown
  try { input = JSON.parse(raw) } catch { return fail('A configuração das estações é inválida.') }
  const parsed = CalendarSeasonsSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues.map((issue) => issue.message).join(' '))
  try {
    const world = await getCurrentWorld()
    if (world.id !== worldId) return fail('O mundo ativo mudou. Reabra o calendário do mundo que deseja editar.')
    const updated = await getWorldRepository().updateCalendarSeasons(worldId, parsed.data, expectedSeasons, expectedCalendar)
    revalidatePath('/calendar')
    return { saved: true, savedSeasons: JSON.stringify(updated.calendarSeasons) }
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Não foi possível salvar as estações.')
  }
}

export async function updateCalendarMoonsAction(previous: CalendarActionState, formData: FormData): Promise<CalendarActionState> {
  const fail = (error: string): CalendarActionState => ({ error, savedMoons: previous.savedMoons })
  const worldId = formData.get('worldId')
  const raw = formData.get('moons')
  const expectedMoons = formData.get('expectedMoons')
  const expectedCalendar = formData.get('expectedCalendar')
  if (typeof worldId !== 'string' || typeof raw !== 'string' || typeof expectedMoons !== 'string' || typeof expectedCalendar !== 'string') return fail('Dados das luas incompletos.')
  let input: unknown
  try { input = JSON.parse(raw) } catch { return fail('A configuração das luas é inválida.') }
  const parsed = CalendarMoonsSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues.map((issue) => issue.message).join(' '))
  try {
    const world = await getCurrentWorld()
    if (world.id !== worldId) return fail('O mundo ativo mudou. Reabra o calendário do mundo que deseja editar.')
    const updated = await getWorldRepository().updateCalendarMoons(worldId, parsed.data, expectedMoons, expectedCalendar)
    revalidatePath('/calendar')
    return { saved: true, savedMoons: JSON.stringify(updated.calendarMoons) }
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Não foi possível salvar as luas.')
  }
}

export async function updateCalendarAction(_: CalendarActionState, formData: FormData): Promise<CalendarActionState> {
  const worldId = formData.get('worldId')
  if (typeof worldId !== 'string' || !worldId) return { error: 'O mundo do calendário não foi identificado.' }
  const raw = formData.get('calendar')
  if (typeof raw !== 'string' || raw.trim() === '') return { error: 'A configuração do calendário está vazia.' }

  let input: unknown
  try {
    input = JSON.parse(raw)
  } catch {
    return { error: 'A configuração do calendário não é um JSON válido.' }
  }

  const parsed = CalendarSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues.map((issue) => issue.message).join(' ') }

  try {
    const world = await getCurrentWorld()
    if (world.id !== worldId) return { error: 'O mundo ativo mudou. Reabra o calendário do mundo que deseja editar.' }
    await getWorldRepository().updateCalendar(world.id, parsed.data)
    revalidatePath('/calendar')
    revalidatePath('/codex')
    revalidatePath('/', 'layout')
    return { saved: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível salvar o calendário.' }
  }
}
