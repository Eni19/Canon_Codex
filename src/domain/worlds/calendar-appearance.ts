import { z } from 'zod'

const ColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Informe uma cor hexadecimal válida.')
export function colorContrast(first: string, second: string): number {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
  }
  const a = luminance(first)
  const b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
export const CalendarThemeSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  base: z.enum(['codex', 'celeste', 'pergaminho']).nullable(),
  colors: z.object({ text: ColorSchema, accent: ColorSchema, surface: ColorSchema, border: ColorSchema }),
  backgroundAssetId: z.uuid().nullable(),
  focalPoint: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  overlayOpacity: z.number().min(0).max(1),
})

export const CalendarAppearanceSchema = z.object({
  activeTheme: z.string().min(1),
  customThemes: z.array(CalendarThemeSchema).max(100),
}).superRefine((appearance, context) => {
  const ids = new Set<string>()
  appearance.customThemes.forEach((theme, index) => {
    if (ids.has(theme.id)) context.addIssue({ code: 'custom', path: ['customThemes', index, 'id'], message: 'Os identificadores dos temas precisam ser únicos.' })
    ids.add(theme.id)
  })
  if (!['codex', 'celeste', 'pergaminho'].includes(appearance.activeTheme) && !ids.has(appearance.activeTheme)) {
    context.addIssue({ code: 'custom', path: ['activeTheme'], message: 'O tema ativo não existe.' })
  }
})
export type CalendarAppearance = z.infer<typeof CalendarAppearanceSchema>

/** Validate new edits without making older low-contrast worlds unreadable. */
export function validateCalendarAppearanceForSave(input: unknown) {
  const parsed = CalendarAppearanceSchema.safeParse(input)
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Tema inválido.' }
  for (const theme of parsed.data.customThemes) {
    if (colorContrast(theme.colors.text, theme.colors.surface) < 4.5 || colorContrast(theme.colors.accent, theme.colors.surface) < 4.5) return { success: false as const, error: `O texto e o destaque do tema ${theme.name} precisam de contraste mínimo de 4,5:1 com a superfície.` }
  }
  return { success: true as const, data: parsed.data }
}

export const CALENDAR_PRESET_THEMES = {
  codex: { name: 'Codex', colors: { text: '#f2eadc', accent: '#eac783', surface: '#211f1c', border: '#786d5d' } },
  celeste: { name: 'Celeste', colors: { text: '#f6f1e8', accent: '#e9c885', surface: '#18243a', border: '#806b4f' } },
  pergaminho: { name: 'Pergaminho', colors: { text: '#222c3a', accent: '#805019', surface: '#f6f0e4', border: '#a18e75' } },
} as const

export function resolveCalendarTheme(appearance: CalendarAppearance) {
  const custom = appearance.customThemes.find((theme) => theme.id === appearance.activeTheme)
  if (custom) return custom
  return CALENDAR_PRESET_THEMES[appearance.activeTheme as keyof typeof CALENDAR_PRESET_THEMES] ?? CALENDAR_PRESET_THEMES.codex
}
