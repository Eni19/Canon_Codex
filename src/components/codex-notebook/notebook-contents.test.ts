import { describe, expect, it } from 'vitest'
import { buildSpreads, formatRecordCount, pageNumbers, seededRandom, spreadIndexFromParam, type NotebookType } from './notebook-contents'

const type = (id: string, pluralLabel = id): NotebookType => ({ id, label: id, pluralLabel, icon: 'Circle', count: 0, recent: [] })

describe('buildSpreads', () => {
  it('opens with the preface and closes with the tools', () => {
    const spreads = buildSpreads([type('character', 'Personagens')])
    expect(spreads.map((spread) => spread.id)).toEqual(['preface', 'character', 'tools'])
    expect(spreads[1]).toMatchObject({ kind: 'type', tab: 'Personagens' })
  })

  it('puts the usual record types first and keeps the world order for the rest', () => {
    const spreads = buildSpreads([type('clue'), type('location'), type('evidence'), type('character')])
    expect(spreads.map((spread) => spread.id)).toEqual(['preface', 'character', 'location', 'clue', 'evidence', 'tools'])
  })
})

describe('spreadIndexFromParam', () => {
  const spreads = buildSpreads([type('character'), type('location')])
  it('opens the spread named in the URL', () => {
    expect(spreadIndexFromParam(spreads, 'location')).toBe(2)
    expect(spreadIndexFromParam(spreads, ['character', 'x'])).toBe(1)
  })

  it('falls back to the cover', () => {
    expect(spreadIndexFromParam(spreads, undefined)).toBe(-1)
    expect(spreadIndexFromParam(spreads, 'missing')).toBe(-1)
  })
})

describe('pageNumbers', () => {
  it('numbers each spread as two facing pages', () => {
    expect(pageNumbers(0)).toEqual([1, 2])
    expect(pageNumbers(3)).toEqual([7, 8])
  })
})

describe('formatRecordCount', () => {
  it('uses the singular for one record', () => {
    expect(formatRecordCount(1)).toBe('1 registro')
    expect(formatRecordCount(4)).toBe('4 registros')
  })
})

describe('seededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = seededRandom('character')
    const b = seededRandom('character')
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(seededRandom('location')()).not.toBe(seededRandom('character')())
  })
})
