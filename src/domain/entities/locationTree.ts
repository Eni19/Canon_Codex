/**
 * Location hierarchy built from each location's `parentLocation` reference. Every location with
 * sublocations is a division of its own: a region lists only its direct children, and deeper
 * levels live inside the child that contains them.
 */
export interface LocationNode<T> {
  item: T
  children: LocationNode<T>[]
}

/**
 * Builds the forest. A location is a root when it has no parent, points at itself, or points at a
 * missing record. Cycles (A → B → A) cannot hang the tree: the first member reached stays, and a
 * cycle with no outside root is broken at its alphabetically first member so no record vanishes.
 */
export function buildLocationTree<T extends { id: string; title: string }>(
  items: T[],
  parentOf: (item: T) => string | undefined,
  compare: (a: T, b: T) => number,
): LocationNode<T>[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  const childrenOf = new Map<string, T[]>()
  const isRoot = (item: T) => {
    const parent = parentOf(item)
    return !parent || parent === item.id || !byId.has(parent)
  }
  for (const item of items) {
    if (isRoot(item)) continue
    const parent = parentOf(item)!
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), item])
  }

  const placed = new Set<string>()
  const grow = (item: T): LocationNode<T> => {
    placed.add(item.id)
    const children = [...(childrenOf.get(item.id) ?? [])]
      .sort(compare)
      .flatMap((child) => (placed.has(child.id) ? [] : [grow(child)]))
    return { item, children }
  }

  const roots = items.filter(isRoot).sort(compare).map(grow)
  // Whatever is left belongs to a parent cycle with no way up to a root.
  for (const item of [...items].sort(compare)) {
    if (!placed.has(item.id)) roots.push(grow(item))
  }
  return roots.sort((a, b) => compare(a.item, b.item))
}

/**
 * Keeps the nodes a search should show: a matching node keeps its whole subtree; otherwise a node
 * stays only as the path to matching descendants.
 */
export function filterLocationTree<T>(nodes: LocationNode<T>[], matches: (item: T) => boolean): LocationNode<T>[] {
  return nodes.flatMap((node) => {
    if (matches(node.item)) return [node]
    const children = filterLocationTree(node.children, matches)
    return children.length > 0 ? [{ item: node.item, children }] : []
  })
}
