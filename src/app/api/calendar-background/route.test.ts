import sharp from 'sharp'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ worldId: 'world-a', importFromBuffer: vi.fn(), prepareCalendarBackground: vi.fn(), removeAsset: vi.fn() }))
vi.mock('@/services/worlds/getCurrentWorld', () => ({ getCurrentWorld: async () => ({ id: mocks.worldId }) }))
vi.mock('@/repositories', () => ({ getAssetStore: () => ({ importFromBuffer: mocks.importFromBuffer, prepareCalendarBackground: mocks.prepareCalendarBackground, removeAsset: mocks.removeAsset }) }))
import { POST } from './route'

describe('calendar background upload', () => {
  beforeEach(() => { mocks.worldId = 'world-a'; mocks.importFromBuffer.mockReset(); mocks.prepareCalendarBackground.mockReset(); mocks.removeAsset.mockReset() })
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
    mocks.prepareCalendarBackground.mockResolvedValue(undefined)
    const response = await POST(await request('world-a'))
    expect(response.status).toBe(200)
    expect(mocks.prepareCalendarBackground).toHaveBeenCalledWith('world-a', 'asset-a')
  })
  it('moves an unsuccessful import to the trash', async () => {
    mocks.importFromBuffer.mockResolvedValue({ id: 'asset-a' })
    mocks.prepareCalendarBackground.mockRejectedValue(new Error('processing failed'))
    mocks.removeAsset.mockResolvedValue(undefined)
    expect((await POST(await request('world-a'))).status).toBe(500)
    expect(mocks.removeAsset).toHaveBeenCalledWith('world-a', 'asset-a')
  })
})
