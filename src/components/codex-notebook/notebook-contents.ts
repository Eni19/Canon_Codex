/**
 * What the Codex notebook holds, as a list of spreads (two facing pages). The first spread is a
 * preface about the world, then one spread per record type the world shows in its sidebar, then the
 * tools. The cover, before the first spread, is the index. Rendering lives in notebook-pages.tsx.
 */
export interface NotebookRecord {
  id: string
  title: string
  coverAssetId?: string
}

export interface NotebookType {
  id: string
  label: string
  pluralLabel: string
  icon: string
  count: number
  recent: NotebookRecord[]
}

export type Spread =
  | { id: 'preface'; kind: 'preface'; tab: string }
  | { id: string; kind: 'type'; tab: string; type: NotebookType }
  | { id: 'tools'; kind: 'tools'; tab: string }

/** The record types readers reach for first open the notebook, in this order. */
const LEADING_TYPES = ['character', 'location', 'organization', 'creature', 'species', 'artifact', 'cosmology', 'naturalScience', 'event', 'tale']

/**
 * Páginas do caderno. Com `keepOrder`, os tipos ficam na ordem em que vieram (a escolhida nas
 * configurações do mundo); sem ela, os tipos que mais se usam abrem primeiro.
 */
export function buildSpreads(types: NotebookType[], keepOrder = false): Spread[] {
  const rank = (id: string) => {
    if (keepOrder) return 0
    const index = LEADING_TYPES.indexOf(id)
    return index === -1 ? LEADING_TYPES.length : index
  }
  const ordered = types
    .map((type, position) => ({ type, position }))
    .sort((a, b) => rank(a.type.id) - rank(b.type.id) || a.position - b.position)
    .map(({ type }) => type)
  return [
    { id: 'preface', kind: 'preface', tab: 'Prefácio' },
    ...ordered.map((type): Spread => ({ id: type.id, kind: 'type', tab: type.pluralLabel, type })),
    { id: 'tools', kind: 'tools', tab: 'Ferramentas' },
  ]
}

/** The spread named in the URL (`?pagina=<id>`), or the cover (-1) when there is none or it is unknown. */
export function spreadIndexFromParam(spreads: Spread[], param: string | string[] | undefined): number {
  const id = Array.isArray(param) ? param[0] : param
  return id ? spreads.findIndex((spread) => spread.id === id) : -1
}

/** Page numbers as printed in the corners: the preface opens on pages 1–2. */
export function pageNumbers(spreadIndex: number): [number, number] {
  return [spreadIndex * 2 + 1, spreadIndex * 2 + 2]
}

export function formatRecordCount(count: number): string {
  return `${count} ${count === 1 ? 'registro' : 'registros'}`
}

/** Small deterministic random, so a page's collage keeps its layout between renders. */
export function seededRandom(seed: string) {
  let value = 0
  for (const char of seed) value = (value * 31 + char.charCodeAt(0)) % 2147483647
  value = value || 1
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}
