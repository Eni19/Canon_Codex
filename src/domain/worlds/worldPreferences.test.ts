import { describe, expect, it } from 'vitest'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import { WorldSchema } from '@/domain/worlds/world'
import { CONTENT_GUIDE, INTERACTIVE_INTERFACES, TOOL_GUIDE, TOOL_IDS, WorldPreferencesSchema, defaultWorldPreferences, hasInteractiveInterface, normalizeWorldPreferences, usesInteractiveInterface } from './worldPreferences'

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
    }, typeIds)
    expect(normalized).toEqual({ hiddenEntityTypes: ['event'], hiddenTools: ['boards', 'calendar'], plainInterfaces: ['organization', 'artifact'] })
  })

  it('usa a versão prática só para os tipos escolhidos', () => {
    const preferences = { ...defaultWorldPreferences(), plainInterfaces: ['evidence'] }
    expect(usesInteractiveInterface(preferences, 'evidence')).toBe(false)
    expect(usesInteractiveInterface(preferences, 'organization')).toBe(true)
    expect(usesInteractiveInterface(preferences, 'event')).toBe(false)
  })

  it('lê um mundo sem preferências (gravado por código anterior) com o padrão', () => {
    const world: Record<string, unknown> = { ...createDefaultWorldSeed() }
    delete world.preferences
    expect(WorldSchema.parse(world).preferences).toEqual(defaultWorldPreferences())
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
