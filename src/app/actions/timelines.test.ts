import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ world: 'world-a', createTimelineEvent: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/services/worlds/getCurrentWorld', () => ({ getCurrentWorld: async () => ({ id: mocks.world }) }))
vi.mock('@/repositories', () => ({ getWorldRepository: () => ({ createTimelineEvent: mocks.createTimelineEvent }) }))

import { createTimelineEventAction } from './timelines'

describe('criação rápida de Evento', () => {
  beforeEach(() => { mocks.world = 'world-a'; mocks.createTimelineEvent.mockReset(); mocks.revalidatePath.mockReset() })
  function form() {
    const data = new FormData()
    data.set('worldId', 'world-a')
    data.set('timelineId', 'linha')
    data.set('expectedUpdatedAt', 'versão')
    data.set('title', 'Sessão sintética')
    data.set('quickEventDate', JSON.stringify({ start: { year: 2, intercalaryRuleId: 'festa' } }))
    return data
  }
  it('envia a data apresentada para o Evento e sua aparição e atualiza a agenda', async () => {
    mocks.createTimelineEvent.mockResolvedValue({ entity: { id: 'evento' } })
    expect(await createTimelineEventAction({}, form())).toEqual({ saved: true, entityId: 'evento' })
    expect(mocks.createTimelineEvent).toHaveBeenCalledWith('world-a', 'linha', 'Sessão sintética', { start: { year: 2, intercalaryRuleId: 'festa' } }, 'versão')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/calendar')
  })
  it('recusa mundo alterado e não substitui uma data limpa', async () => {
    const data = form()
    mocks.world = 'world-b'
    expect(await createTimelineEventAction({}, data)).toMatchObject({ error: expect.stringContaining('mundo ativo mudou') })
    mocks.world = 'world-a'
    data.set('quickEventDate', '')
    expect(await createTimelineEventAction({}, data)).toMatchObject({ error: expect.stringContaining('Informe a data') })
    expect(mocks.createTimelineEvent).not.toHaveBeenCalled()
  })
})
