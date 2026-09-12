import { mergeAttributes, Node } from '@tiptap/core'

export const Die = Node.create({
  name: 'die',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return { sides: { default: 6 } }
  },

  parseHTML() {
    return [{ tag: 'span[data-die]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const sides = Number(HTMLAttributes.sides)
    return ['span', mergeAttributes(HTMLAttributes, { 'data-die': sides, class: 'content-die' }), String(sides)]
  },

  renderText({ node }) {
    return `d${node.attrs.sides}`
  },
})
