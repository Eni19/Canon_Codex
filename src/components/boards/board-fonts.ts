import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Serif, Shantell_Sans } from 'next/font/google'

// As mesmas famílias do tldraw (draw, sans, serif, mono). O next/font baixa os arquivos no build
// e o app os serve sozinho, sem o CDN do tldraw.
const draw = Shantell_Sans({ subsets: ['latin'], variable: '--board-font-draw', weight: ['400', '700'], display: 'block' })
const sans = IBM_Plex_Sans({ subsets: ['latin'], variable: '--board-font-sans', weight: ['400', '700'], display: 'block' })
const serif = IBM_Plex_Serif({ subsets: ['latin'], variable: '--board-font-serif', weight: ['400', '700'], display: 'block' })
const mono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--board-font-mono', weight: ['400', '700'], display: 'block' })

export const boardFontVariables = [draw.variable, sans.variable, serif.variable, mono.variable].join(' ')
