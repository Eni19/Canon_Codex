import { describe, expect, it } from 'vitest'
import { ConceptBlocksSchema } from '@/domain/entities/conceptBlock'

describe('ConceptBlocksSchema', () => {
  it('accepts the native concept notebook blocks', () => {
    const blocks = ConceptBlocksSchema.parse([
      { id: 'overview-1', type: 'overview', title: 'Visão geral', body: 'Uma ideia central.' },
      { id: 'diagram-1', type: 'diagram', title: 'Fluxo', body: 'Energia -> Ressonância -> Ritual' },
      { id: 'notes-1', type: 'notes', title: 'Observações', body: 'Informação complementar.' },
    ])

    expect(blocks.map((block) => block.type)).toEqual(['overview', 'diagram', 'notes'])
  })

  it('rejects unknown block types', () => {
    expect(() => ConceptBlocksSchema.parse([{ id: 'x', type: 'unknown', title: '', body: '' }])).toThrow()
  })
})
