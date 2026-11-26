'use client'

import dynamic from 'next/dynamic'

/**
 * A parede é uma cena WebGL com estado só do navegador (arrumação salva, texturas pintadas em
 * canvas), então é carregada apenas no navegador; o servidor envia os dados e os painéis prontos.
 */
export const EvidenceWallLoader = dynamic(() => import('./evidence-wall').then((module) => module.EvidenceWall), {
  ssr: false,
  loading: () => <div style={{ height: '100dvh', background: '#14110e' }}/>,
})
