import { describe, expect, it, vi } from 'vitest'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import NewEntityPage from './page'

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@/services/worlds/getCurrentWorld', () => ({ getCurrentWorld: async () => world }))
vi.mock('@/services/entities/getEntityEditorData', () => ({ getEntityEditorData: async () => ({}) }))
vi.mock('@/components/entities/entity-editor/entity-editor', () => ({ EntityEditor: () => null }))

const world = createDefaultWorldSeed()
world.campaignToday = { year: 1, month: 2, day: 3 }
world.calendar.intercalaryRules.push({ id: 'festival', name: 'Festival', month: 1, everyYears: 1, yearOffset: 0, extendsMonth: false })

describe('data inicial do novo Evento', () => {
  const render = (query: Record<string, string>) => NewEntityPage({ params: Promise.resolve({ entityType: 'event' }), searchParams: Promise.resolve(query) })
  it('sugere o Hoje da campanha e o título de nota quando solicitado', async () => {
    const page = await render({ sessionNote: '1' })
    expect(page.props.initialEventDate).toEqual({ year: 1, month: 2, day: 3 })
    expect(page.props.initialTitle).toBe('Nota de sessão')
  })
  it('dá prioridade ao dia intercalar escolhido no calendário', async () => {
    const date = { year: 2, intercalaryRuleId: 'festival' }
    const page = await render({ worldId: world.id, date: JSON.stringify(date) })
    expect(page.props.initialEventDate).toEqual(date)
  })
  it('não abre criação com uma data de outro mundo ou data inválida', async () => {
    expect(JSON.stringify(await render({ worldId: 'outro', date: '{}' }))).toContain('mundo ativo mudou')
    expect(JSON.stringify(await render({ worldId: world.id, date: JSON.stringify({ year: 1, month: 99, day: 1 }) }))).toContain('não existe')
  })
})
