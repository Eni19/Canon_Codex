import { describe, expect, it } from 'vitest'
import { buildLocationTree, filterLocationTree, type LocationNode } from './locationTree'

type Place = { id: string; title: string; parent?: string }
const place = (id: string, parent?: string): Place => ({ id, title: id, parent })
const build = (items: Place[]) => buildLocationTree(items, (item) => item.parent, (a, b) => a.title.localeCompare(b.title))
const shape = (nodes: LocationNode<Place>[]): unknown => nodes.map((node) => node.children.length ? { [node.item.id]: shape(node.children) } : node.item.id)

describe('buildLocationTree', () => {
  it('nests a sub-subregion inside its subregion, not in the original region', () => {
    const tree = build([place('Reino'), place('Ducado', 'Reino'), place('Vila', 'Ducado'), place('Porto', 'Reino')])
    expect(shape(tree)).toEqual([{ Reino: [{ Ducado: ['Vila'] }, 'Porto'] }])
  })

  it('treats self references and missing parents as roots', () => {
    const tree = build([place('Ilha', 'Ilha'), place('Torre', 'apagado')])
    expect(shape(tree)).toEqual(['Ilha', 'Torre'])
  })

  it('keeps every record when parents form a cycle', () => {
    // A and B point at each other, so neither is a root; the cycle breaks at A (first by name).
    const tree = build([place('A', 'B'), place('B', 'A'), place('C', 'A')])
    expect(shape(tree)).toEqual([{ A: ['B', 'C'] }])
  })
})

describe('filterLocationTree', () => {
  const tree = build([place('Reino'), place('Ducado', 'Reino'), place('Vila', 'Ducado'), place('Porto', 'Reino'), place('Deserto')])

  it('keeps only the path to a deep match', () => {
    expect(shape(filterLocationTree(tree, (item) => item.id === 'Vila'))).toEqual([{ Reino: [{ Ducado: ['Vila'] }] }])
  })

  it('keeps the whole subtree of a matching division', () => {
    expect(shape(filterLocationTree(tree, (item) => item.id === 'Ducado'))).toEqual([{ Reino: [{ Ducado: ['Vila'] }] }])
    expect(shape(filterLocationTree(tree, (item) => item.id === 'Reino'))).toEqual([{ Reino: [{ Ducado: ['Vila'] }, 'Porto'] }])
  })
})
