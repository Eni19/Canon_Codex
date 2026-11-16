import { PDFDocument } from 'pdf-lib'
import { expect, it, vi } from 'vitest'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'
import { GET } from './route'

vi.mock('@/services/worlds/getCurrentWorld', () => ({ getCurrentWorld: vi.fn() }))

it('downloads the requested year as a PDF with one overview and all month grids', async () => {
  const world = createDefaultWorldSeed()
  world.name = 'Crônicas da Aurora'
  vi.mocked(getCurrentWorld).mockResolvedValue(world)
  const response = await GET(new Request(`http://localhost/api/calendar-pdf?year=-1&worldId=${world.id}`))
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toBe('application/pdf')
  expect(response.headers.get('content-disposition')).toBe('attachment; filename="calendario-cronicas-da-aurora--1.pdf"')
  const pdf = await PDFDocument.load(await response.arrayBuffer())
  expect(pdf.getTitle()).toContain('ano -1')
  expect(pdf.getPageCount()).toBe(1 + world.calendar.months.length)
})

it('rejects a stale world and gives an explicit limit for years too large to export', async () => {
  const world = createDefaultWorldSeed()
  world.calendar.months[0].length = 1_000_000
  vi.mocked(getCurrentWorld).mockResolvedValue(world)
  expect((await GET(new Request('http://localhost/api/calendar-pdf?year=0&worldId=outro'))).status).toBe(409)
  expect((await GET(new Request(`http://localhost/api/calendar-pdf?year=0&worldId=${world.id}`))).status).toBe(422)
  expect((await GET(new Request(`http://localhost/api/calendar-pdf?year=&worldId=${world.id}`))).status).toBe(400)
})
