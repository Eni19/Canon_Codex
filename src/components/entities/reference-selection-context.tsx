'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface ReferenceSelectionValue {
  selections: Record<string, string[]>
  setSelection: (key: string, ids: string[]) => void
}

const ReferenceSelectionContext = createContext<ReferenceSelectionValue | null>(null)

/** Shares the live selection of list fields (e.g. `members`) so dependent fields (leaders, subgroups) can offer only those items. */
export function ReferenceSelectionProvider({ initial, children }: { initial: Record<string, string[]>; children: ReactNode }) {
  const [selections, setSelections] = useState(initial)
  const setSelection = useCallback((key: string, ids: string[]) => setSelections((current) => ({ ...current, [key]: ids })), [])
  const value = useMemo(() => ({ selections, setSelection }), [selections, setSelection])
  return <ReferenceSelectionContext.Provider value={value}>{children}</ReferenceSelectionContext.Provider>
}

export function useReferenceSelection() {
  return useContext(ReferenceSelectionContext)
}
