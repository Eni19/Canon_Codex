export interface SceneEntitySummary {
  id: string; title: string; type: string; typeLabel: string; typeIcon: string; assetId?: string
  subtitle?: string; status?: string; aliases: string[]; tags: string[]
  fields: Array<{ label: string; value: string; wide?: boolean }>
}
export interface ScenePoiSummary {
  id: string; label: string; x: number; y: number; description?: string; linkedEntityId?: string
  kind: 'text' | 'evidence' | 'document'; contextualDescription?: string
  discoveries: Array<{ id: string; approach: string; condition: string; information: string }>
}
export interface SceneNavigationSummary { id: string; title: string }
