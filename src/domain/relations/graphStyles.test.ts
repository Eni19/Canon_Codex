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
  it('rejects visually identical shapes even when colors differ', () => {
    const [first, second] = buildGraphCatalog(['a', 'b'], [])
    expect(GraphStylesSchema.safeParse([first, { ...second, stroke: first.stroke, tip: first.tip, symbol: first.symbol, color: '#123456' }]).success).toBe(false)
  })
})
