'use client'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Clapperboard, Search, X } from 'lucide-react'
import { assetVariantUrl } from '@/lib/assetUrl'
import type { SceneNavigationSummary } from './scene-types'
import styles from './scene-runner.module.css'

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function ScenePicker({ scenes, currentId, onPick, onClose }: { scenes: SceneNavigationSummary[]; currentId: string; onPick: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { const timer = window.setTimeout(() => inputRef.current?.focus(), 60); return () => window.clearTimeout(timer) }, [])
  const filtered = useMemo(() => {
    const term = normalize(query.trim())
    return term ? scenes.filter((scene) => normalize(`${scene.title} ${scene.locationTitle}`).includes(term)) : scenes
  }, [scenes, query])

  return (
    <div className={styles.pickerBackdrop} onMouseDown={onClose} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
      <div className={styles.picker} role="dialog" aria-modal="true" aria-label="Escolher cena" onMouseDown={(event) => event.stopPropagation()}>
        <header className={styles.pickerHeader}>
          <span><Clapperboard />Escolher cena</span>
          <label><Search /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou local" /></label>
          <button onClick={onClose} aria-label="Fechar"><X /></button>
        </header>
        <div className={styles.pickerGrid}>
          {filtered.map((scene) => {
            const current = scene.id === currentId
            return (
              <button key={scene.id} className={styles.pickerCard} data-current={current} onClick={() => onPick(scene.id)}>
                <Image src={assetVariantUrl(scene.backgroundAssetId, 'thumbnail')} alt="" width={320} height={320} unoptimized draggable={false} />
                <span className={styles.pickerCardInfo}>
                  <small>{scene.locationTitle}</small>
                  <strong>{scene.title}</strong>
                  {scene.description && <em>{scene.description}</em>}
                </span>
                {current && <i className={styles.pickerCurrent}><Check />Atual</i>}
              </button>
            )
          })}
          {filtered.length === 0 && <p className={styles.pickerEmpty}>Nenhuma cena encontrada.</p>}
        </div>
      </div>
    </div>
  )
}
