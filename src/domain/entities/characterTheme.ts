import { z } from 'zod'

export const CharacterThemeSchema = z.enum(['amber', 'green', 'blue', 'red', 'violet', 'cyan'])
export type CharacterTheme = z.infer<typeof CharacterThemeSchema>
export const characterThemes: { id: CharacterTheme; label: string }[] = [
  { id: 'amber', label: 'Âmbar' },
  { id: 'green', label: 'Verde' },
  { id: 'blue', label: 'Azul' },
  { id: 'red', label: 'Vermelho' },
  { id: 'violet', label: 'Violeta' },
  { id: 'cyan', label: 'Ciano' },
]
