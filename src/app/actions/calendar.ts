'use server'

import { revalidatePath } from 'next/cache'
import { CalendarSchema } from '@/domain/worlds/calendar'
import { getWorldRepository } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export type CalendarActionState = {
  error?: string
  saved?: boolean
}

export async function updateCalendarAction(_: CalendarActionState, formData: FormData): Promise<CalendarActionState> {
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
    await getWorldRepository().updateCalendar(world.id, parsed.data)
    revalidatePath('/calendar')
    revalidatePath('/codex')
    revalidatePath('/', 'layout')
    return { saved: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível salvar o calendário.' }
  }
}
