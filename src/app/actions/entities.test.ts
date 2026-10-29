import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'

const mocks = vi.hoisted(() => ({
  createEntity: vi.fn(),
  getEntity: vi.fn(),
  updateEntity: vi.fn(),
  saveContent: vi.fn(),
  listEntities: vi.fn(),
  removeAsset: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND') },
  redirect: () => { throw new Error('REDIRECT') },
  RedirectType: { replace: 'replace' },
}))
vi.mock('@/services/worlds/getCurrentWorld', () => ({ getCurrentWorld: async () => createDefaultWorldSeed() }))
vi.mock('@/repositories', () => ({ getWorldRepository: () => mocks, getAssetStore: () => mocks }))

import { createEntityAction, updateEntityAction } from './entities'

describe('ações de entidade com campos de data', () => {
  beforeEach(() => {
    mocks.createEntity.mockReset().mockResolvedValue({ id: 'event-1' })
    mocks.getEntity.mockReset().mockResolvedValue({ id: 'event-1', type: 'event', properties: {} })
    mocks.updateEntity.mockReset()
    mocks.saveContent.mockReset()
    mocks.listEntities.mockReset().mockResolvedValue([])
    mocks.removeAsset.mockReset()
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

describe('formulário único de entidade', () => {
  const OLD = '0d7a3f4e-1b2c-4d5e-8f90-a1b2c3d4e5f6'
  const NEW = '6f1c1d36-8e0b-4a43-9f43-6a8f3f0e2a11'

  beforeEach(() => {
    mocks.createEntity.mockReset().mockResolvedValue({ id: 'char-1' })
    mocks.getEntity.mockReset().mockResolvedValue({ id: 'char-1', type: 'character', coverAssetId: OLD, properties: {} })
    mocks.updateEntity.mockReset()
    mocks.saveContent.mockReset()
    mocks.listEntities.mockReset().mockResolvedValue([])
    mocks.removeAsset.mockReset()
  })

  it('devolve o erro em vez de derrubar a página quando falta o título', async () => {
    const form = new FormData()
    form.set('type', 'character')
    form.set('title', '')
    await expect(createEntityAction(form)).resolves.toEqual({ error: 'O título é obrigatório.' })
    expect(mocks.createEntity).not.toHaveBeenCalled()
  })

  it('cria com imagem, cor e conteúdo de uma só vez', async () => {
    const pages = [{ id: 'principal', title: 'Principal', body: { type: 'doc', content: [] } }]
    const form = new FormData()
    form.set('type', 'character')
    form.set('title', 'Ilsa')
    form.set('coverAssetId', NEW)
    form.set('theme', 'green')
    form.set('content', JSON.stringify(pages))

    await expect(createEntityAction(form)).rejects.toThrow('REDIRECT')
    expect(mocks.createEntity).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ title: 'Ilsa', coverAssetId: NEW, theme: 'green' }))
    expect(mocks.saveContent).toHaveBeenCalledWith(expect.any(String), 'char-1', expect.objectContaining({ pages }))
  })

  it('remove a imagem anterior quando trocada e não usada por outro registro', async () => {
    const form = new FormData()
    form.set('title', 'Ilsa')
    form.set('coverAssetId', NEW)

    await expect(updateEntityAction('char-1', form)).rejects.toThrow('REDIRECT')
    expect(mocks.updateEntity).toHaveBeenCalledWith(expect.any(String), 'char-1', expect.objectContaining({ coverAssetId: NEW }))
    expect(mocks.removeAsset).toHaveBeenCalledWith(expect.any(String), OLD)
  })

  it('mantém a imagem anterior se outro registro ainda a usa', async () => {
    mocks.listEntities.mockResolvedValue([{ id: 'outro', coverAssetId: OLD, properties: {} }])
    const form = new FormData()
    form.set('title', 'Ilsa')
    form.set('coverAssetId', '')

    await expect(updateEntityAction('char-1', form)).rejects.toThrow('REDIRECT')
    expect(mocks.updateEntity).toHaveBeenCalledWith(expect.any(String), 'char-1', expect.objectContaining({ coverAssetId: null }))
    expect(mocks.removeAsset).not.toHaveBeenCalled()
  })
})
