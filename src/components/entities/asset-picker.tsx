'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { ImagePlus } from 'lucide-react'
import { assetVariantUrl } from '@/lib/assetUrl'

export function AssetPicker({
  currentAssetId,
  importAction,
  contain = false,
}: {
  currentAssetId?: string
  importAction: (formData: FormData) => void | Promise<void>
  contain?: boolean
}) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form ref={formRef} action={importAction} className="flex items-center gap-4">
      <div className="relative flex aspect-4/3 w-40 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
        {currentAssetId ? (
          <Image src={assetVariantUrl(currentAssetId, 'thumbnail')} alt="" fill sizes="160px" className={contain ? 'object-contain p-3' : 'object-cover'} />
        ) : (
          <ImagePlus className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
        <ImagePlus className="size-4" />
        {currentAssetId ? 'Trocar imagem' : 'Importar imagem'}
        <input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={() => formRef.current?.requestSubmit()} />
      </label>
    </form>
  )
}
