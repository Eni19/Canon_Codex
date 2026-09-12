import { readFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { AssetVariantSchema } from '@/domain/assets/asset'
import { getAssetStore } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export async function GET(_request: Request, ctx: RouteContext<'/api/assets/[assetId]/[variant]'>) {
  const { assetId, variant: rawVariant } = await ctx.params
  const parsedVariant = AssetVariantSchema.safeParse(rawVariant)
  if (!parsedVariant.success) return new NextResponse('Invalid variant', { status: 400 })

  const world = await getCurrentWorld()
  const assetStore = getAssetStore()
  const asset = await assetStore.getAsset(world.id, assetId)
  if (!asset) return new NextResponse('Not found', { status: 404 })

  const filePath = await assetStore.getVariantPath(world.id, assetId, parsedVariant.data)
  if (!filePath) return new NextResponse('Not found', { status: 404 })

  const file = await readFile(filePath)
  const contentType = parsedVariant.data === 'thumbnail' ? 'image/webp' : asset.mimeType

  return new NextResponse(new Uint8Array(file), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
