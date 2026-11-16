import { describe, expect, it } from 'vitest'
import { buildGraphCatalog, GraphStylesSchema, styleSignature } from './graphStyles'

describe('graph style catalog', () => {
  it('proposes distinct styles and preserves saved styles when types are added', () => {
    const initial = buildGraphCatalog(['protege', 'investiga'], [])
    expect(new Set(initial.map(styleSignature)).size).toBe(2)
    const updated = buildGraphCatalog(['aliado', 'protege', 'investiga'], initial)
    expect(updated.slice(0, 2)).toEqual(initial)
    expect(new Set(updated.map(styleSignature)).size).toBe(3)
  })
  it('permits reused shapes and preserves named types with a default direction', () => {
    const [first, second] = buildGraphCatalog(['a', 'b'], [])
    expect(GraphStylesSchema.safeParse([first, { ...first, type: second.type, color: '#123456', direction: 'both' }]).success).toBe(true)
    expect(GraphStylesSchema.safeParse([first, { ...first, direction: 'both' }]).success).toBe(false)
  })
})
