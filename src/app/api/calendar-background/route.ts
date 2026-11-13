import sharp from 'sharp'
import { NextResponse } from 'next/server'
import { getAssetStore } from '@/repositories'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES + 64 * 1024) return NextResponse.json({ error: 'A imagem ultrapassa o limite de 8 MB.' }, { status: 413 })
  const form = await request.formData()
  const file = form.get('file')
  const worldId = form.get('worldId')
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES || !ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Escolha uma imagem PNG, JPEG, WebP, GIF ou AVIF de até 8 MB.' }, { status: 400 })
  const world = await getCurrentWorld()
  if (world.id !== worldId) return NextResponse.json({ error: 'O mundo ativo mudou. Reabra o calendário.' }, { status: 409 })
  const bytes = Buffer.from(await file.arrayBuffer())
  try {
    const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata()
    const types: Record<string, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', heif: 'image/avif' }
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > 40_000_000 || !metadata.format || types[metadata.format] !== file.type) throw new Error('Formato de imagem inválido.')
  } catch {
    return NextResponse.json({ error: 'A imagem é inválida ou ultrapassa o limite de 40 milhões de pixels.' }, { status: 400 })
  }
  const store = getAssetStore()
  let assetId: string | undefined
  try {
    const asset = await store.importFromBuffer(world.id, bytes, file.name, file.type)
    assetId = asset.id
    await store.prepareCalendarBackground(world.id, asset.id)
    return NextResponse.json({ assetId: asset.id })
  } catch {
    if (assetId) await store.removeAsset(world.id, assetId).catch(() => undefined)
    return NextResponse.json({ error: 'Não foi possível processar a imagem.' }, { status: 500 })
  }
}
