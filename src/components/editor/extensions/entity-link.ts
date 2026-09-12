import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { EntityLinkView } from '@/components/editor/entity-link-view'

/**
 * Inline, atomic reference to another entity. Stores only `entityId` — never title/slug — so
 * renaming the target never breaks the link. See ADR-002 and ADR-004.
 */
export const EntityLink = Node.create({
  name: 'entityLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      entityId: { default: null },
      label: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-entity-link]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-entity-link': '' }), HTMLAttributes.label ?? '']
  },

  addNodeView() {
    return ReactNodeViewRenderer(EntityLinkView)
  },
})
