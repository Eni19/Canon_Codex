import { describe, expect, it } from 'vitest'
import { ARCHIVE_SIZE, BOX, BOX_INTERIOR, DESK, DESK_MARGIN, clampToArchive, defaultArchiveLayout, isInBox, restHeight, spreadPositions, type ArchiveItemRef } from './archiveBox'

const items: ArchiveItemRef[] = [
  { id: 'dossier', kind: 'dossier' },
  ...Array.from({ length: 5 }, (_, i) => ({ id: `sheet:a:${i}`, kind: 'sheet' as const })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `group:${i}`, kind: 'group' as const })),
  ...Array.from({ length: 12 }, (_, i) => ({ id: `member:${i}`, kind: 'member' as const })),
  { id: 'memo:objetivos', kind: 'memo' },
  { id: 'memo:ideais', kind: 'memo' },
]

const insideInterior = (item: ArchiveItemRef, p: { x: number; y: number }) => {
  const { w, h } = ARCHIVE_SIZE[item.kind]
  return Math.abs(p.x - BOX_INTERIOR.x) + w / 2 <= BOX_INTERIOR.w / 2 + 1e-9 && Math.abs(p.y - BOX_INTERIOR.y) + h / 2 <= BOX_INTERIOR.h / 2 + 1e-9
}
const clearOfBox = (item: ArchiveItemRef, p: { x: number; y: number }) => {
  const { w, h } = ARCHIVE_SIZE[item.kind]
  return Math.abs(p.x - BOX.x) >= (BOX.w + w) / 2 - 1e-9 || Math.abs(p.y - BOX.y) >= (BOX.h + h) / 2 - 1e-9
}
const onDesk = (item: ArchiveItemRef, p: { x: number; y: number }) => {
  const { w, h } = ARCHIVE_SIZE[item.kind]
  return Math.abs(p.x) + w / 2 <= DESK.width / 2 - DESK_MARGIN + 1e-9 && Math.abs(p.y) + h / 2 <= DESK.height / 2 - DESK_MARGIN + 1e-9
}

describe('caixa-arquivo das Organizações', () => {
  it('começa com todos os documentos dentro da caixa, com o dossiê no topo da pilha', () => {
    const layout = defaultArchiveLayout(items)
    for (const item of items) {
      expect(isInBox(layout[item.id].x, layout[item.id].y)).toBe(true)
      expect(insideInterior(item, layout[item.id])).toBe(true)
    }
    const top = Math.max(...Object.values(layout).map((p) => p.order))
    expect(layout.dossier.order).toBe(top)
    expect(layout['sheet:a:0'].order).toBe(0)
  })

  it('espalha os documentos na mesa, fora da caixa e sem passar da borda', () => {
    const spots = spreadPositions(items)
    for (const item of items) {
      expect(isInBox(spots[item.id].x, spots[item.id].y)).toBe(false)
      expect(clearOfBox(item, spots[item.id])).toBe(true)
      expect(onDesk(item, spots[item.id])).toBe(true)
    }
  })

  it('empurra para fora da parede um papel solto em cima da borda da caixa', () => {
    const item: ArchiveItemRef = { id: 'm', kind: 'member' }
    const near = clampToArchive('member', BOX.x + BOX.w / 2 + 0.05, BOX.y)
    expect(isInBox(near.x, near.y)).toBe(false)
    expect(clearOfBox(item, near)).toBe(true)
    const inside = clampToArchive('member', BOX.x + BOX_INTERIOR.w / 2 - 0.05, BOX.y)
    expect(insideInterior(item, inside)).toBe(true)
  })

  it('empilha dentro da caixa abaixo da borda e deixa a mesa com a altura padrão', () => {
    expect(restHeight(BOX.x, BOX.y, 0)).toBeGreaterThan(0)
    expect(restHeight(BOX.x, BOX.y, 10_000)).toBeLessThan(BOX.depth)
    expect(restHeight(BOX.x, BOX.y, 3)!).toBeGreaterThan(restHeight(BOX.x, BOX.y, 2)!)
    expect(restHeight(2, -1, 0)).toBeNull()
  })
})
