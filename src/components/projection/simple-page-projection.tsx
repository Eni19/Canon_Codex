'use client'

import type { ReactNode } from 'react'
import { Maximize, X } from 'lucide-react'
import styles from './simple-page-projection.module.css'

export function SimplePageProjection({ children }: { children: ReactNode }) {
  return (
    <main className={styles.shell}>
      <div className={styles.content}>{children}</div>
      <div className={styles.controls} aria-label="Controles da projeção">
        <button type="button" onClick={() => document.documentElement.requestFullscreen()} title="Tela cheia">
          <Maximize />
        </button>
        <button type="button" onClick={() => window.close()} title="Fechar projeção">
          <X />
        </button>
      </div>
    </main>
  )
}
