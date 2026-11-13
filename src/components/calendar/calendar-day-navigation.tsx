'use client'

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'

export function CalendarDayNavigation({ children, className, firstWeekday }: {
  children: ReactNode
  className: string
  firstWeekday: number
}) {
  const grid = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const links = grid.current?.querySelectorAll<HTMLAnchorElement>('a')
    if (!links?.length) return
    const active = [...links].find((link) => link === document.activeElement)
      ?? grid.current?.querySelector<HTMLAnchorElement>('a[aria-current]')
      ?? links[0]
    links.forEach((link) => { link.tabIndex = link === active ? 0 : -1 })
  }, [children])

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const links = [...event.currentTarget.querySelectorAll('a')]
    const index = links.findIndex((link) => link === event.target)
    if (index < 0) return
    const column = (firstWeekday + index) % 7
    let target: number
    switch (event.key) {
      case 'ArrowLeft': target = index - 1; break
      case 'ArrowRight': target = index + 1; break
      case 'ArrowUp': target = index - 7; break
      case 'ArrowDown': target = index + 7; break
      case 'Home': target = Math.max(0, index - column); break
      case 'End': target = Math.min(links.length - 1, index + 6 - column); break
      default: return
    }
    event.preventDefault()
    if (!links[target]) return
    links[index].tabIndex = -1
    links[target].tabIndex = 0
    links[target].focus()
  }

  return <div ref={grid} className={className} role="group" aria-label="Dias do mês" aria-describedby="calendar-day-keyboard" onKeyDown={moveFocus}>
    <p id="calendar-day-keyboard" className="sr-only">Use as setas para percorrer os dias deste trecho. Pressione Enter para selecionar.</p>
    {children}
  </div>
}
