import { describe, expect, it } from 'vitest'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import { WorldSchema } from '@/domain/worlds/world'
import { CONTENT_GUIDE, INTERACTIVE_INTERFACES, TOOL_GUIDE, TOOL_IDS, WorldPreferencesSchema, defaultWorldPreferences, hasInteractiveInterface, moveInOrder, normalizeWorldPreferences, orderByPreference, usesInteractiveInterface } from './worldPreferences'

const typeIds = createDefaultWorldSeed().entityTypes.map((type) => type.id)

describe('preferências do Codex', () => {
  it('começa com tudo visível e todas as interfaces interativas', () => {
    const preferences = defaultWorldPreferences()
    expect(WorldPreferencesSchema.parse(preferences)).toEqual(preferences)
    for (const id of typeIds) expect(usesInteractiveInterface(preferences, id)).toBe(hasInteractiveInterface(id))
  })

  it('normaliza antes de gravar: sem repetição, sem tipos removidos, prática só onde há interativa', () => {
    const normalized = normalizeWorldPreferences({
      hiddenEntityTypes: ['event', 'event', 'tipo-removido'],
      hiddenTools: ['boards', 'boards', 'calendar'],
      plainInterfaces: ['organization', 'event', 'tipo-removido', 'artifact'],
      contentOrder: [],
    }, typeIds)
    expect(normalized).toEqual({ hiddenEntityTypes: ['event'], hiddenTools: ['boards', 'calendar'], plainInterfaces: ['organization', 'artifact'], contentOrder: [] })
  })

  it('usa a versão prática só para os tipos escolhidos', () => {
    const preferences = { ...defaultWorldPreferences(), plainInterfaces: ['evidence'], contentOrder: [] }
    expect(usesInteractiveInterface(preferences, 'evidence')).toBe(false)
    expect(usesInteractiveInterface(preferences, 'organization')).toBe(true)
    expect(usesInteractiveInterface(preferences, 'event')).toBe(false)
  })

  it('lê um mundo sem preferências (gravado por código anterior) com o padrão', () => {
    const world: Record<string, unknown> = { ...createDefaultWorldSeed() }
    delete world.preferences
    expect(WorldSchema.parse(world).preferences).toEqual(defaultWorldPreferences())
  })

  it('ordena pela preferência e deixa o resto na ordem em que veio', () => {
    const items = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
    expect(orderByPreference(items, []).map((item) => item.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(orderByPreference(items, ['c', 'a']).map((item) => item.id)).toEqual(['c', 'a', 'b', 'd'])
    expect(orderByPreference(items, ['x', 'd']).map((item) => item.id)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('move um item para outra posição da ordem', () => {
    expect(moveInOrder(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveInOrder(['a', 'b', 'c', 'd'], 'd', 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(moveInOrder(['a', 'b'], 'x', 0)).toEqual(['a', 'b'])
  })

  it('normaliza a ordem: sem repetição e só tipos do mundo', () => {
    const normalized = normalizeWorldPreferences({ ...defaultWorldPreferences(), contentOrder: ['event', 'removido', 'character', 'event'] }, typeIds)
    expect(normalized.contentOrder).toEqual(['event', 'character'])
  })

  it('lê preferências gravadas antes da ordem com a ordem padrão', () => {
    expect(WorldPreferencesSchema.parse({ hiddenEntityTypes: [], hiddenTools: [], plainInterfaces: [] }).contentOrder).toEqual([])
  })

  it('recusa ferramentas desconhecidas', () => {
    expect(WorldPreferencesSchema.safeParse({ ...defaultWorldPreferences(), hiddenTools: ['mapa'] }).success).toBe(false)
  })

  it('tem resumo para cada ferramenta e cada tipo padrão, e as duas versões de cada interface', () => {
    for (const id of TOOL_IDS) expect(TOOL_GUIDE[id].summary.length).toBeGreaterThan(10)
    for (const id of typeIds) expect(CONTENT_GUIDE[id]).toBeTruthy()
    for (const id of Object.keys(INTERACTIVE_INTERFACES)) expect(typeIds).toContain(id)
  })
})
