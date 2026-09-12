import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * Minimal ghost-text placeholder for empty text blocks. Implemented locally instead of pulling
 * in `@tiptap/extensions` for a single small feature — see the package resolution note this
 * avoided in the git history / PR description.
 */
export const Placeholder = Extension.create<{ placeholder: string }>({
  name: 'placeholder',

  addOptions() {
    return { placeholder: 'Escreva algo...' }
  },

  addProseMirrorPlugins() {
    const placeholder = this.options.placeholder

    return [
      new Plugin({
        key: new PluginKey('placeholder'),
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = []
            state.doc.descendants((node, position) => {
              if (node.isTextblock && node.content.size === 0) {
                decorations.push(Decoration.node(position, position + node.nodeSize, {
                  class: 'is-editor-empty',
                  'data-placeholder': placeholder,
                }))
              }
            })
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
