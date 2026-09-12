import { Extension } from '@tiptap/core'

/** Paragraphs are explicit text blocks: Enter adds a line; the + button adds another block. */
export const TextBlockBehavior = Extension.create({
  name: 'textBlockBehavior',

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        if (!this.editor.isActive('paragraph')) return false
        return this.editor.commands.setHardBreak()
      },
    }
  },
})
