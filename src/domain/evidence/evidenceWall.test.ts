import { describe, expect, it } from 'vitest'
import { ITEM_SIZE, WALL, WALL_MARGIN, bringToFront, clampToWall, defaultLayout, readWallLayout, serializeWallLayout, tilt, wallStrings, type WallItemRef } from './evidenceWall'

const items: WallItemRef[] = [
  { id: 'cover', kind: 'cover' },
  { id: 'sheet-1', kind: 'sheet' }, { id: 'sheet-2', kind: 'sheet' },
  { id: 'char-1', kind: 'character' },
  ...Array.from({ length: 6 }, (_, i) => ({ id: `note-${i}`, kind: 'note' as const })),
]

describe('parede de evidências', () => {
  it('a arrumação inicial coloca todas as peças inteiras dentro da parede', () => {
    const layout = defaultLayout(items)
    for (const item of items) {
      const p = layout[item.id], { w, h } = ITEM_SIZE[item.kind]
      expect(Math.abs(p.x) + w / 2).toBeLessThanOrEqual(WALL.width / 2 - WALL_MARGIN + 1e-9)
      expect(Math.abs(p.y) + h / 2).toBeLessThanOrEqual(WALL.height / 2 - WALL_MARGIN + 1e-9)
    }
    expect(new Set(Object.values(layout).map((p) => p.order)).size).toBe(items.length)
  })

  it('arrastar para fora para na borda', () => {
    expect(clampToWall('note', 99, -99)).toEqual({ x: WALL.width / 2 - 0.23 - WALL_MARGIN, y: -(WALL.height / 2 - 0.23 - WALL_MARGIN) })
    expect(clampToWall('note', 0.1, 0.2)).toEqual({ x: 0.1, y: 0.2 })
  })

  it('a inclinação é pequena e sempre a mesma para a mesma peça', () => {
    expect(tilt('abc')).toBe(tilt('abc'))
    expect(Math.abs(tilt('abc'))).toBeLessThanOrEqual(0.055)
  })

  it('lê a arrumação salva, completa peças novas e descarta as removidas ou dados ilegíveis', () => {
    const saved = serializeWallLayout({ cover: { x: 0.5, y: 0.1, rotation: 0.02, order: 4 }, gone: { x: 0, y: 0, rotation: 0, order: 9 } })
    const layout = readWallLayout(JSON.parse(JSON.stringify(saved)), items)
    expect(layout.cover).toEqual({ x: 0.5, y: 0.1, rotation: 0.02, order: 4 })
    expect(layout.gone).toBeUndefined()
    expect(layout['note-0'].order).toBeGreaterThan(9)
    expect(readWallLayout({ version: 99 }, items)).toEqual(defaultLayout(items))
    expect(readWallLayout(null, items)).toEqual(defaultLayout(items))
  })

  it('traz a peça mexida para a frente', () => {
    const layout = defaultLayout(items)
    const next = bringToFront(layout, 'cover')
    expect(next.cover.order).toBe(Math.max(...Object.values(layout).map((p) => p.order)) + 1)
  })

  it('liga a evidência às notas, aos personagens e à primeira folha, e as folhas entre si', () => {
    const links = wallStrings(items)
    expect(links).toContainEqual(['cover', 'note-0'])
    expect(links).toContainEqual(['cover', 'char-1'])
    expect(links).toContainEqual(['cover', 'sheet-1'])
    expect(links).toContainEqual(['sheet-1', 'sheet-2'])
    expect(wallStrings([{ id: 'n', kind: 'note' }])).toEqual([])
  })
})
