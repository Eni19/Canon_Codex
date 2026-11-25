import { describe, expect, it } from 'vitest'
import { contentSections } from './contentSections'

const heading = (level: number, text: string) => ({ type: 'heading', attrs: { level }, content: text ? [{ type: 'text', text }] : [] })

describe('contentSections', () => {
  it('lista títulos de nível 1 e 2 em ordem, com o índice entre os h1/h2 renderizados', () => {
    const body = { type: 'doc', content: [
      heading(1, 'Origem'), { type: 'paragraph' }, heading(3, 'Detalhe'), heading(2, ''), heading(2, 'Família  e  aliados'),
    ] }
    expect(contentSections(body)).toEqual([
      { index: 0, title: 'Origem', level: 1 },
      { index: 2, title: 'Família e aliados', level: 2 },
    ])
  })
  it('aceita corpo vazio ou inválido', () => {
    expect(contentSections(undefined)).toEqual([])
    expect(contentSections({ type: 'doc' })).toEqual([])
  })
})
