/** Chave de comparação de etiquetas: sem diferença de maiúsculas, acentos ou espaços nas pontas. */
export const tagKey = (tag: string) => tag.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')

export type TagCount = { tag: string; count: number }

/**
 * Índice de etiquetas de um conjunto de registros. Grafias que diferem só em maiúsculas ou acentos
 * contam juntas; a grafia exibida é a mais frequente. Ordena por uso e depois alfabeticamente.
 */
export function collectTags(entities: { tags: string[] }[]): TagCount[] {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>()
  for (const entity of entities) {
    const seen = new Set<string>()
    for (const tag of entity.tags.map((item) => item.trim()).filter(Boolean)) {
      const key = tagKey(tag)
      const group = groups.get(key) ?? { count: 0, spellings: new Map<string, number>() }
      if (!groups.has(key)) groups.set(key, group)
      group.spellings.set(tag, (group.spellings.get(tag) ?? 0) + 1)
      if (seen.has(key)) continue
      seen.add(key)
      group.count++
    }
  }
  return [...groups.values()]
    .map(({ count, spellings }) => ({ count, tag: [...spellings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0][0] }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'pt-BR'))
}

/** Registros que têm todas as etiquetas pedidas. */
export function filterByTags<T extends { tags: string[] }>(entities: T[], tags: string[]): T[] {
  const wanted = [...new Set(tags.map(tagKey).filter(Boolean))]
  if (!wanted.length) return entities
  return entities.filter((entity) => {
    const own = new Set(entity.tags.map(tagKey))
    return wanted.every((tag) => own.has(tag))
  })
}

/**
 * Separa termos "#etiqueta" do texto livre de uma busca. Cada termo filtra por prefixo da
 * etiqueta ("#nob" acha "nobreza"); o restante segue para a busca aproximada.
 */
export function parseTagQuery(query: string): { text: string; tagPrefixes: string[] } {
  const tagPrefixes: string[] = []
  const text = query.replace(/(^|\s)#([^\s#]+)/gu, (_, space: string, tag: string) => { tagPrefixes.push(tagKey(tag)); return space }).replace(/\s+/g, ' ').trim()
  return { text, tagPrefixes }
}

export const matchesTagPrefixes = (tags: string[], prefixes: string[]) =>
  prefixes.every((prefix) => tags.some((tag) => tagKey(tag).startsWith(prefix)))
