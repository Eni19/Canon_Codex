import { getCalendarYearLength } from '@/domain/worlds/calendar'
import { MAX_CALENDAR_EXPORT_DAYS } from '@/domain/worlds/calendar-view'
import { slugify } from '@/lib/slugify'
import { renderCalendarPdf } from '@/services/worlds/calendarPdf'
import { getCurrentWorld } from '@/services/worlds/getCurrentWorld'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const value = params.get('year')
  const year = Number(value)
  if (!value || !/^-?\d+$/.test(value) || !Number.isSafeInteger(year) || Math.abs(year) > 1_000_000) {
    return new Response('Informe um ano válido para baixar o calendário.', { status: 400 })
  }

  const world = await getCurrentWorld()
  if (params.get('worldId') !== world.id) {
    return new Response('O mundo ativo mudou. Reabra o calendário antes de baixar o PDF.', { status: 409 })
  }
  if (getCalendarYearLength(world.calendar, year) > MAX_CALENDAR_EXPORT_DAYS) {
    return new Response('O PDF anual aceita anos com até 5.000 dias.', { status: 422 })
  }

  const bytes = await renderCalendarPdf(world, year)
  const filename = `calendario-${slugify(world.name).slice(0, 80) || 'mundo'}-${year}.pdf`
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
