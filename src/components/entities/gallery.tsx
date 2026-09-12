import Image from 'next/image'
import { assetVariantUrl } from '@/lib/assetUrl'

export function Gallery({ assetIds }: { assetIds: string[] }) {
  if (assetIds.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {assetIds.map((assetId) => (
        <div key={assetId} className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
          <Image src={assetVariantUrl(assetId, 'thumbnail')} alt="" fill sizes="200px" className="object-cover" />
        </div>
      ))}
    </div>
  )
}
