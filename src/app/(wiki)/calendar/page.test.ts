import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'
import CalendarPage from './page'

vi.mock('@/services/worlds/getCurrentWorld', () => ({ getCurrentWorld: vi.fn() }))
vi.mock('lucide-react', () => ({ CalendarDays: () => null }))
vi.mock('next/link', () => ({ default: () => null }))
vi.mock('@/repositories', () => ({ getWorldRepository: () => ({ listCalendarAgenda: async () => [] }) }))
vi.mock('@/components/wiki/breadcrumbs', () => ({ Breadcrumbs: () => null }))
vi.mock('@/components/wiki/page-container', () => ({ PageContainer: () => null }))
vi.mock('@/components/calendar/calendar-editor-panel', () => ({ CalendarAppearancePanel: () => null, CalendarEditorPanel: () => null, CalendarMoonsPanel: () => null, CalendarSeasonsPanel: () => null, CalendarLandmarksPanel: () => null }))
vi.mock('@/components/calendar/calendar-visual-prototype', () => ({ CalendarVisualPrototype: () => null }))

describe('calendar moon display', () => {
  beforeEach(() => {
    const world = createDefaultWorldSeed()
    world.calendarMoons = [
      { id: 'moon-a', name: 'Lua A', color: '#aabbcc', cycleDays: 8, newMoon: { year: 0, month: 1, day: 1 } },
      { id: 'moon-b', name: 'Lua B', color: '#ccaa88', cycleDays: 4, newMoon: { year: 0, month: 1, day: 1 } },
    ]
    vi.mocked(getCurrentWorld).mockResolvedValue(world)
  })

  it('opens on the saved campaign date and keeps a link back to it', async () => {
    const world = createDefaultWorldSeed()
    world.campaignToday = { year: 3, month: 2, day: 4 }
    vi.mocked(getCurrentWorld).mockResolvedValue(world)
    const initial = JSON.stringify(await CalendarPage({ searchParams: Promise.resolve({}) }))
    expect(initial).toContain('year=3&month=2&day=4&view=month')
    expect(initial).toContain('Hoje da campanha')
    const otherMonth = JSON.stringify(await CalendarPage({ searchParams: Promise.resolve({ year: '1', month: '1', day: '1' }) }))
    expect(otherMonth).toContain('year=3&month=2&day=4&view=month')
  })

  it('renders each moon with accessible phases and selected-day illumination', async () => {
    const page = await CalendarPage({ searchParams: Promise.resolve({ year: '0', month: '1', day: '3' }) })
    const tree = JSON.stringify(page)
    expect(tree).toContain('Lua A: Quarto crescente; Lua B: Lua cheia')
    expect(tree).toContain('50,"% iluminada"')
    expect(tree).toContain('100,"% iluminada"')
    expect(tree).toContain('Fases das luas no dia selecionado')
  })

  it('does not show a moon section when none are configured', async () => {
    const world = createDefaultWorldSeed()
    vi.mocked(getCurrentWorld).mockResolvedValue(world)
    const page = await CalendarPage({ searchParams: Promise.resolve({ year: '0', month: '1', day: '1' }) })
    expect(JSON.stringify(page)).not.toContain('Fases das luas no dia selecionado')
  })

  it('applies the selected theme and keeps filtered moons available in the day detail', async () => {
    const world = createDefaultWorldSeed()
    world.calendarAppearance.activeTheme = 'celeste'
    world.calendarMoons = [
      { id: 'a', name: 'Lua A', color: '#aabbcc', cycleDays: 8, newMoon: { year: 0, month: 1, day: 1 } },
      { id: 'b', name: 'Lua B', color: '#ccaa88', cycleDays: 4, newMoon: { year: 0, month: 1, day: 1 } },
    ]
    vi.mocked(getCurrentWorld).mockResolvedValue(world)
    const result = JSON.stringify(await CalendarPage({ searchParams: Promise.resolve({ year: '0', month: '1', day: '3', moon: ['a'] }) }))
    expect(result).toContain('#18243a')
    expect(result).toContain('"--calendar-day":"#162238"')
    expect(result).toContain('"--background":"#111b2d"')
    expect(result).toContain('Lua A: Quarto crescente')
    expect(result).not.toContain('Lua B: Lua cheia')
    expect(result).toContain('Fases das luas no dia selecionado')
    expect(result).toContain('Lua B')
    expect(result).toContain('moon=a')
  })

  it('keeps all five moons in the day detail while limiting the small-screen grid', async () => {
    const world = createDefaultWorldSeed()
    world.calendarMoons = Array.from({ length: 5 }, (_, i) => ({ id: `lua-${i}`, name: `Lua ${i}`, color: '#aabbcc', cycleDays: 8 + i, newMoon: { year: 0, month: 1, day: 1 } }))
    vi.mocked(getCurrentWorld).mockResolvedValue(world)
    const result = JSON.stringify(await CalendarPage({ searchParams: Promise.resolve({ year: '0', month: '1', day: '1' }) }))
    expect(result).toContain('hidden sm:block')
    expect(result).toContain('sm:hidden')
    expect(result).toContain('Lua 4: Lua nova')
    expect(result).toContain('Fases das luas no dia selecionado')
  })

  it('remounts the jump form when the selected date changes and flags malformed input', async () => {
    const january = JSON.stringify(await CalendarPage({ searchParams: Promise.resolve({ year: '0', month: '1', day: '1' }) }))
    const february = JSON.stringify(await CalendarPage({ searchParams: Promise.resolve({ year: '0', month: '2', day: '1' }) }))
    expect(january).toContain('"key":"0:1:1:"')
    expect(february).toContain('"key":"0:2:1:"')
    const invalid = JSON.stringify(await CalendarPage({ searchParams: Promise.resolve({ year: 'abc' }) }))
    expect(invalid).toContain('A data informada não existe')
  })

  it('renders seasonal transitions and all selected-day landmarks', async () => {
    const world = createDefaultWorldSeed()
    world.calendarSeasons = [{ id: 's', name: 'Estação sintética', color: '#aabbcc', start: { month: 1, day: 1 } }]
    world.calendarLandmarks = { categories: [{ id: 'cat', name: 'Categoria', color: '#aabbcc' }], landmarks: [
      { id: 'a', title: 'Marco A', description: '', categoryId: 'cat', kind: 'annual', start: { month: 1, day: 1 } },
      { id: 'b', title: 'Marco B', description: '', categoryId: 'cat', kind: 'annual', start: { month: 1, day: 1 } },
    ] }
    vi.mocked(getCurrentWorld).mockResolvedValue(world)
    const result = JSON.stringify(await CalendarPage({ searchParams: Promise.resolve({ year: '0', month: '1', day: '1' }) }))
    expect(result).toContain('Início de Estação sintética')
    expect(result).toContain('Legenda das estações')
    expect(result).toContain('"borderTopColor":"#aabbcc"')
    expect(result).toContain('Marcos neste dia')
    expect(result).toContain('Marco A')
    expect(result).toContain('Marco B')
  })

  it('does not link beyond the navigation year limits', async () => {
    const upper = JSON.stringify(await CalendarPage({ searchParams: Promise.resolve({ year: '1000000', month: '12', day: '1' }) }))
    expect(upper).toContain('"aria-disabled":"true"')
    expect(upper).not.toContain('year=1000001')
    const lower = JSON.stringify(await CalendarPage({ searchParams: Promise.resolve({ year: '-1000000', month: '1', day: '1' }) }))
    expect(lower).toContain('"aria-disabled":"true"')
    expect(lower).not.toContain('year=-1000001')
  })

  it('opens and preserves an independent intercalary day across views', async () => {
    const world = createDefaultWorldSeed()
    world.calendar.intercalaryRules.push({ id: 'festival', name: 'Festival sintético', month: 1, everyYears: 1, yearOffset: 0, extendsMonth: false })
    world.calendarMoons = [{ id: 'm', name: 'Lua sintética', color: '#aabbcc', cycleDays: 8, newMoon: { year: 0, month: 1, day: 1 } }]
    vi.mocked(getCurrentWorld).mockResolvedValue(world)
    const query = { year: '0', month: '1', day: '31', intercalary: 'festival' }
    const month = JSON.stringify(await CalendarPage({ searchParams: Promise.resolve(query) }))
    expect(month).toContain('Festival sintético, ano 0')
    expect(month).toContain('intercalary=festival')
    expect(month).toContain('Fases das luas no dia selecionado')
    const year = JSON.stringify(await CalendarPage({ searchParams: Promise.resolve({ ...query, view: 'year' }) }))
    expect(year).toContain('intercalary=festival')
  })

  it('links adjacent months across years -1, zero and 1 and preserves the selected period in views', async () => {
    const beforeZero = JSON.stringify(await CalendarPage({ searchParams: Promise.resolve({ year: '-1', month: '12', day: '12' }) }))
    expect(beforeZero).toContain('year=0&month=1&day=1&view=month')
    expect(beforeZero).toContain('year=-1&month=12&day=12&view=year')
    expect(beforeZero).toContain('year=-1&month=12&day=12&view=agenda')
    const zeroEnd = JSON.stringify(await CalendarPage({ searchParams: Promise.resolve({ year: '0', month: '12', day: '1' }) }))
    expect(zeroEnd).toContain('year=1&month=1&day=1&view=month')
    const agenda = JSON.stringify(await CalendarPage({ searchParams: Promise.resolve({ year: '0', month: '2', day: '10', view: 'agenda' }) }))
    expect(agenda).toContain('Nenhum Evento datado neste mês')
    expect(agenda).toContain('year=0&month=2&day=10&view=month')
  })
})
