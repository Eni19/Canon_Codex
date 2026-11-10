'use client'

import { useEffect, useRef, useState, type DragEvent, type SyntheticEvent } from 'react'
import { animate } from 'animejs'
import { ImagePlus, Loader2, RefreshCw, X } from 'lucide-react'
import { assetVariantUrl } from '@/lib/assetUrl'
import { cn } from '@/lib/utils'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

/**
 * Image input that works before the record exists: the file goes to the world's asset store
 * (`/api/assets`) as soon as it is chosen and only its id is submitted with the form.
 * The local preview shows immediately, so the upload never feels like a wait.
 */
export function ImageField({
  name,
  label,
  hint,
  initialAssetId,
  onChange,
  contain = false,
  aspect = 'aspect-4/3',
}: {
  name: string
  label: string
  hint?: string
  initialAssetId?: string
  onChange?: (assetId: string | null) => void
  contain?: boolean
  aspect?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [assetId, setAssetId] = useState<string | null>(initialAssetId ?? null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview) }, [localPreview])

  function commit(next: string | null) {
    setAssetId(next)
    onChange?.(next)
  }

  async function upload(file: File) {
    if (!ACCEPT.split(',').includes(file.type)) {
      setError('Use uma imagem PNG, JPEG, WebP ou GIF.')
      return
    }
    setError(null)
    setLocalPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch('/api/assets', { method: 'POST', body })
      const result: { assetId?: string; error?: string } = await response.json()
      if (!response.ok || !result.assetId) throw new Error(result.error)
      commit(result.assetId)
    } catch {
      setLocalPreview(null)
      setError('Não foi possível enviar a imagem. Tente novamente.')
    } finally {
      setUploading(false)
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) void upload(file)
  }

  const src = localPreview ?? (assetId ? assetVariantUrl(assetId, 'thumbnail') : null)

  // Only a freshly chosen file is revealed; stored images just appear, without a flash.
  function revealPreview(event: SyntheticEvent<HTMLImageElement>) {
    if (!localPreview || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    animate(event.currentTarget, { opacity: { from: 0, to: 1, duration: 360, ease: 'outQuad' }, scale: { from: 1.04, to: 1, duration: 700, ease: 'outExpo' } })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {src && !uploading && (
          <span className="flex gap-1">
            <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"><RefreshCw className="size-3"/>Trocar</button>
            <button type="button" onClick={() => { setLocalPreview(null); commit(null) }} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-destructive"><X className="size-3"/>Remover</button>
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-label={src ? `Trocar ${label.toLowerCase()}` : `Escolher ${label.toLowerCase()}`}
        className={cn(
          'group/image relative w-full overflow-hidden rounded-lg bg-muted transition-[box-shadow,background-color] duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          aspect,
          dragging ? 'bg-primary/10 ring-2 ring-primary' : 'hover:bg-accent/60',
        )}
      >
        {src ? (
          // Plain <img>: blob previews and cookie-protected asset URLs both bypass next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            onLoad={revealPreview}
            className={cn(
              'absolute inset-0 size-full transition-[opacity,filter] duration-300',
              contain ? 'object-contain p-4' : 'object-cover',
              uploading && 'opacity-60 blur-[2px]',
            )}
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground transition-colors group-hover/image:text-foreground">
            <ImagePlus className="size-6 transition-transform duration-200 ease-out group-hover/image:-translate-y-0.5" aria-hidden/>
            <span className="text-xs">{dragging ? 'Solte para enviar' : 'Clique ou arraste uma imagem'}</span>
          </span>
        )}
        {uploading && <span className="absolute inset-0 grid place-items-center"><Loader2 className="size-5 animate-spin text-primary" aria-label="Enviando imagem"/></span>}
      </button>

      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = '' }}/>
      <input type="hidden" name={name} value={assetId ?? ''}/>
    </div>
  )
}
