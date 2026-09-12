export interface BoardEntitySummary {
  id: string
  type: string
  typeLabel: string
  typeIcon: string
  title: string
  subtitle?: string
  thumbnailAssetId?: string
  status?: string
  aliases: string[]
  tags: string[]
  fields: Array<{ label: string; value: string; wide?: boolean }>
}
