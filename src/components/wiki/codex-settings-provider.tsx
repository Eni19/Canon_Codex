'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { updateWorldPreferencesAction } from '@/app/actions/world-preferences'
import { CodexSettingsDialog } from '@/components/wiki/codex-settings-dialog'
import type { EntityTypeDefinition } from '@/domain/entities/entityType'
import type { WorldPreferences } from '@/domain/worlds/worldPreferences'

/** Onde a antiga opção "Personalizar guias" guardava os tipos escondidos, só neste navegador. */
const LEGACY_HIDDEN_GUIDES_KEY = 'canon-codex:hidden-guides'

const CodexSettingsContext = createContext<{ openSettings: () => void }>({ openSettings: () => {} })
export const useCodexSettings = () => useContext(CodexSettingsContext)

/**
 * Janela de configurações do Codex, uma só para a barra lateral e o menu móvel. Na primeira vez,
 * traz para o Codex os tipos que este navegador escondia com a antiga "Personalizar guias".
 */
export function CodexSettingsProvider({ worldId, entityTypes, preferences, children }: {
  worldId: string
  entityTypes: EntityTypeDefinition[]
  preferences: WorldPreferences
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const openSettings = useCallback(() => setOpen(true), [])

  useEffect(() => {
    let legacy: string[] = []
    try {
      const raw = window.localStorage.getItem(LEGACY_HIDDEN_GUIDES_KEY)
      if (raw === null) return
      window.localStorage.removeItem(LEGACY_HIDDEN_GUIDES_KEY)
      const parsed: unknown = JSON.parse(raw)
      legacy = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
    } catch { return }
    const missing = legacy.filter((id) => !preferences.hiddenEntityTypes.includes(id))
    if (missing.length) void updateWorldPreferencesAction(worldId, { ...preferences, hiddenEntityTypes: [...preferences.hiddenEntityTypes, ...missing] })
  // Só na montagem: a importação é única.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(() => ({ openSettings }), [openSettings])
  return <CodexSettingsContext.Provider value={value}>
    {children}
    <CodexSettingsDialog open={open} onOpenChange={setOpen} worldId={worldId} entityTypes={entityTypes} preferences={preferences} />
  </CodexSettingsContext.Provider>
}
