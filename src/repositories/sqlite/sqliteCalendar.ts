import 'server-only'
import { AssetSchema } from '@/domain/assets/asset'
import { TimelineScaleSchema, type TimelineScale } from '@/domain/timelines/timelineScale'
import { CalendarSchema, changesCalendarStructure } from '@/domain/worlds/calendar'
import { validateCalendarAppearanceForSave, type CalendarAppearance } from '@/domain/worlds/calendar-appearance'
import { CalendarExactDateSchema, exactDateToOrdinal, type CalendarExactDate } from '@/domain/worlds/calendar-exact-date'
import { validateCalendarLandmarks, type CalendarLandmarks } from '@/domain/worlds/calendar-landmarks'
import { CalendarMoonsSchema, validateCalendarMoon, type CalendarMoon } from '@/domain/worlds/calendar-moon'
import { validateCalendarSeasons, type CalendarSeason } from '@/domain/worlds/calendar-season'
import type { World } from '@/domain/worlds/world'
import type { SqliteDatabase } from './database'
import type { SqliteRecords } from './sqliteRecords'
import type { SqliteTimelines } from './sqliteTimelines'

export class SqliteCalendar {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly records: SqliteRecords,
    private readonly timelines: SqliteTimelines,
    private readonly readWorld: (id: string) => World,
    private readonly saveWorld: (world: World) => World,
  ) {}

  updateCalendar(worldId: string, calendar: World['calendar']): World {
    const parsed = CalendarSchema.parse(calendar)
    return this.updateWorld(worldId, (current) => {
      if (current.originEventId && (current.calendar.origin.month !== parsed.origin.month || current.calendar.origin.day !== parsed.origin.day)) {
        throw new Error('A posição da origem é definida pelo Evento vinculado. Substitua o Evento para alterá-la.')
      }
      if (changesCalendarStructure(current.calendar, parsed)) this.validateStructuralChange(current)
      return { calendar: parsed }
    })
  }

  updateCalendarMoons(worldId: string, moons: CalendarMoon[], expectedMoons: string, expectedCalendar: string): World {
    const parsed = CalendarMoonsSchema.parse(moons)
    return this.updateWorld(worldId, (current) => {
      if (JSON.stringify(current.calendarMoons) !== expectedMoons || JSON.stringify(current.calendar) !== expectedCalendar) {
        throw new Error('As luas ou o calendário mudaram desde a abertura. Recarregue a página antes de salvar.')
      }
      for (const moon of parsed) {
        const result = validateCalendarMoon(current.calendar, moon)
        if (!result.success) throw new Error(`Lua ${moon.name}: ${result.error}`)
      }
      return { calendarMoons: parsed }
    })
  }

  updateCalendarSeasons(worldId: string, seasons: CalendarSeason[], expectedSeasons: string, expectedCalendar: string): World {
    return this.updateWorld(worldId, (current) => {
      if (JSON.stringify(current.calendarSeasons) !== expectedSeasons || JSON.stringify(current.calendar) !== expectedCalendar) {
        throw new Error('As estações ou o calendário mudaram desde a abertura. Recarregue a página antes de salvar.')
      }
      const parsed = validateCalendarSeasons(current.calendar, seasons)
      if (!parsed.success) throw new Error(parsed.error)
      return { calendarSeasons: parsed.data }
    })
  }

  updateCampaignToday(worldId: string, date: CalendarExactDate | null, expectedToday: string, expectedCalendar: string): World {
    const parsed = CalendarExactDateSchema.nullable().parse(date)
    return this.updateWorld(worldId, (current) => {
      if (JSON.stringify(current.campaignToday) !== expectedToday || JSON.stringify(current.calendar) !== expectedCalendar) {
        throw new Error('A data da campanha ou o calendário mudou. Recarregue a página antes de salvar.')
      }
      if (parsed) exactDateToOrdinal(current.calendar, parsed)
      return { campaignToday: parsed }
    })
  }

  updateCalendarLandmarks(worldId: string, landmarks: CalendarLandmarks, expectedLandmarks: string, expectedCalendar: string): World {
    return this.updateWorld(worldId, (current) => {
      if (JSON.stringify(current.calendarLandmarks) !== expectedLandmarks || JSON.stringify(current.calendar) !== expectedCalendar) {
        throw new Error('Os marcos ou o calendário mudaram. Recarregue a página antes de salvar.')
      }
      const parsed = validateCalendarLandmarks(current.calendar, landmarks)
      if (!parsed.success) throw new Error(parsed.error)
      return { calendarLandmarks: parsed.data }
    })
  }

  updateCalendarAppearance(worldId: string, appearance: CalendarAppearance, expectedAppearance: string): World {
    const parsed = validateCalendarAppearanceForSave(appearance)
    if (!parsed.success) throw new Error(parsed.error)
    return this.updateWorld(worldId, (current) => {
      if (JSON.stringify(current.calendarAppearance) !== expectedAppearance) {
        throw new Error('Os temas mudaram desde a abertura. Recarregue a página antes de salvar.')
      }
      const select = this.db.connection.prepare('SELECT document FROM assets WHERE world_id = ? AND id = ? AND deleted_at IS NULL')
      for (const theme of parsed.data.customThemes) {
        if (!theme.backgroundAssetId) continue
        const row = select.get(worldId, theme.backgroundAssetId)
        if (!row) throw new Error(`A imagem de fundo do tema ${theme.name} não existe neste mundo.`)
        const asset = AssetSchema.parse(JSON.parse(String(row.document)))
        if (asset.worldId !== worldId || asset.id !== theme.backgroundAssetId) {
          throw new Error(`A imagem de fundo do tema ${theme.name} pertence a outro mundo.`)
        }
      }
      return { calendarAppearance: parsed.data }
    })
  }

  updateTimelineScaleDefaults(worldId: string, defaults: Record<string, TimelineScale>): World {
    return this.updateWorld(worldId, (current) => {
      const typeIds = new Set(current.entityTypes.map((type) => type.id))
      const entries = Object.entries(defaults)
      if (entries.length !== typeIds.size || entries.some(([id]) => !typeIds.has(id))) {
        throw new Error('Informe uma escala válida para cada tipo deste mundo.')
      }
      return { timelineScaleDefaults: Object.fromEntries(entries.map(([id, scale]) => [id, TimelineScaleSchema.parse(scale)])) }
    })
  }

  private updateWorld(id: string, changes: (world: World) => Partial<World>): World {
    return this.db.write(() => {
      const current = this.readWorld(id)
      return this.saveWorld({ ...current, ...changes(current), updatedAt: new Date().toISOString() })
    })
  }

  private validateStructuralChange(world: World): void {
    if (world.calendarMoons.length) throw new Error('Há luas configuradas. Remova-as antes de alterar a estrutura do calendário; a remarcação de suas datas ainda não está disponível.')
    if (world.calendarSeasons.length || world.campaignToday) throw new Error('Há estações ou uma data de campanha configuradas. A alteração estrutural precisa aguardar a remarcação das datas.')
    if (world.calendarLandmarks.landmarks.length) throw new Error('Há marcos configurados. A alteração estrutural precisa aguardar a remarcação das datas.')

    const dateKeysByType = new Map(world.entityTypes.map((type) => [
      type.id,
      type.properties.filter((property) => property.kind === 'date').map((property) => property.key),
    ]))
    const entities = [...this.records.list(world.id), ...this.records.list(world.id, undefined, true)]
    let datedValues = 0
    for (const entity of entities) {
      for (const key of dateKeysByType.get(entity.type) ?? []) {
        const value = entity.properties[key]
        if (value !== undefined && value !== null && value !== '') datedValues++
      }
    }

    const timelineRows = this.db.connection.prepare('SELECT id FROM timelines WHERE world_id = ?').all(world.id)
    for (const row of timelineRows) {
      const timeline = this.timelines.read(world.id, String(row.id))
      datedValues += timeline.appearances.filter((appearance) => appearance.date !== null).length
    }
    if (datedValues) {
      throw new Error(`Há ${datedValues} campo(s) de data preenchido(s) neste mundo. A alteração estrutural do calendário precisa aguardar a conversão com prévia e confirmação das datas.`)
    }
  }
}
