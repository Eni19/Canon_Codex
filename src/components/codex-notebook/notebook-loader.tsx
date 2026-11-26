'use client'

import dynamic from 'next/dynamic'
import { NotebookLoading } from './notebook-loading'

/**
 * The notebook is a WebGL scene with browser-only state (session, GPU pictures), so it is rendered
 * only in the browser; the server sends the data it needs.
 */
export const NotebookLoader = dynamic(() => import('./notebook').then((module) => module.Notebook), {
  ssr: false,
  // The same loading screen the notebook keeps until it is ready, so it shows from the first moment.
  loading: () => <NotebookLoading/>,
})
