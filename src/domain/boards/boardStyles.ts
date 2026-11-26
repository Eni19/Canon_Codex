import type { BoardColor, BoardFont, BoardSize } from './boardCanvas'

/** Paleta escura do tldraw 5.4.1 (`defaultThemes`), usada porque o Quadro sempre abre no tema escuro. */
export const BOARD_PALETTE: Record<BoardColor, { solid: string; semi: string; pattern: string; noteFill: string; noteText: string; highlight: string }> = {
  black: { solid: '#f2f2f2', semi: '#2c3036', pattern: '#989898', noteFill: '#2c2c2c', noteText: '#f2f2f2', highlight: '#d2b700' },
  blue: { solid: '#4f72fc', semi: '#262d40', pattern: '#3a4b9e', noteFill: '#2A3F98', noteText: '#f2f2f2', highlight: '#0079d2' },
  green: { solid: '#099268', semi: '#253231', pattern: '#366a53', noteFill: '#014429', noteText: '#f2f2f2', highlight: '#009774' },
  grey: { solid: '#9398b0', semi: '#33373c', pattern: '#7c8187', noteFill: '#56595F', noteText: '#f2f2f2', highlight: '#9cb4cb' },
  'light-blue': { solid: '#4dabf7', semi: '#2a3642', pattern: '#4d7aa9', noteFill: '#1F5495', noteText: '#f2f2f2', highlight: '#00bdc8' },
  'light-green': { solid: '#40c057', semi: '#2a3830', pattern: '#4e874e', noteFill: '#21581D', noteText: '#f2f2f2', highlight: '#00a000' },
  'light-red': { solid: '#ff8787', semi: '#3c2b2b', pattern: '#a56767', noteFill: '#7a3333', noteText: '#f2f2f2', highlight: '#db005b' },
  'light-violet': { solid: '#e599f7', semi: '#383442', pattern: '#9770a9', noteFill: '#762F8E', noteText: '#f2f2f2', highlight: '#c400c7' },
  orange: { solid: '#f76707', semi: '#3b2e27', pattern: '#9f552d', noteFill: '#7c3905', noteText: '#f2f2f2', highlight: '#d07a00' },
  red: { solid: '#e03131', semi: '#382726', pattern: '#8f3734', noteFill: '#7e201f', noteText: '#f2f2f2', highlight: '#de002c' },
  violet: { solid: '#ae3ec9', semi: '#342938', pattern: '#763a8b', noteFill: '#5f1c70', noteText: '#f2f2f2', highlight: '#9e00ee' },
  yellow: { solid: '#ffc034', semi: '#3b352b', pattern: '#fecb92', noteFill: '#8a5e1c', noteText: '#f2f2f2', highlight: '#d2b700' },
  white: { solid: '#f3f3f3', semi: '#f5f5f5', pattern: '#f9f9f9', noteFill: '#eaeaea', noteText: '#1d1d1d', highlight: '#ffffff' },
}
export const BOARD_BACKGROUND = 'hsl(240, 5%, 6.5%)'

/** `fontSize` do tema (16) × `FONT_SIZES` e `ARROW_LABEL_FONT_SIZES` do tldraw. */
export const TEXT_FONT_SIZES: Record<BoardSize, number> = { s: 18, m: 24, l: 36, xl: 44 }
export const ARROW_LABEL_FONT_SIZES: Record<BoardSize, number> = { s: 18, m: 20, l: 24, xl: 28 }
export const TEXT_LINE_HEIGHT = 1.35
export const ARROW_LABEL_PADDING = 4.25

/** Variável CSS de cada fonte do tldraw, servidas pelo próprio app (`board-fonts.ts`). */
export const BOARD_FONT_VARIABLES: Record<BoardFont, string> = {
  draw: '--board-font-draw', sans: '--board-font-sans', serif: '--board-font-serif', mono: '--board-font-mono',
}
