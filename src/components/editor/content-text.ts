/**
 * Texto simples de um corpo Tiptap, em blocos, para quem precisa desenhar o conteúdo fora do
 * editor (por exemplo, as folhas da parede 3D de evidências). Só a camada do editor conhece a forma
 * do `body` (ADR-004); o resto do app recebe blocos já prontos.
 */
export type ContentTextBlock = { kind: 'heading' | 'paragraph' | 'item' | 'quote'; text: string; level?: number }

type Node = { type?: string; text?: string; attrs?: Record<string, unknown>; content?: Node[] }

const inline = (node: Node): string => {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  if (node.type === 'entityLink') return String(node.attrs?.label ?? '')
  if (node.type === 'die') return `d${node.attrs?.sides ?? 6}`
  return (node.content ?? []).map(inline).join('')
}

export function contentTextBlocks(body: unknown): ContentTextBlock[] {
  const blocks: ContentTextBlock[] = []
  const walk = (node: Node, inQuote = false) => {
    switch (node.type) {
      case 'heading':
        blocks.push({ kind: 'heading', text: inline(node), level: Number(node.attrs?.level ?? 2) })
        return
      case 'paragraph': {
        const text = inline(node)
        if (text.trim()) blocks.push({ kind: inQuote ? 'quote' : 'paragraph', text })
        return
      }
      case 'listItem':
        blocks.push({ kind: 'item', text: (node.content ?? []).map(inline).filter(Boolean).join('\n') })
        return
      case 'blockquote': case 'callout':
        for (const child of node.content ?? []) walk(child, true)
        return
      default:
        for (const child of node.content ?? []) walk(child, inQuote)
    }
  }
  if (body && typeof body === 'object') walk(body as Node)
  return blocks
}
