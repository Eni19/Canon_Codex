'use client'

import dynamic from 'next/dynamic'

/**
 * The notebook is a WebGL scene with browser-only state (session, GPU pictures), so it is rendered
 * only in the browser; the server sends the data it needs.
 */
export const NotebookLoader = dynamic(() => import('./notebook').then((module) => module.Notebook), { ssr: false })
