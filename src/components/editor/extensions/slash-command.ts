import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import {
  Heading1,
  Heading2,
  Heading3,
  Info,
  Link2,
  List,
  ListOrdered,
  type LucideIcon,
  Minus,
  OctagonAlert,
  Pilcrow,
  Quote,
  TriangleAlert,
  Dices,
} from 'lucide-react'
import { createSuggestionRender } from '@/components/editor/suggestion-menu'
import { SlashCommandMenu } from '@/components/editor/slash-command-menu'

export interface SlashCommandItem {
  title: string
  description: string
  icon: LucideIcon
  command?: (params: { editor: Editor; range: Range }) => void
  children?: SlashCommandItem[]
}

const DIE_ITEMS: SlashCommandItem[] = ([4, 6, 8, 10, 12, 20] as const).map((sides) => ({
  title: `d${sides}`,
  description: `${sides} faces`,
  icon: Dices,
  command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent([
    { type: 'die', attrs: { sides } },
    { type: 'text', text: ' ' },
  ]).run(),
}))

const COMMAND_ITEMS: SlashCommandItem[] = [
  {
    title: 'Título 1',
    description: 'Título de seção grande',
    icon: Heading1,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
  },
  {
    title: 'Título 2',
    description: 'Título de seção médio',
    icon: Heading2,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
  },
  {
    title: 'Título 3',
    description: 'Título de seção pequeno',
    icon: Heading3,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
  },
  {
    title: 'Parágrafo',
    description: 'Texto corrido',
    icon: Pilcrow,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('paragraph').run(),
  },
  {
    title: 'Lista com marcadores',
    description: 'Lista simples não ordenada',
    icon: List,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Lista numerada',
    description: 'Lista ordenada',
    icon: ListOrdered,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'Citação',
    description: 'Bloco de citação',
    icon: Quote,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: 'Callout — Informação',
    description: 'Destaque neutro',
    icon: Info,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: 'callout', attrs: { variant: 'info' }, content: [{ type: 'paragraph' }] })
        .run(),
  },
  {
    title: 'Callout — Aviso',
    description: 'Destaque de atenção',
    icon: TriangleAlert,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: 'callout', attrs: { variant: 'warning' }, content: [{ type: 'paragraph' }] })
        .run(),
  },
  {
    title: 'Callout — Perigo',
    description: 'Destaque crítico',
    icon: OctagonAlert,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: 'callout', attrs: { variant: 'danger' }, content: [{ type: 'paragraph' }] })
        .run(),
  },
  {
    title: 'Divisor',
    description: 'Linha horizontal',
    icon: Minus,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: 'Link para entidade',
    description: 'Buscar e linkar outra página',
    icon: Link2,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent('@').run(),
  },
  {
    title: 'Dado',
    description: 'Escolher o número de faces',
    icon: Dices,
    children: DIE_ITEMS,
  },
]

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        items: ({ query }: { query: string }) =>
          COMMAND_ITEMS.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())),
        render: createSuggestionRender(SlashCommandMenu),
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashCommandItem }) => {
          props.command?.({ editor, range })
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey('slashCommand'),
        ...this.options.suggestion,
      }),
    ]
  },
})
