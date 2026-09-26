'use client'
import { useMemo } from 'react'
import { Clapperboard } from 'lucide-react'
import { CardPicker } from '@/components/ui/card-picker'
import type { SceneNavigationSummary } from './scene-types'

export function ScenePicker({ scenes, currentId, onPick, onClose }: { scenes: SceneNavigationSummary[]; currentId: string; onPick: (id: string) => void; onClose: () => void }) {
  const items = useMemo(() => scenes.map((scene) => ({ id: scene.id, title: scene.title, subtitle: scene.locationTitle, description: scene.description, imageAssetId: scene.backgroundAssetId })), [scenes])
  return <CardPicker items={items} selectedIds={[currentId]} selectedLabel="Atual" title="Escolher cena" searchPlaceholder="Buscar por nome ou local" emptyMessage="Nenhuma cena encontrada." fallbackIcon={<Clapperboard />} onSelect={onPick} onClose={onClose} />
}
