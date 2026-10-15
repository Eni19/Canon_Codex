import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'

const mocks = vi.hoisted(() => ({
  createEntity: vi.fn(),
  getEntity: vi.fn(),
  updateEntity: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND') },
  redirect: () => { throw new Error('REDIRECT') },
  RedirectType: { replace: 'replace' },
}))
vi.mock('@/services/worlds/getCurrentWorld', () => ({ getCurrentWorld: async () => createDefaultWorldSeed() }))
vi.mock('@/repositories', () => ({ getWorldRepository: () => mocks }))

import { createEntityAction, updateEntityAction } from './entities'

describe('ações de entidade com campos de data', () => {
  beforeEach(() => {
    mocks.createEntity.mockReset().mockResolvedValue({ id: 'event-1' })
    mocks.getEntity.mockReset().mockResolvedValue({ id: 'event-1', type: 'event', properties: {} })
    mocks.updateEntity.mockReset()
    mocks.revalidatePath.mockReset()
  })

  it('cria Evento com a data informada no formulário inicial', async () => {
    const form = new FormData()
    form.set('type', 'event')
    form.set('title', 'Marco sintético')
    form.set('eventDate', JSON.stringify({ start: { year: -2, month: 3, day: 4 } }))

    await expect(createEntityAction(form)).rejects.toThrow('REDIRECT')
    expect(mocks.createEntity).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      type: 'event',
      properties: expect.objectContaining({ eventDate: { start: { year: -2, month: 3, day: 4 } } }),
    }))
  })

  it('mantém a string ISO ao salvar outro campo do Evento', async () => {
    const form = new FormData()
    form.set('title', 'Título atualizado')
    form.set('eventDate', '2024-02-29')

    await expect(updateEntityAction('event-1', form)).rejects.toThrow('REDIRECT')
    expect(mocks.updateEntity).toHaveBeenCalledWith(expect.any(String), 'event-1', expect.objectContaining({
      properties: expect.objectContaining({ eventDate: '2024-02-29' }),
    }))
  })
})
