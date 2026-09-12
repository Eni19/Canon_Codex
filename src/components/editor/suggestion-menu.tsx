import { ReactRenderer } from '@tiptap/react'
import type { ForwardRefExoticComponent, RefAttributes } from 'react'
import type { SuggestionKeyDownProps, SuggestionOptions } from '@tiptap/suggestion'

export interface SuggestionMenuProps<Item> {
  items: Item[]
  command: (item: Item) => void
}

export interface SuggestionMenuHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

type MenuComponent<Item> = ForwardRefExoticComponent<SuggestionMenuProps<Item> & RefAttributes<SuggestionMenuHandle>>

/**
 * Shared render() plumbing for Tiptap suggestion popups (slash menu, @-entity search): mounts a
 * React component via ReactRenderer and lets the Suggestion plugin own positioning/dismissal.
 */
export function createSuggestionRender<Item>(MenuComponent: MenuComponent<Item>): SuggestionOptions<Item>['render'] {
  return () => {
    let component: ReactRenderer<SuggestionMenuHandle, SuggestionMenuProps<Item>> | null = null
    let unmount: (() => void) | null = null

    return {
      onStart: (props) => {
        component = new ReactRenderer(MenuComponent, {
          props: { items: props.items, command: props.command },
          editor: props.editor,
        })
        if (!props.clientRect) return
        unmount = props.mount(component.element as HTMLElement)
      },
      onUpdate: (props) => {
        component?.updateProps({ items: props.items, command: props.command })
      },
      onKeyDown: (props) => {
        if (props.event.key === 'Escape') {
          unmount?.()
          return true
        }
        return component?.ref?.onKeyDown(props) ?? false
      },
      onExit: () => {
        unmount?.()
        component?.destroy()
      },
    }
  }
}
