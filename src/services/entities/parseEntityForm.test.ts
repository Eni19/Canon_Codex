import { describe, expect, it } from 'vitest'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import { EntityFormError, parseEntityForm } from './parseEntityForm'

const world = createDefaultWorldSeed()
const typeOf = (id: string) => {
  const type = world.entityTypes.find((candidate) => candidate.id === id)
  if (!type) throw new Error('tipo ausente no seed: ' + id)
  return type
}
const ASSET = '6f1c1d36-8e0b-4a43-9f43-6a8f3f0e2a11'

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

describe('parseEntityForm', () => {
  it('exige título', () => {
    expect(() => parseEntityForm(typeOf('character'), form({ title: '   ' }), world.calendar)).toThrow(EntityFormError)
  })

  it('lê listas, cor e status do formulário único', () => {
    const parsed = parseEntityForm(typeOf('character'), form({ title: 'Ilsa', aliases: 'A Cinza, Ilsinha', tags: 'npc,  aliada', theme: 'blue', status: ' rascunho ' }), world.calendar)
    expect(parsed).toMatchObject({ title: 'Ilsa', aliases: ['A Cinza', 'Ilsinha'], tags: ['npc', 'aliada'], theme: 'blue', status: 'rascunho' })
  })

  it('distingue imagem ausente, removida e enviada', () => {
    const character = typeOf('character')
    expect(parseEntityForm(character, form({ title: 'X' }), world.calendar).coverAssetId).toBeUndefined()
    expect(parseEntityForm(character, form({ title: 'X', coverAssetId: '' }), world.calendar).coverAssetId).toBeNull()
    expect(parseEntityForm(character, form({ title: 'X', coverAssetId: ASSET }), world.calendar).coverAssetId).toBe(ASSET)
    expect(() => parseEntityForm(character, form({ title: 'X', coverAssetId: '../segredo' }), world.calendar)).toThrow(EntityFormError)
  })

  it('ignora símbolo fora da cosmologia', () => {
    expect(parseEntityForm(typeOf('character'), form({ title: 'X', symbolAssetId: ASSET }), world.calendar).symbolAssetId).toBeUndefined()
    expect(parseEntityForm(typeOf('cosmology'), form({ title: 'X', symbolAssetId: ASSET }), world.calendar).symbolAssetId).toBe(ASSET)
  })

  it('lê o conteúdo das páginas quando enviado', () => {
    const pages = [{ id: 'principal', title: 'Principal', body: { type: 'doc', content: [] } }]
    const parsed = parseEntityForm(typeOf('character'), form({ title: 'X', content: JSON.stringify(pages) }), world.calendar)
    expect(parsed.content?.pages).toEqual(pages)
  })

  it('valida o editor estruturado do tipo e transforma JSON inválido em erro de formulário', () => {
    expect(parseEntityForm(typeOf('evidence'), form({ title: 'X' }), world.calendar).properties.evidenceFindings).toEqual([])
    expect(() => parseEntityForm(typeOf('evidence'), form({ title: 'X', evidenceFindings: '{quebrado' }), world.calendar)).toThrow(EntityFormError)
  })

  it('guarda o enquadramento personalizado do retrato e omite o padrão', () => {
    const character = typeOf('character')
    const custom = { x: -12.5, y: 8, scale: 1.8 }
    expect(parseEntityForm(character, form({ title: 'X', coverFraming: JSON.stringify(custom) }), world.calendar).properties.coverFraming).toEqual(custom)
    expect(parseEntityForm(character, form({ title: 'X', coverFraming: JSON.stringify({ x: 0, y: 0, scale: 1.4 }) }), world.calendar).properties).not.toHaveProperty('coverFraming')
    expect(() => parseEntityForm(character, form({ title: 'X', coverFraming: JSON.stringify({ x: 0, y: 0, scale: 9 }) }), world.calendar)).toThrow(EntityFormError)
  })

  it('usa o padrão da criatura (sem zoom) para decidir o que gravar', () => {
    const creature = typeOf('creature')
    expect(parseEntityForm(creature, form({ title: 'X', coverFraming: JSON.stringify({ x: 0, y: 0, scale: 1 }) }), world.calendar).properties).not.toHaveProperty('coverFraming')
    expect(parseEntityForm(creature, form({ title: 'X', coverFraming: JSON.stringify({ x: 0, y: 0, scale: 1.4 }) }), world.calendar).properties.coverFraming).toEqual({ x: 0, y: 0, scale: 1.4 })
  })

  it('ignora enquadramento em tipos sem retrato', () => {
    const parsed = parseEntityForm(typeOf('location'), form({ title: 'X', coverFraming: JSON.stringify({ x: 5, y: 5, scale: 2 }) }), world.calendar)
    expect(parsed.properties).not.toHaveProperty('coverFraming')
  })
})
