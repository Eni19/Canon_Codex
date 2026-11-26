type Node = { type?: string; attrs?: { level?: unknown }; text?: string; content?: Node[] }

const textOf = (node: Node): string => node.text ?? (node.content ?? []).map(textOf).join('')

/**
 * Seções de uma página de conteúdo: os títulos de nível 1 e 2 no primeiro nível do documento
 * Tiptap, na ordem em que aparecem. `index` é a posição do título entre todos os h1/h2 da
 * página renderizada, para localizar o elemento sem gravar âncoras no documento.
 */
export function contentSections(body: unknown): { index: number; title: string; level: 1 | 2 }[] {
  const nodes = (body as Node | null)?.content
  if (!Array.isArray(nodes)) return []
  const sections: { index: number; title: string; level: 1 | 2 }[] = []
  let index = 0
  for (const node of nodes) {
    if (node?.type !== 'heading' || (node.attrs?.level !== 1 && node.attrs?.level !== 2)) continue
    const title = textOf(node).replace(/\s+/g, ' ').trim()
    if (title) sections.push({ index, title, level: node.attrs.level })
    index++
  }
  return sections
}
