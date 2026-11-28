/**
 * How record cards are drawn on this device (ADR-011): the strength of the type textures, chosen in
 * the Codex settings, and the high-contrast modes of the system. It is a display choice of the
 * person at this browser, like the colour scheme, so it lives in the browser and not in the world.
 */
export const CARD_TEXTURE_SETTINGS = ['normal', 'subtle', 'off'] as const
export type CardTextureSetting = (typeof CARD_TEXTURE_SETTINGS)[number]

export type CardDisplay = {
  /** Multiplies the opacity of every texture; 0 draws none. */
  readonly textureScale: number
  /** Thicker, text-coloured card outlines, for high-contrast modes. */
  readonly strongOutline: boolean
}

const TEXTURE_SCALE: Record<CardTextureSetting, number> = { normal: 1, subtle: 0.5, off: 0 }

/** What a setting and the system's contrast modes mean for the cards. High contrast always wins. */
export function cardDisplayFor(setting: CardTextureSetting, system: { moreContrast: boolean; forcedColors: boolean }): CardDisplay {
  const highContrast = system.moreContrast || system.forcedColors
  return { textureScale: highContrast ? 0 : TEXTURE_SCALE[setting], strongOutline: highContrast }
}

export const CARD_TEXTURE_STORAGE_KEY = 'canon-codex:card-texture'
const isSetting = (value: unknown): value is CardTextureSetting => (CARD_TEXTURE_SETTINGS as readonly unknown[]).includes(value)

/** The saved setting, or `normal` when nothing was saved or storage is unavailable. */
export function readCardTextureSetting(): CardTextureSetting {
  try {
    const value = globalThis.localStorage?.getItem(CARD_TEXTURE_STORAGE_KEY)
    return isSetting(value) ? value : 'normal'
  } catch {
    return 'normal'
  }
}

/** Saves the setting for this browser and redraws every open graph and board. */
export function writeCardTextureSetting(setting: CardTextureSetting) {
  try { globalThis.localStorage?.setItem(CARD_TEXTURE_STORAGE_KEY, setting) } catch { /* private window: applies until reload */ }
  memory = setting
  refresh()
}

let memory: CardTextureSetting | null = null
let current: CardDisplay | null = null
const listeners = new Set<() => void>()
const media = (query: string) => typeof matchMedia === 'function' ? matchMedia(query) : null

function compute(): CardDisplay {
  return cardDisplayFor(memory ?? readCardTextureSetting(), {
    moreContrast: media('(prefers-contrast: more)')?.matches ?? false,
    forcedColors: media('(forced-colors: active)')?.matches ?? false,
  })
}
function refresh() {
  current = compute()
  for (const listener of listeners) listener()
}

/** The current card display, read once and kept up to date while anything is subscribed. */
export function getCardDisplay(): CardDisplay {
  return current ??= compute()
}

/** Calls `listener` whenever the setting (in any tab) or a contrast mode changes. */
export function subscribeCardDisplay(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1 && typeof window !== 'undefined') attach()
  return () => {
    listeners.delete(listener)
    if (!listeners.size) detach?.()
  }
}

let detach: (() => void) | null = null
function attach() {
  const onStorage = (event: StorageEvent) => { if (event.key === CARD_TEXTURE_STORAGE_KEY) { memory = null; refresh() } }
  const queries = ['(prefers-contrast: more)', '(forced-colors: active)'].map(media).filter((query) => !!query)
  const onMedia = () => refresh()
  window.addEventListener('storage', onStorage)
  for (const query of queries) query.addEventListener('change', onMedia)
  detach = () => {
    window.removeEventListener('storage', onStorage)
    for (const query of queries) query.removeEventListener('change', onMedia)
    detach = null
  }
}
