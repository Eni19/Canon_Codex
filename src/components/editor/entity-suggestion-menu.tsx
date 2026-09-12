'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { EntityTypeIcon } from '@/components/entities/entity-type-icon'
import type { SuggestionMenuHandle, SuggestionMenuProps } from '@/components/editor/suggestion-menu'
import type { SearchResultItem } from '@/services/search/searchEntities'

export const EntitySuggestionMenu = forwardRef<SuggestionMenuHandle, SuggestionMenuProps<SearchResultItem>>(
  function EntitySuggestionMenu({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => setSelectedIndex(0), [items])

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
          if (items[selectedIndex]) command(items[selectedIndex])
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="w-64 rounded-md border border-border bg-popover p-2 text-sm text-muted-foreground shadow-md">
          Nenhuma entidade encontrada.
        </div>
      )
    }

    return (
      <div className="w-72 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${
              index === selectedIndex ? 'bg-accent text-accent-foreground' : ''
            }`}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => command(item)}
          >
            <EntityTypeIcon name={item.typeIcon} className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{item.title}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">{item.typeLabel}</span>
          </button>
        ))}
      </div>
    )
  },
)
