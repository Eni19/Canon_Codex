import { describe, expect, it } from 'vitest'
import { collectTags, filterByTags, matchesTagPrefixes, parseTagQuery, tagKey } from './entityTags'

const entities = [
  { id: 'a', tags: ['Nobreza', 'vilão'] },
  { id: 'b', tags: ['nobreza', 'Porto'] },
  { id: 'c', tags: ['Nobreza', ' Vilao ', 'vilão'] },
  { id: 'd', tags: [] },
]

describe('tagKey', () => {
  it('ignora maiúsculas, acentos e espaços nas pontas', () => {
    expect(tagKey('  Vilão ')).toBe(tagKey('vilao'))
  })
})

describe('collectTags', () => {
  it('agrupa grafias equivalentes, conta cada registro uma vez e usa a grafia mais comum', () => {
    expect(collectTags(entities)).toEqual([
      { tag: 'Nobreza', count: 3 },
      { tag: 'vilão', count: 2 },
      { tag: 'Porto', count: 1 },
    ])
  })
})

describe('filterByTags', () => {
  it('exige todas as etiquetas pedidas', () => {
    expect(filterByTags(entities, ['nobreza', 'VILAO']).map((item) => item.id)).toEqual(['a', 'c'])
  })
  it('sem etiquetas devolve tudo', () => {
    expect(filterByTags(entities, [' '])).toHaveLength(4)
  })
})

describe('parseTagQuery', () => {
  it('separa os termos com # do texto livre', () => {
    expect(parseTagQuery('#Nob capitão #vil')).toEqual({ text: 'capitão', tagPrefixes: ['nob', 'vil'] })
    expect(parseTagQuery('sem etiqueta')).toEqual({ text: 'sem etiqueta', tagPrefixes: [] })
  })
  it('filtra por prefixo de etiqueta', () => {
    expect(matchesTagPrefixes(['Nobreza', 'Porto'], ['nob', 'por'])).toBe(true)
    expect(matchesTagPrefixes(['Nobreza'], ['nob', 'por'])).toBe(false)
  })
})
