'use client'

import dynamic from 'next/dynamic'

/**
 * A bancada é uma cena WebGL com estado só do navegador (arrumação salva, texturas pintadas em
 * canvas), então é carregada apenas no navegador; o servidor envia os dados e os painéis prontos.
 */
export const ObjectBenchLoader = dynamic(() => import('./object-bench').then((module) => module.ObjectBench), {
  ssr: false,
  loading: () => <div style={{ height: '100dvh', background: '#2a2d2f' }}/>,
})
