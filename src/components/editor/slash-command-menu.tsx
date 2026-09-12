'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { SuggestionMenuHandle, SuggestionMenuProps } from '@/components/editor/suggestion-menu'
import type { SlashCommandItem } from '@/components/editor/extensions/slash-command'

export const SlashCommandMenu = forwardRef<SuggestionMenuHandle, SuggestionMenuProps<SlashCommandItem>>(
  function SlashCommandMenu({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [openSubmenu, setOpenSubmenu] = useState<number | null>(null)

    useEffect(() => { setSelectedIndex(0); setOpenSubmenu(null) }, [items])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowDown') {
          setSelectedIndex((index) => (index + 1) % Math.max(items.length, 1))
          return true
        }
        if (event.key === 'ArrowUp') {
          setSelectedIndex((index) => (index - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1))
          return true
        }
        if (event.key === 'Enter') {
          const selected = items[selectedIndex]
          if (selected?.children) setOpenSubmenu(selectedIndex)
          else if (selected) command(selected)
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="w-64 rounded-md border border-border bg-popover p-2 text-sm text-muted-foreground shadow-md">
          Nenhum comando encontrado.
        </div>
      )
    }

    return (
      <div className="w-64 overflow-visible rounded-md border border-border bg-popover p-1 shadow-md">
        {items.map((item, index) => {
          const Icon = item.icon
          return (
            <div key={item.title} className="relative" onMouseEnter={() => { setSelectedIndex(index); setOpenSubmenu(item.children ? index : null) }}>
              <button type="button"
                className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${index === selectedIndex ? 'bg-accent text-accent-foreground' : ''}`}
                onClick={() => item.children ? setOpenSubmenu(index) : command(item)}>
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">{item.description}</span>
                </span>
                {item.children && <ChevronRight className="size-4 shrink-0" />}
              </button>
              {item.children && openSubmenu === index && (
                <div className="absolute top-0 left-full ml-1 grid w-32 grid-cols-2 gap-1 rounded-md border border-border bg-popover p-1 shadow-md">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon
                    return <button key={child.title} type="button" className="flex items-center gap-1.5 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground" onClick={() => command(child)}>
                      <ChildIcon className="size-4 text-muted-foreground" /><span>{child.title}</span>
                    </button>
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  },
)
