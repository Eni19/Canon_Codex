import type { AnyExtension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Callout } from '@/components/editor/extensions/callout'
import { EntityLink } from '@/components/editor/extensions/entity-link'
import { Die } from '@/components/editor/extensions/die'
import { EntitySuggestion } from '@/components/editor/extensions/entity-suggestion'
import { Placeholder } from '@/components/editor/extensions/placeholder'
import { SlashCommand } from '@/components/editor/extensions/slash-command'
import { TextBlockBehavior } from '@/components/editor/extensions/text-block-behavior'

/** Shared between the editable ContentEditor and the read-only ContentRenderer — see ADR-004. */
export function getEditorExtensions({ editable }: { editable: boolean }): AnyExtension[] {
  const shared: AnyExtension[] = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: !editable, autolink: true },
    }),
    Image,
    Callout,
    EntityLink,
    Die,
  ]

  if (!editable) return shared

  return [
    ...shared,
    Placeholder.configure({ placeholder: "Escreva neste bloco..." }),
    TextBlockBehavior,
    SlashCommand,
    EntitySuggestion,
  ]
}
