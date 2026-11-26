import { describe, expect, it } from 'vitest'
import { contentTextBlocks } from './content-text'

describe('texto do conteúdo', () => {
  it('transforma títulos, parágrafos, listas, citações e vínculos em blocos de texto', () => {
    const body = {
      type: 'doc', content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Achados' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Visto com ' }, { type: 'entityLink', attrs: { entityId: 'x', label: 'Fulano' } }, { type: 'text', text: ' na doca.' }] },
        { type: 'paragraph' },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'luva rasgada' }] }] }] },
        { type: 'callout', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'cuidado' }, { type: 'hardBreak' }, { type: 'text', text: 'rolar ' }, { type: 'die', attrs: { sides: 20 } }] }] },
      ],
    }
    expect(contentTextBlocks(body)).toEqual([
      { kind: 'heading', text: 'Achados', level: 2 },
      { kind: 'paragraph', text: 'Visto com Fulano na doca.' },
      { kind: 'item', text: 'luva rasgada' },
      { kind: 'quote', text: 'cuidado\nrolar d20' },
    ])
    expect(contentTextBlocks(null)).toEqual([])
  })
})
