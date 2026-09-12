'use client'

import { useEffect } from 'react'

export function PageScrollLock() {
  useEffect(() => {
    const main = document.querySelector('main')
    const roots = [document.documentElement, document.body, ...(main instanceof HTMLElement ? [main] : [])]
    const previous = roots.map((element) => element.style.overflow)
    roots.forEach((element) => { element.style.overflow = 'hidden' })
    return () => { roots.forEach((element, index) => { element.style.overflow = previous[index] }) }
  }, [])

  return null
}
