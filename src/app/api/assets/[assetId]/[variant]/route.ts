import { NextResponse } from 'next/server'
import { AssetVariantSchema } from '@/domain/assets/asset'
import { getAssetStore } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export async function GET(_request: Request, ctx: RouteContext<'/api/assets/[assetId]/[variant]'>) {
  const { assetId, variant: rawVariant } = await ctx.params
  const parsedVariant = AssetVariantSchema.safeParse(rawVariant)
  if (!parsedVariant.success) return new NextResponse('Invalid variant', { status: 400 })

  const world = await getCurrentWorld()
  const variant = await getAssetStore().getVariant(world.id, assetId, parsedVariant.data)
  if (!variant) return new NextResponse('Not found', { status: 404 })

  return new NextResponse(new Uint8Array(variant.bytes), {
    headers: {
      'Content-Type': variant.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
