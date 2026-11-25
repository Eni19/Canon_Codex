import sharp from 'sharp'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ worldId: 'world-a', importFromBuffer: vi.fn() }))
vi.mock('@/services/worlds/getCurrentWorld', () => ({ getCurrentWorld: async () => ({ id: mocks.worldId }) }))
vi.mock('@/repositories', () => ({ getAssetStore: () => ({ importFromBuffer: mocks.importFromBuffer }) }))
import { POST } from './route'

describe('calendar background upload', () => {
  beforeEach(() => { mocks.worldId = 'world-a'; mocks.importFromBuffer.mockReset() })
  async function request(worldId: string) {
    const bytes = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#123456' } }).png().toBuffer()
    const form = new FormData()
    form.set('worldId', worldId)
    form.set('file', new File([new Uint8Array(bytes)], 'sintetico.png', { type: 'image/png' }))
    return new Request('http://localhost/api/calendar-background', { method: 'POST', body: form })
  }
  it('checks the active world before importing', async () => {
    const response = await POST(await request('world-b'))
    expect(response.status).toBe(409)
    expect(mocks.importFromBuffer).not.toHaveBeenCalled()
  })
  it('creates the asset and both calendar variants', async () => {
    mocks.importFromBuffer.mockResolvedValue({ id: 'asset-a' })
    const response = await POST(await request('world-a'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ assetId: 'asset-a' })
    expect(mocks.importFromBuffer).toHaveBeenCalledWith('world-a', expect.any(Buffer), 'sintetico.png', 'image/png', 'calendar-background')
  })
  it('returns an error when the combined import fails', async () => {
    mocks.importFromBuffer.mockRejectedValue(new Error('processing failed'))
    expect((await POST(await request('world-a'))).status).toBe(500)
  })
})
