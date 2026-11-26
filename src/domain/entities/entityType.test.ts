import { describe, expect, it } from 'vitest'
import { EntityTypeDefinitionSchema } from './entityType'

const type = (id: string, icon: string) => ({
  id, label: id, pluralLabel: id, icon, properties: [], layout: [], showInSidebar: true,
})

describe('EntityTypeDefinitionSchema', () => {
  it('reads the retired default icons of built-in types as the current ones', () => {
    expect(EntityTypeDefinitionSchema.parse(type('artifact', 'Gem')).icon).toBe('KeyRound')
    expect(EntityTypeDefinitionSchema.parse(type('cosmology', 'Orbit')).icon).toBe('Eclipse')
  })

  it('keeps icons chosen on purpose, and the same icon on other types', () => {
    expect(EntityTypeDefinitionSchema.parse(type('artifact', 'Sword')).icon).toBe('Sword')
    expect(EntityTypeDefinitionSchema.parse(type('custom', 'Gem')).icon).toBe('Gem')
  })
})
