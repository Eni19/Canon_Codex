import { describe, expect, it } from 'vitest'
import { ARCHIVE_SIZE, ARCHIVE_THICKNESS, BOX, BOX_HOME, BOX_INTERIOR, DESK, DESK_MARGIN, clampBox, clampToArchive, defaultArchiveLayout, isInBox, ledgerPages, ledgerSpreadOf, readBoxPosition, restHeights, spreadPositions, type ArchiveItemRef, type BoxAt } from './archiveBox'

const items: ArchiveItemRef[] = [
  { id: 'dossier', kind: 'dossier' },
  ...Array.from({ length: 5 }, (_, i) => ({ id: `sheet:a:${i}`, kind: 'sheet' as const })),
  { id: 'ledger', kind: 'ledger' },
  { id: 'accordion', kind: 'accordion' },
  { id: 'charter', kind: 'charter' },
  { id: 'letters', kind: 'letters' },
  { id: 'leader:a', kind: 'polaroid' },
  { id: 'leader:b', kind: 'polaroid' },
  { id: 'leader:c', kind: 'polaroid' },
]
const elsewhere: BoxAt = { x: 1.2, y: -0.7 }

const insideInterior = (item: ArchiveItemRef, p: { x: number; y: number }, box: BoxAt = BOX_HOME) => {
  const { w, h } = ARCHIVE_SIZE[item.kind]
  return Math.abs(p.x - box.x) + w / 2 <= BOX_INTERIOR.w / 2 + 1e-9 && Math.abs(p.y - box.y) + h / 2 <= BOX_INTERIOR.h / 2 + 1e-9
}
const clearOfBox = (item: ArchiveItemRef, p: { x: number; y: number }, box: BoxAt = BOX_HOME) => {
  const { w, h } = ARCHIVE_SIZE[item.kind]
  return Math.abs(p.x - box.x) >= (BOX.w + w) / 2 - 1e-9 || Math.abs(p.y - box.y) >= (BOX.h + h) / 2 - 1e-9
}
const onDesk = (item: ArchiveItemRef, p: { x: number; y: number }) => {
  const { w, h } = ARCHIVE_SIZE[item.kind]
  return Math.abs(p.x) + w / 2 <= DESK.width / 2 - DESK_MARGIN + 1e-9 && Math.abs(p.y) + h / 2 <= DESK.height / 2 - DESK_MARGIN + 1e-9
}
const place = (layout: ReturnType<typeof defaultArchiveLayout>) => items.map((item) => ({ ...item, ...layout[item.id] }))

