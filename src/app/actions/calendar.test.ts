import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultCalendar } from '@/domain/worlds/calendar'

const mocks = vi.hoisted(() => ({
  currentWorldId: 'world-a',
  updateCalendar: vi.fn(),
  updateCalendarSeasons: vi.fn(),
  updateCalendarLandmarks: vi.fn(),
  updateCalendarAppearance: vi.fn(),
  updateCampaignToday: vi.fn(),
  worldCalendar: null as ReturnType<typeof createDefaultCalendar> | null,
  today: null as { year: number; month: number; day: number } | null,
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/services/worlds/getCurrentWorld', () => ({
  getCurrentWorld: async () => ({ id: mocks.currentWorldId, calendar: mocks.worldCalendar, campaignToday: mocks.today }),
}))
vi.mock('@/repositories', () => ({
  getWorldRepository: () => ({ updateCalendar: mocks.updateCalendar, updateCalendarSeasons: mocks.updateCalendarSeasons, updateCalendarLandmarks: mocks.updateCalendarLandmarks, updateCalendarAppearance: mocks.updateCalendarAppearance, updateCampaignToday: mocks.updateCampaignToday }),
}))

import { updateCalendarAction, updateCalendarAppearanceAction, updateCalendarLandmarksAction, updateCalendarSeasonsAction, updateCampaignTodayAction } from './calendar'

describe('campaign today', () => {
  beforeEach(() => { mocks.currentWorldId = 'world-a'; mocks.worldCalendar = createDefaultCalendar(); mocks.today = { year: 0, month: 12, day: 31 }; mocks.updateCampaignToday.mockReset() })
  function form(operation: string) {
    const data = new FormData()
    data.set('worldId', 'world-a')
    data.set('expectedToday', JSON.stringify(mocks.today))
    data.set('expectedCalendar', JSON.stringify(mocks.worldCalendar))
    data.set('date', JSON.stringify(mocks.today))
    data.set('operation', operation)
    return data
  }
  it('advances across the year boundary and preserves concurrency snapshots', async () => {
    const data = form('advance')
    expect(await updateCampaignTodayAction({}, data)).toEqual({ saved: true })
    expect(mocks.updateCampaignToday).toHaveBeenCalledWith('world-a', { year: 1, month: 1, day: 1 }, data.get('expectedToday'), data.get('expectedCalendar'))
  })
  it('refuses stale data and changed active world', async () => {
    const data = form('advance')
    mocks.today = { year: 0, month: 12, day: 30 }
    expect(await updateCampaignTodayAction({}, data)).toMatchObject({ error: expect.stringContaining('mudou') })
    mocks.currentWorldId = 'world-b'
    expect(await updateCampaignTodayAction({}, data)).toMatchObject({ error: expect.stringContaining('mundo ativo mudou') })
    expect(mocks.updateCampaignToday).not.toHaveBeenCalled()
  })
  it('advances into an independent intercalary day', async () => {
    mocks.worldCalendar!.intercalaryRules.push({ id: 'festival', name: 'Festival', month: 12, everyYears: 1, yearOffset: 0, extendsMonth: false })
    const data = form('advance')
    expect(await updateCampaignTodayAction({}, data)).toEqual({ saved: true })
    expect(mocks.updateCampaignToday).toHaveBeenCalledWith('world-a', { year: 0, intercalaryRuleId: 'festival' }, data.get('expectedToday'), data.get('expectedCalendar'))
  })
})

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
    mocks.updateCalendarSeasons.mockReset()
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

describe('calendar content actions', () => {
  beforeEach(() => { mocks.currentWorldId = 'world-a'; mocks.updateCalendarLandmarks.mockReset(); mocks.updateCalendarAppearance.mockReset() })
  it('saves categories and landmarks against their original snapshot', async () => {
    const content = { categories: [], landmarks: [] }
    const form = new FormData()
    form.set('worldId', 'world-a')
    form.set('landmarks', JSON.stringify(content))
    form.set('expectedLandmarks', JSON.stringify(content))
    form.set('expectedCalendar', '{}')
    mocks.updateCalendarLandmarks.mockResolvedValue({ calendarLandmarks: content })
    expect(await updateCalendarLandmarksAction({}, form)).toEqual({ saved: true, savedLandmarks: JSON.stringify(content) })
    expect(mocks.updateCalendarLandmarks).toHaveBeenCalledWith('world-a', content, JSON.stringify(content), '{}')
  })
  it('rejects theme saves when the active world changed', async () => {
    mocks.currentWorldId = 'world-b'
    const form = new FormData()
    form.set('worldId', 'world-a')
    form.set('appearance', JSON.stringify({ activeTheme: 'celeste', customThemes: [] }))
    form.set('expectedAppearance', '{}')
    expect(await updateCalendarAppearanceAction({}, form)).toMatchObject({ error: expect.stringContaining('mundo ativo mudou') })
    expect(mocks.updateCalendarAppearance).not.toHaveBeenCalled()
  })
})

describe('updateCalendarSeasonsAction', () => {
  const seasons = [{ id: 'season', name: 'Inverno', color: '#aabbcc', start: { month: 1, day: 1 } }]
  function seasonForm() {
    const form = new FormData()
    form.set('worldId', 'world-a')
    form.set('seasons', JSON.stringify(seasons))
    form.set('expectedSeasons', '[]')
    form.set('expectedCalendar', '{"calendar":"snapshot"}')
    return form
  }
  beforeEach(() => {
    mocks.currentWorldId = 'world-a'
    mocks.updateCalendarSeasons.mockReset()
    mocks.revalidatePath.mockReset()
  })
  it('saves the section and returns the new snapshot for another edit', async () => {
    mocks.updateCalendarSeasons.mockResolvedValue({ calendarSeasons: seasons })
    const result = await updateCalendarSeasonsAction({}, seasonForm())
    expect(mocks.updateCalendarSeasons).toHaveBeenCalledWith('world-a', seasons, '[]', '{"calendar":"snapshot"}')
    expect(result).toEqual({ saved: true, savedSeasons: JSON.stringify(seasons) })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/calendar')
  })
  it('refuses a changed world and keeps the previous snapshot on conflict', async () => {
    mocks.currentWorldId = 'world-b'
    const previous = { savedSeasons: '["previous"]' }
    const result = await updateCalendarSeasonsAction(previous, seasonForm())
    expect(result.error).toContain('mundo ativo mudou')
    expect(result.savedSeasons).toBe(previous.savedSeasons)
    expect(mocks.updateCalendarSeasons).not.toHaveBeenCalled()
  })
  it('reports conflicts returned by the repository', async () => {
    mocks.updateCalendarSeasons.mockRejectedValue(new Error('As estações mudaram.'))
    expect(await updateCalendarSeasonsAction({}, seasonForm())).toMatchObject({ error: 'As estações mudaram.' })
  })
})
