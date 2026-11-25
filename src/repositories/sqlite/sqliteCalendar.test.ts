import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emptyTimelineData } from '@/domain/timelines/timeline'
import type { CalendarAppearance } from '@/domain/worlds/calendar-appearance'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import { WorldSchema, type World } from '@/domain/worlds/world'
import { SqliteDatabase } from './database'
import { SqliteAssetStore } from './sqliteAssetStore'
import { SqliteCalendar } from './sqliteCalendar'
import { SqliteRecords } from './sqliteRecords'
import { SqliteTimelines } from './sqliteTimelines'

describe('SqliteCalendar', () => {
  let db: SqliteDatabase
  let world: World
  let assets: SqliteAssetStore
  let records: SqliteRecords
  let timelines: SqliteTimelines
  let calendar: SqliteCalendar

  function readWorld(id: string): World {
    db.requireActiveWorld(id)
    const row = db.connection.prepare('SELECT document FROM worlds WHERE id = ?').get(id)
    return WorldSchema.parse(JSON.parse(String(row?.document)))
  }

  function saveWorld(world: World): World {
    const checked = WorldSchema.parse(world)
    db.connection.prepare('UPDATE worlds SET document = ? WHERE id = ?').run(JSON.stringify(checked), world.id)
    return checked
  }

  beforeEach(() => {
    db = new SqliteDatabase(':memory:')
    world = createDefaultWorldSeed()
    db.connection.prepare('INSERT INTO worlds (id, slug, document) VALUES (?, ?, ?)')
      .run(world.id, world.slug, JSON.stringify(world))
    assets = new SqliteAssetStore(db)
    records = new SqliteRecords(db)
    timelines = new SqliteTimelines(db, records, readWorld, () => {})
    calendar = new SqliteCalendar(db, records, timelines, readWorld, saveWorld)
  })

  afterEach(() => {
    db.close()
  })

  it('blocks calendar changes that affect dates in active and trashed records and timelines', () => {
    const date = { start: { year: 1, month: 1, day: 2 } }
    const event = records.create(world.id, { type: 'event', title: 'Evento sintético', properties: { eventDate: date } })
    const timeline = records.create(world.id, { type: 'timeline', title: 'Linha sintética' })
    timelines.persist({
      ...emptyTimelineData(world.id, timeline.id),
      appearances: [{ id: crypto.randomUUID(), entityId: event.id, title: null, note: null, date, minimumScale: null, showCover: true }],
    })

    const current = world.calendar
    const changed = { ...current, months: current.months.map((month, index) => index ? month : { ...month, length: month.length + 1 }) }
    expect(() => calendar.updateCalendar(world.id, changed)).toThrow('2 campo(s) de data')
    records.delete(world.id, event.id)
    records.delete(world.id, timeline.id)
    expect(() => calendar.updateCalendar(world.id, changed)).toThrow('2 campo(s) de data')
    expect(readWorld(world.id).calendar).toEqual(current)

    const renamed = { ...current, eras: { ...current.eras, after: 'Era Sintética' } }
    expect(calendar.updateCalendar(world.id, renamed).calendar).toEqual(renamed)
  })

  it('validates campaign dates and rejects saving from a stale settings form', () => {
    const expectedCalendar = JSON.stringify(world.calendar)
    const date = { year: 1, month: 1, day: 2 }
    expect(() => calendar.updateCampaignToday(world.id, { ...date, day: 999 }, 'null', expectedCalendar)).toThrow()
    expect(readWorld(world.id).campaignToday).toBeNull()
    expect(calendar.updateCampaignToday(world.id, date, 'null', expectedCalendar).campaignToday).toEqual(date)
    expect(() => calendar.updateCampaignToday(world.id, null, 'null', expectedCalendar)).toThrow('mudou')
    expect(readWorld(world.id).campaignToday).toEqual(date)
  })

  it('validates world-scoped backgrounds and protects assets referenced by saved themes', async () => {
    const png = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#123456' } }).png().toBuffer()
    const asset = await assets.importFromBuffer(world.id, png, 'synthetic.png', 'image/png', 'calendar-background')
    const theme = {
      id: crypto.randomUUID(),
      name: 'Tema sintético',
      base: 'codex' as const,
      colors: { text: '#ffffff', accent: '#ccaa00', surface: '#111111', border: '#999999' },
      backgroundAssetId: asset.id,
      focalPoint: { x: 0.5, y: 0.5 },
      overlayOpacity: 0.5,
    }
    const appearance: CalendarAppearance = { activeTheme: 'codex', customThemes: [theme] }
    const expected = JSON.stringify(world.calendarAppearance)
    expect(() => calendar.updateCalendarAppearance(world.id, {
      ...appearance, customThemes: [{ ...theme, backgroundAssetId: crypto.randomUUID() }],
    }, expected)).toThrow('não existe neste mundo')

    expect(calendar.updateCalendarAppearance(world.id, appearance, expected).calendarAppearance).toEqual(appearance)
    await assets.removeAsset(world.id, asset.id)
    expect(await assets.getAsset(world.id, asset.id)).not.toBeNull()
    expect(() => calendar.updateCalendarAppearance(world.id, world.calendarAppearance, expected)).toThrow('mudaram')

    calendar.updateCalendarAppearance(world.id, world.calendarAppearance, JSON.stringify(appearance))
    await assets.removeAsset(world.id, asset.id)
    expect(await assets.getAsset(world.id, asset.id)).toBeNull()
    expect(() => calendar.updateCalendarAppearance(world.id, appearance, expected)).toThrow('não existe neste mundo')
  })
})
