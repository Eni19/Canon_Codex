import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import { createSuggestionRender } from '@/components/editor/suggestion-menu'
import { EntitySuggestionMenu } from '@/components/editor/entity-suggestion-menu'
import type { SearchResultItem } from '@/services/search/searchEntities'

/** Typing "@" searches entities and inserts an EntityLink node — see ADR-004. */
export const EntitySuggestion = Extension.create({
  name: 'entitySuggestion',

  addOptions() {
    return {
      suggestion: {
        char: '@',
        startOfLine: false,
        items: async ({ query }: { query: string }): Promise<SearchResultItem[]> => {
          const response = await fetch(`/api/entities/search?q=${encodeURIComponent(query)}`)
          if (!response.ok) return []
          return (await response.json()) as SearchResultItem[]
        },
        render: createSuggestionRender(EntitySuggestionMenu),
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SearchResultItem }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({ type: 'entityLink', attrs: { entityId: props.id, label: props.title } })
            .insertContent(' ')
            .run()
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey('entitySuggestion'),
        ...this.options.suggestion,
      }),
    ]
  },
})
