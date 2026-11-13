import { describe, expect, it } from 'vitest'
import { CALENDAR_PRESET_THEMES, CalendarAppearanceSchema, colorContrast, resolveCalendarTheme, validateCalendarAppearanceForSave } from './calendar-appearance'

describe('calendar themes', () => {
  it('keeps text and accent readable on the three preset surfaces', () => {
    for (const theme of Object.values(CALENDAR_PRESET_THEMES)) {
      expect(colorContrast(theme.colors.text, theme.colors.surface)).toBeGreaterThanOrEqual(4.5)
      expect(colorContrast(theme.colors.accent, theme.colors.surface)).toBeGreaterThanOrEqual(4.5)
    }
    expect(resolveCalendarTheme({ activeTheme: 'celeste', customThemes: [] }).name).toBe('Celeste')
  })
  it('rejects a custom theme with illegible text or accent', () => {
    const theme = { id: '00000000-0000-4000-8000-000000000001', name: 'Teste', base: 'codex', colors: { text: '#777777', accent: '#888888', surface: '#777777', border: '#999999' }, backgroundAssetId: null, focalPoint: { x: 0.5, y: 0.5 }, overlayOpacity: 0.5 }
    const input = { activeTheme: theme.id, customThemes: [theme] }
    expect(CalendarAppearanceSchema.safeParse(input).success).toBe(true)
    expect(validateCalendarAppearanceForSave(input).success).toBe(false)
  })
})
