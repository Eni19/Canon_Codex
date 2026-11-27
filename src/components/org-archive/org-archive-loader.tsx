'use client'

import dynamic from 'next/dynamic'

/**
 * A caixa-arquivo é uma cena WebGL com estado só do navegador (arrumação salva, texturas pintadas
 * em canvas), então é carregada apenas no navegador; o servidor envia os dados e os painéis prontos.
 */
export const OrgArchiveLoader = dynamic(() => import('./org-archive').then((module) => module.OrgArchive), {
  ssr: false,
  loading: () => <div style={{ height: '100dvh', background: '#15110d' }}/>,
})
