import { Caveat, Special_Elite } from 'next/font/google'

/** The notebook's handwriting and typewriter faces, shared by the notebook and its loading screen. */
export const hand = Caveat({ subsets: ['latin'], variable: '--font-hand' })
export const typewriter = Special_Elite({ weight: '400', subsets: ['latin'], variable: '--font-type' })
