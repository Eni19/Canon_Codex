import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultCalendar } from '@/domain/worlds/calendar'

const mocks = vi.hoisted(() => ({
  currentWorldId: 'world-a',
  updateCalendar: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/services/worlds/getCurrentWorld', () => ({
  getCurrentWorld: async () => ({ id: mocks.currentWorldId }),
}))
vi.mock('@/repositories', () => ({
  getWorldRepository: () => ({ updateCalendar: mocks.updateCalendar }),
}))

import { updateCalendarAction } from './calendar'

function calendarForm(worldId: string): FormData {
  const form = new FormData()
  form.set('worldId', worldId)
  form.set('calendar', JSON.stringify(createDefaultCalendar()))
  return form
}

describe('updateCalendarAction', () => {
  beforeEach(() => {
    mocks.currentWorldId = 'world-a'
    mocks.updateCalendar.mockReset()
    mocks.revalidatePath.mockReset()
  })

  it('does not save into another world after the active world changes', async () => {
    mocks.currentWorldId = 'world-b'

    const result = await updateCalendarAction({}, calendarForm('world-a'))

    expect(result.error).toContain('mundo ativo mudou')
    expect(mocks.updateCalendar).not.toHaveBeenCalled()
  })

  it('saves the calendar for the world that opened the form', async () => {
    const result = await updateCalendarAction({}, calendarForm('world-a'))

    expect(result).toEqual({ saved: true })
    expect(mocks.updateCalendar).toHaveBeenCalledWith('world-a', createDefaultCalendar())
  })
})