describe('caixa-arquivo das Organizações', () => {
  it('começa com todos os documentos dentro da caixa, com o dossiê no topo da pilha', () => {
    for (const box of [BOX_HOME, elsewhere]) {
      const layout = defaultArchiveLayout(items, box)
      for (const item of items) {
        expect(isInBox(layout[item.id].x, layout[item.id].y, box)).toBe(true)
        expect(insideInterior(item, layout[item.id], box)).toBe(true)
      }
      expect(layout.dossier.order).toBe(Math.max(...Object.values(layout).map((p) => p.order)))
      expect(layout.ledger.order).toBe(0)
    }
  })

  it('espalha os documentos na mesa, fora da caixa onde quer que ela esteja', () => {
    for (const box of [BOX_HOME, elsewhere, { x: -1.4, y: -0.8 }, { x: 0.2, y: -0.4 }, { x: 1.4, y: 0.8 }]) {
      const spots = spreadPositions(items, box)
      for (const item of items) {
        expect(isInBox(spots[item.id].x, spots[item.id].y, box)).toBe(false)
        expect(clearOfBox(item, spots[item.id], box)).toBe(true)
        expect(onDesk(item, spots[item.id])).toBe(true)
      }
    }
  })

  it('não amontoa os documentos espalhados, onde quer que a caixa esteja', () => {
    const solids = items.filter((item) => item.kind !== 'sheet')
    for (const box of [BOX_HOME, elsewhere, { x: 0.2, y: -0.4 }, { x: 1.4, y: 0.8 }]) {
      const spots = spreadPositions(items, box)
      for (const [i, a] of solids.entries()) {
        for (const b of solids.slice(i + 1)) {
          const sa = ARCHIVE_SIZE[a.kind], sb = ARCHIVE_SIZE[b.kind]
          const ox = Math.max(0, (sa.w + sb.w) / 2 - Math.abs(spots[a.id].x - spots[b.id].x))
          const oy = Math.max(0, (sa.h + sb.h) / 2 - Math.abs(spots[a.id].y - spots[b.id].y))
          // Pode encostar de leve, mas nada fica por cima de outro.
          expect(ox * oy).toBeLessThan(Math.min(sa.w * sa.h, sb.w * sb.h) * 0.15)
        }
      }
    }
  })

  it('empurra para fora da parede um papel solto em cima da borda da caixa', () => {
    const item: ArchiveItemRef = { id: 'm', kind: 'letters' }
    const near = clampToArchive('letters', BOX_HOME.x + BOX.w / 2 + 0.05, BOX_HOME.y)
    expect(isInBox(near.x, near.y)).toBe(false)
    expect(clearOfBox(item, near)).toBe(true)
    const inside = clampToArchive('letters', BOX_HOME.x + BOX_INTERIOR.w / 2 - 0.05, BOX_HOME.y)
    expect(insideInterior(item, inside)).toBe(true)
    // Quando é a caixa que chega até o papel, ele é empurrado para fora em vez de cair dentro.
    const kept = clampToArchive('letters', elsewhere.x, elsewhere.y, elsewhere, true)
    expect(clearOfBox(item, kept, elsewhere)).toBe(true)
  })

  it('mantém a caixa na mesa e lê a posição salva com segurança', () => {
    const far = clampBox(10, -10)
    expect(Math.abs(far.x) + BOX.w / 2).toBeLessThanOrEqual(DESK.width / 2)
    expect(Math.abs(far.y) + BOX.h / 2).toBeLessThanOrEqual(DESK.height / 2)
    expect(readBoxPosition({ x: 0.3, y: -0.2 })).toEqual({ x: 0.3, y: -0.2 })
    expect(readBoxPosition(null)).toEqual(BOX_HOME)
    expect(readBoxPosition({ x: 'a', y: 1 })).toEqual(BOX_HOME)
  })

  it('empilha dentro da caixa pela espessura de cada objeto, abaixo da borda', () => {
    const heights = restHeights(place(defaultArchiveLayout(items)))
    expect(heights.ledger).toBeGreaterThan(0)
    expect(heights.accordion).toBeGreaterThanOrEqual(heights.ledger + ARCHIVE_THICKNESS.ledger)
    expect(Math.max(...Object.values(heights))).toBeLessThan(BOX.depth)
  })

  it('deixa na mesa cada documento rente ao tampo e só sobe o que está por cima de outro', () => {
    const spots = spreadPositions(items)
    const placed = items.map((item, order) => ({ ...item, ...spots[item.id], order }))
    const heights = restHeights(placed)
    expect(heights.dossier).toBeLessThan(0.002)
    expect(heights.ledger).toBeLessThan(0.002)
    // As folhas em leque se sobrepõem: cada uma sobe a espessura da anterior.
    expect(heights['sheet:a:1']).toBeGreaterThan(heights['sheet:a:0'])
    expect(heights['sheet:a:1'] - heights['sheet:a:0']).toBeLessThan(0.005)
    // A ordem cresce sem limite (cada documento mexido vai para a frente); a altura, não.
    const late = restHeights([{ id: 'x', kind: 'charter', x: 2, y: 1.2, order: 5000 }])
    expect(late.x).toBeLessThan(0.002)
  })

  it('pagina o livro de registro com folha de rosto e a liderança primeiro', () => {
    const members = Array.from({ length: 30 }, (_, i) => ({ name: `m${i}`, leader: i === 20 }))
    const { pages, spreads } = ledgerPages(members, 14)
    expect(pages[0]).toEqual([])
    expect(pages[1][0].name).toBe('m20')
    expect(pages.slice(1).flat()).toHaveLength(30)
    expect(pages).toHaveLength(4)
    expect(spreads).toBe(2)
    expect(ledgerSpreadOf(0, 14)).toBe(0)
    expect(ledgerSpreadOf(14, 14)).toBe(1)
    expect(ledgerSpreadOf(28, 14)).toBe(1)
    expect(ledgerPages([], 14)).toEqual({ pages: [[], []], spreads: 1 })
  })
})
