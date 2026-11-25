import 'server-only'
import { PDFDocument, PageSizes, StandardFonts, rgb, type PDFPage } from 'pdf-lib'
import { dateToOrdinal, formatCalendarDate, getCalendarYearLength, getMonthLength, isIntercalaryRuleActive } from '@/domain/worlds/calendar'
import { resolveCalendarTheme } from '@/domain/worlds/calendar-appearance'
import { projectCalendarLandmarks } from '@/domain/worlds/calendar-landmarks'
import { seasonAtDate } from '@/domain/worlds/calendar-season'
import { MAX_CALENDAR_EXPORT_DAYS, projectMonth } from '@/domain/worlds/calendar-view'
import type { World } from '@/domain/worlds/world'

const [pageHeight, pageWidth] = PageSizes.A4
const margin = 34
const contentWidth = pageWidth - margin * 2
const ink = rgb(0.1, 0.15, 0.22)
const paper = rgb(0.98, 0.97, 0.95)
const white = rgb(1, 1, 1)
const border = rgb(0.79, 0.8, 0.81)

function color(hex: string) {
  const number = Number.parseInt(hex.slice(1), 16)
  return rgb((number >> 16) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255)
}

export async function renderCalendarPdf(world: World, year: number) {
  const calendar = world.calendar
  const yearLength = getCalendarYearLength(calendar, year)
  if (yearLength > MAX_CALENDAR_EXPORT_DAYS) throw new RangeError('O ano excede o limite de exportação.')

  const pdf = await PDFDocument.create()
  pdf.setTitle(`Calendário de ${world.name} - ${formatCalendarDate(calendar, { year })}`)
  pdf.setLanguage('pt-BR')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const heading = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const glyphs = new Set(font.getCharacterSet())
  const colors = resolveCalendarTheme(world.calendarAppearance).colors
  const header = color(colors.surface)
  const headerInk = color(colors.text)
  const accent = color(colors.accent)
  const yearLabel = formatCalendarDate(calendar, { year })

  function text(page: PDFPage, value: string, x: number, top: number, width: number, size = 11, style = font, fill = ink) {
    let line = Array.from(value.normalize('NFC').replace(/\s+/gu, ' ').trim(), (character) => {
      if (glyphs.has(character.codePointAt(0)!)) return character
      const base = character.normalize('NFD').replace(/\p{M}/gu, '')
      return base.length === 1 && glyphs.has(base.charCodeAt(0)) ? base : '?'
    }).join('')
    if (style.widthOfTextAtSize(line, size) > width) {
      while (line && style.widthOfTextAtSize(`${line}…`, size) > width) line = line.slice(0, -1)
      line = `${line.trimEnd()}…`
    }
    page.drawText(line, { x, y: pageHeight - top - size, size, font: style, color: fill })
  }

  function box(page: PDFPage, x: number, top: number, width: number, height: number, fill: typeof ink, edge?: typeof ink) {
    page.drawRectangle({ x, y: pageHeight - top - height, width, height, color: fill, borderColor: edge, borderWidth: edge ? 0.5 : 0 })
  }

  function pageWithTitle(title: string, subtitle: string) {
    const page = pdf.addPage([pageWidth, pageHeight])
    box(page, 0, 0, pageWidth, pageHeight, paper)
    box(page, 0, 0, pageWidth, 110, header)
    box(page, 0, 110, pageWidth, 2, accent)
    text(page, world.name, margin, 16, contentWidth, 11, font, headerInk)
    text(page, title, margin, 34, contentWidth, 32, heading, headerInk)
    text(page, subtitle, margin, 77, contentWidth, 12, font, headerInk)
    text(page, String(pdf.getPageCount()).padStart(2, '0'), pageWidth - margin - 25, pageHeight - 26, 25, 9)
    return page
  }

  const first = dateToOrdinal(calendar, { year, month: 1, day: 1 })
  const landmarks = projectCalendarLandmarks(calendar, world.calendarLandmarks, first, first + yearLength - 1)
  const months = calendar.months.map(({ name }, index) => {
    const month = index + 1
    const length = getMonthLength(calendar, year, month)
    const start = dateToOrdinal(calendar, { year, month, day: 1 })
    const end = month < calendar.months.length ? dateToOrdinal(calendar, { year, month: month + 1, day: 1 }) - 1 : first + yearLength - 1
    const season = seasonAtDate(calendar, world.calendarSeasons, { year, month, day: 1 })
    const marks = landmarks.filter((mark) => mark.first <= end && mark.last >= start)
    return { name, month, length, start, season, marks }
  })

  const cardWidth = (contentWidth - 30) / 4
  for (let start = 0; start < months.length; start += 16) {
    const overview = pageWithTitle('O ano em um olhar', `${yearLabel}  ·  ${yearLength.toLocaleString('pt-BR')} dias`)
    months.slice(start, start + 16).forEach(({ name, length, season, marks }, index) => {
      const x = margin + (index % 4) * (cardWidth + 10)
      const y = 136 + Math.floor(index / 4) * 104
      box(overview, x, y, cardWidth, 94, white, border)
      box(overview, x, y, cardWidth, 3, season ? color(season.color) : accent)
      text(overview, name, x + 10, y + 12, cardWidth - 20, 17, heading)
      text(overview, `${length.toLocaleString('pt-BR')} dias`, x + 10, y + 38, cardWidth - 20)
      if (season) text(overview, season.name, x + 10, y + 55, cardWidth - 20, 10)
      if (marks.length) text(overview, marks.length === 1 ? '1 marco' : `${marks.length} marcos`, x + 10, y + 71, cardWidth - 20, 10)
    })
  }

  const cellWidth = contentWidth / 7
  for (const { name, month, length, start, marks } of months) {
    const independent = calendar.intercalaryRules.filter((rule) => rule.month === month && !rule.extendsMonth && isIntercalaryRuleActive(rule, year))
    for (let day = 1; day <= length;) {
      const window = projectMonth(calendar, year, month, day)
      const range = window.days.length === length ? `${length} dias` : `dias ${window.start} a ${window.end} de ${length}`
      const page = pageWithTitle(name, `${yearLabel}  ·  ${range}`)
      const top = 135
      calendar.daysOfWeek.forEach((weekday, index) => {
        const x = margin + index * cellWidth
        box(page, x, top, cellWidth, 26, header)
        text(page, weekday, x + 8, top + 7, cellWidth - 16, 10, font, headerInk)
      })
      const rows = Math.ceil((window.firstWeekday + window.days.length) / 7)
      const cellHeight = 59
      for (let index = 0; index < rows * 7; index++) {
        const number = window.days[index - window.firstWeekday]
        const x = margin + (index % 7) * cellWidth
        const y = top + 26 + Math.floor(index / 7) * cellHeight
        box(page, x, y, cellWidth, cellHeight, number === undefined ? paper : white, border)
        if (number === undefined) continue
        const season = seasonAtDate(calendar, world.calendarSeasons, { year, month, day: number })
        if (season) box(page, x + 0.3, y, cellWidth - 0.6, 2, color(season.color))
        text(page, String(number), x + 8, y + 8, cellWidth - 16, 16, heading)
        const ordinal = start + number - 1
        const activeMarks = marks.filter((mark) => mark.first <= ordinal && mark.last >= ordinal)
        if (activeMarks.length) text(page, activeMarks[0].title, x + 8, y + 32, cellWidth - 16, 9)
        if (activeMarks.length > 1) text(page, `+${activeMarks.length - 1} marcos`, x + 8, y + 45, cellWidth - 16, 8)
      }
      day = window.end + 1
    }

    const entries = [
      ...independent.map((rule) => `Dia intercalar: ${rule.name}`),
      ...marks.filter((mark) => month === 1 || mark.first >= start).map((mark) => {
        const day = Math.max(1, mark.first - start + 1)
        const date = day <= length ? `Dia ${day}` : independent[day - length - 1]?.name ?? 'Dia intercalar'
        return `${date} - ${mark.title}`
      }),
    ]
    for (let offset = 0; offset < entries.length; offset += 42) {
      const page = pageWithTitle(name, `${yearLabel}  ·  Marcos e dias intercalares`)
      entries.slice(offset, offset + 42).forEach((entry, index) => {
        const width = contentWidth / 2
        text(page, entry, margin + Math.floor(index / 21) * width, 136 + (index % 21) * 19, width - 12)
      })
    }
  }

  return pdf.save()
}
