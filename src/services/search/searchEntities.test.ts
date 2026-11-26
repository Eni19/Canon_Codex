import { describe, expect, it, vi } from 'vitest'
import { searchEntities } from './searchEntities'

vi.mock('@/repositories', () => ({
  getWorldRepository: () => ({
    getWorld: async () => ({ entityTypes: [] }),
    listEntities: async () => [
      { id: 'tag', type: 'location', title: 'Mirante', aliases: [], tags: ['aurora'] },
      { id: 'title', type: 'character', title: 'Aurora', aliases: ['Estrela da Manhã'], tags: [] },
    ],
  }),
}))

describe('ordenação da busca de entidades', () => {
  it.each([
    ['apelido cadastrado', 'Estrela da Manhã'],
    ['trecho interno do título', 'ror'],
    ['letras trocadas', 'Auorra'],
  ])('encontra Aurora por %s', async (_caso, consulta) => {
    const results = await searchEntities('world', consulta)
    expect(results[0]?.id).toBe('title')
  })

  it('evita aproximar um trecho de três letras que não ocorre nos registros', async () => {
    await expect(searchEntities('world', 'rir')).resolves.toEqual([])
  })

  it('apresenta o título exato antes da correspondência por tag', async () => {
    const results = await searchEntities('world', 'Aurora')
    expect(results.map(item => item.id)).toEqual(['title', 'tag'])
  })

  it('prioriza o título antes de aplicar o limite, respeitando o filtro de tipo', async () => {
    await expect(searchEntities('world', ' AURORA ', { limit: 1 })).resolves.toMatchObject([{ id: 'title' }])
    await expect(searchEntities('world', 'Aurora', { type: 'location' })).resolves.toMatchObject([{ id: 'tag' }])
  })

  it('encontra título e tag por aproximação quando falta uma letra', async () => {
    const results = await searchEntities('world', 'Aurra')
    expect(results.map(item => item.id)).toEqual(['title', 'tag'])
  })
})
