import { NextResponse } from 'next/server'
import { isSupportedImageMimeType } from '@/domain/assets/mimeType'
import { getAssetStore } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

/** Used by the content editor's "Imagem" block to upload inline images as they're inserted. */
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!isSupportedImageMimeType(file.type)) {
    return NextResponse.json({ error: `Unsupported image type: ${file.type}` }, { status: 400 })
  }

  const world = await getCurrentWorld()
  const buffer = Buffer.from(await file.arrayBuffer())
  const asset = await getAssetStore().importFromBuffer(world.id, buffer, file.name, file.type)

  return NextResponse.json({ assetId: asset.id })
}
