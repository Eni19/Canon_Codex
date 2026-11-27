import 'server-only'
import { WorldPreferencesSchema, normalizeWorldPreferences, type WorldPreferences } from '@/domain/worlds/worldPreferences'
import { EntityPatchSchema, EntitySchema, type EntityPatch, type NewEntityInput } from '@/domain/entities/entity'
import type { ContentDocument } from '@/domain/content/contentDocument'
import { indexGraphFolders, InvalidFolderMemberError } from '@/domain/relations/graphFolders'
import { emptyGraphSettings, GraphSettingsSchema, parseGraphSettings, type GraphSettings } from '@/domain/relations/graphSettings'
import {
  NewRelationInputSchema, RelationChangesSchema, RelationSchema, type NewRelationInput, type Relation, type RelationChanges,
} from '@/domain/relations/relation'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import { WorldSchema, type World } from '@/domain/worlds/world'
import { validateCalendarDateValue } from '@/domain/worlds/calendar-date'
import { newId } from '@/lib/ids'
import { slugify } from '@/lib/slugify'
import type { EntityListFilter, WorldRepository } from '@/repositories/contracts/worldRepository'
import { ConcurrentModificationError, EntityNotFoundError } from '@/repositories/filesystem/fileSystemWorldRepository'
import type { SqliteDatabase } from './database'
import type { LegacyWorld } from './legacy-source'
import { SqliteCalendar } from './sqliteCalendar'
import { SqliteDateMigration } from './sqliteDateMigration'
import { SqliteOrigin } from './sqliteOrigin'
import { SqliteRecords } from './sqliteRecords'
import { SqliteTimelines } from './sqliteTimelines'

export class SqliteWorldRepository implements WorldRepository {
  private readonly records: SqliteRecords
  private readonly timelines: SqliteTimelines
  private readonly origin: SqliteOrigin
  private readonly calendar: SqliteCalendar
  private readonly dates: SqliteDateMigration

  constructor(private readonly db: SqliteDatabase) {
    const readWorld = (id: string) => this.readWorld(id)
    const saveWorld = (world: World) => this.saveWorld(world)
    const reconcile = (id: string) => this.reconcile(id)
    this.records = new SqliteRecords(db)
    this.timelines = new SqliteTimelines(db, this.records, readWorld, reconcile)
    this.origin = new SqliteOrigin(db, this.records, this.timelines, readWorld, saveWorld, reconcile)
    this.calendar = new SqliteCalendar(db, this.records, this.timelines, readWorld, saveWorld)
    this.dates = new SqliteDateMigration(db, this.records, readWorld)
  }

  async listWorlds(): Promise<World[]> {
    if (!this.isInitialized()) {
      this.db.write(() => {
        if (this.isInitialized()) return
        this.insertWorld(createDefaultWorldSeed(), null)
        this.markInitialized()
      })
    }
    return this.listActiveWorlds()
  }

  async listMissingWorldMetadata(): Promise<string[]> {
    return []
  }

  async getWorld(worldId: string): Promise<World> {
    return this.readWorld(worldId)
  }

  createWorld(name: string, description?: string): World {
    const cleanName = this.cleanWorldName(name)
    return this.db.write(() => {
      const seed = createDefaultWorldSeed()
      const world = this.insertWorld({
        ...seed, id: newId(), name: cleanName, slug: this.uniqueSlug(cleanName), description: description?.trim() || undefined,
      }, null)
      this.markInitialized()
      return world
    })
  }

  async updateWorldPreferences(id: string, preferences: WorldPreferences): Promise<World> {
    const parsed = WorldPreferencesSchema.parse(preferences)
    return this.db.write(() => {
      const current = this.readWorld(id)
      const next = normalizeWorldPreferences(parsed, current.entityTypes.map((type) => type.id))
      return this.saveWorld({ ...current, preferences: next, updatedAt: new Date().toISOString() })
    })
  }

  renameWorld(id: string, name: string): World {
    const cleanName = this.cleanWorldName(name)
    return this.db.write(() => this.saveWorld({ ...this.readWorld(id), name: cleanName, updatedAt: new Date().toISOString() }))
  }

  deleteWorld(id: string): World | null {
    return this.db.write(() => {
      this.readWorld(id)
      this.db.connection.prepare('UPDATE worlds SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), id)
      return this.listActiveWorlds()[0] ?? null
    })
  }

  importWorlds(sources: LegacyWorld[], freshLibrary = false): World[] {
    return this.db.write(() => {
      if (freshLibrary && this.isInitialized()) throw new Error('Escolha um banco SQLite novo para a migração da biblioteca.')
      const imported = sources.map((source) => this.importWorld(source, freshLibrary))
      this.markInitialized()
      return imported
    })
  }

  private importWorld(source: LegacyWorld, freshLibrary: boolean): World {
    if (this.db.connection.prepare('SELECT id FROM worlds WHERE id = ?').get(source.world.id)) {
      throw new Error(`O Codex “${source.world.name}” já está nesta biblioteca, incluindo a lixeira.`)
    }
    const world = this.insertWorld({
      ...source.world,
      slug: freshLibrary || source.deletedAt ? source.world.slug : this.uniqueSlug(source.world.slug || source.world.name),
    }, source.deletedAt)
    for (const item of source.entities) this.records.insert(item.entity, item.content, item.deletedAt)
    for (const item of source.entities) if (item.timeline) this.timelines.persist(item.timeline)
    const insertAsset = this.db.connection.prepare('INSERT INTO assets (world_id, id, document, deleted_at) VALUES (?, ?, ?, ?)')
    const insertVariant = this.db.connection.prepare(`
      INSERT INTO asset_variants (world_id, asset_id, variant, mime_type, bytes) VALUES (?, ?, ?, ?, ?)
    `)
    for (const { asset, deletedAt, variants } of source.assets) {
      insertAsset.run(world.id, asset.id, JSON.stringify(asset), deletedAt)
      for (const variant of variants) insertVariant.run(world.id, asset.id, variant.variant, variant.mimeType, variant.readBytes())
    }
    for (const table of ['boards', 'scenes', 'playlists'] as const) {
      const insert = this.db.connection.prepare(`INSERT INTO ${table} (world_id, id, document, deleted_at) VALUES (?, ?, ?, ?)`)
      for (const { document, deletedAt } of source[table]) insert.run(world.id, document.id, JSON.stringify(document), deletedAt)
    }
    const insertHistory = this.db.connection.prepare('INSERT INTO histories (world_id, kind, id, document) VALUES (?, ?, ?, ?)')
    for (const history of source.histories) insertHistory.run(world.id, history.kind, history.id, JSON.stringify(history.document))
    if (source.graphSettings) this.writeGraphSettings(source.graphSettings)
    return world
  }

  private listActiveWorlds(): World[] {
    return this.db.connection.prepare('SELECT document FROM worlds WHERE deleted_at IS NULL ORDER BY slug, id')
      .all().map(({ document }) => WorldSchema.parse(JSON.parse(String(document))))
  }

  private cleanWorldName(name: string): string {
    const value = name.trim()
    if (!value) throw new Error('Informe um nome para o Codex.')
    return value
  }

  private isInitialized(): boolean {
    return Boolean(this.db.connection.prepare('SELECT id FROM library_state WHERE id = 1').get())
  }

  private markInitialized(): void {
    this.db.connection.prepare('INSERT OR IGNORE INTO library_state (id) VALUES (1)').run()
  }

  private uniqueSlug(input: string): string {
    const base = slugify(input) || 'novo-codex'
    const exists = this.db.connection.prepare('SELECT id FROM worlds WHERE slug = ? AND deleted_at IS NULL')
    let candidate = base
    for (let suffix = 2; exists.get(candidate); suffix += 1) candidate = `${base}-${suffix}`
    return candidate
  }

  private insertWorld(input: World, deletedAt: string | null): World {
    const world = WorldSchema.parse(input)
    this.db.connection.prepare('INSERT INTO worlds (id, slug, document, deleted_at) VALUES (?, ?, ?, ?)')
      .run(world.id, world.slug, JSON.stringify(world), deletedAt)
    return world
  }

  private readWorld(id: string): World {
    const row = this.db.connection.prepare('SELECT document FROM worlds WHERE id = ? AND deleted_at IS NULL').get(id)
    if (!row) throw new Error(`World not found: ${id}`)
    return WorldSchema.parse(JSON.parse(String(row.document)))
  }

  private saveWorld(input: World): World {
    const world = WorldSchema.parse(input)
    this.db.connection.prepare('UPDATE worlds SET document = ? WHERE id = ? AND deleted_at IS NULL')
      .run(JSON.stringify(world), world.id)
    return world
  }

  /** Para a lixeira: limpa aparições e a origem que apontavam para registros apagados. Exige transação de escrita. */
  reconcileLifecycle(worldId: string): void {
    this.reconcile(worldId)
  }

  /** Para a lixeira: slug livre entre os mundos ativos. */
  availableSlug(input: string): string {
    return this.uniqueSlug(input)
  }

  private reconcile(worldId: string): void {
    const world = this.readWorld(worldId)
    const lines = this.db.connection.prepare(`
      SELECT DISTINCT appearance.timeline_id FROM timeline_appearances appearance
      WHERE appearance.world_id = ? AND NOT EXISTS (
        SELECT 1 FROM entities WHERE world_id = appearance.world_id AND id = appearance.entity_id
      )
    `).all(worldId)
    const recordExists = this.db.connection.prepare('SELECT 1 FROM entities WHERE world_id = ? AND id = ?')
    for (const row of lines) {
      const line = this.timelines.read(worldId, String(row.timeline_id))
      this.timelines.persist({
        ...line, updatedAt: nextUpdatedAt(line.updatedAt),
        appearances: line.appearances.filter(({ entityId }) => recordExists.get(worldId, entityId)),
      })
    }
    if (!world.originEventId) return
    const origin = this.records.get(worldId, world.originEventId, true)
    if (origin && origin.type !== 'event') throw new Error('O registro de origem não é um Evento.')
    if (!origin) this.saveWorld({ ...world, originEventId: undefined, updatedAt: nextUpdatedAt(world.updatedAt) })
  }

  async listEntities(worldId: string, filter?: EntityListFilter) {
    return this.db.read(() => this.records.list(worldId, filter))
  }
  async listTrashedEntities(worldId: string) {
    return this.db.read(() => this.records.list(worldId, undefined, true))
  }
  async getEntity(worldId: string, entityId: string) {
    return this.db.read(() => this.records.get(worldId, entityId))
  }
  async listCalendarAgenda(worldId: string) {
    return this.db.read(() => this.records.list(worldId, { type: 'event' })
      .map((entity) => ({ id: entity.id, title: entity.title, date: entity.properties.eventDate })))
  }
  async listArticleSources(worldId: string, afterId?: string, limit = 50) {
    return this.records.listArticleSources(worldId, afterId, limit)
  }
  async createEntity(worldId: string, input: NewEntityInput, content?: ContentDocument) {
    return this.records.create(worldId, input, content)
  }
  async updateEntity(worldId: string, id: string, patch: EntityPatch, content?: ContentDocument) {
    const values = EntityPatchSchema.parse(patch)
    return this.db.write(() => {
      const world = this.readWorld(worldId)
      const current = this.records.get(worldId, id)
      if (!current) throw new EntityNotFoundError(id)
      if (values.expectedUpdatedAt && values.expectedUpdatedAt !== current.updatedAt) {
        throw new ConcurrentModificationError(id)
      }
      if (world.originEventId === id && values.properties !== undefined) {
        const value = validateCalendarDateValue(world.calendar, values.properties.eventDate)
        if (!value.success || value.data.end || value.data.start.approximate || value.data.start.year !== 0
          || value.data.start.month !== world.calendar.origin.month || value.data.start.day !== world.calendar.origin.day) {
          throw new Error('A data do Evento de origem deve permanecer no marco do ano zero. Substitua a origem no calendário.')
        }
      }
      const { expectedUpdatedAt: checkedVersion, ...changes } = values
      void checkedVersion
      return this.records.update(EntitySchema.parse({
        ...current, ...changes,
        ...(changes.title !== undefined ? { slug: slugify(changes.title) } : {}),
        coverAssetId: changes.coverAssetId === null ? undefined : changes.coverAssetId ?? current.coverAssetId,
        updatedAt: nextUpdatedAt(current.updatedAt),
      }), content)
    })
  }
  async deleteEntity(worldId: string, id: string): Promise<void> {
    this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      this.records.delete(worldId, id)
    })
  }
  async getContent(worldId: string, id: string) {
    return this.db.read(() => this.records.getContent(worldId, id))
  }
  async saveContent(worldId: string, id: string, doc: ContentDocument) {
    this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      this.records.saveContent(worldId, id, doc)
    })
  }
  async addRelation(worldId: string, sourceId: string, input: NewRelationInput, requestId?: string): Promise<Relation> {
    const parsedInput = NewRelationInputSchema.parse(input)
    if (parsedInput.sourceId !== sourceId) throw new Error('A origem da relação não corresponde ao registro.')
    const relationId = requestId ? RelationSchema.shape.id.parse(requestId) : newId()
    const bidirectional = parsedInput.directional && parsedInput.bidirectional
    const relation = RelationSchema.parse({ ...parsedInput, bidirectional: bidirectional || undefined, id: relationId })
    return this.db.write(() => {
      const entity = this.records.get(worldId, sourceId)
      if (!entity) throw new EntityNotFoundError(sourceId)
      if (!this.records.get(worldId, parsedInput.targetId)) throw new EntityNotFoundError(parsedInput.targetId)
      if (requestId) {
        const existing = this.db.connection.prepare('SELECT document FROM relations WHERE world_id = ? AND id = ?').get(worldId, relationId)
        if (existing) {
          const stored = RelationSchema.parse(JSON.parse(String(existing.document)))
          if (JSON.stringify(stored) === JSON.stringify(relation)) return stored
          throw new Error('Esta solicitação já foi usada para outra relação.')
        }
      }
      this.records.update({ ...entity, relations: [...entity.relations, relation], updatedAt: nextUpdatedAt(entity.updatedAt) })
      return relation
    })
  }
  async updateRelation(worldId: string, expectedInput: Relation, changes: RelationChanges): Promise<Relation> {
    const expected = RelationSchema.parse(expectedInput)
    const parsedChanges = RelationChangesSchema.parse(changes)
    const bidirectional = parsedChanges.directional && (parsedChanges.bidirectional ?? expected.bidirectional)
    const updated = RelationSchema.parse({ ...expected, ...parsedChanges, bidirectional: bidirectional || undefined })
    return this.db.write(() => {
      const source = this.records.get(worldId, expected.sourceId)
      if (!source) throw new EntityNotFoundError(expected.sourceId)
      if (!this.records.get(worldId, expected.targetId)) throw new EntityNotFoundError(expected.targetId)
      const current = source.relations.find((relation) => relation.id === expected.id)
      if (!current) throw new Error('A relação não está mais disponível.')
      if (JSON.stringify(current) === JSON.stringify(updated)) return current
      if (JSON.stringify(current) !== JSON.stringify(expected)) throw new Error('A relação foi alterada em outra aba. Recarregue a página.')
      this.records.update({
        ...source,
        relations: source.relations.map((relation) => relation.id === expected.id ? updated : relation),
        updatedAt: nextUpdatedAt(source.updatedAt),
      })
      return updated
    })
  }
  async removeRelation(worldId: string, sourceId: string, relationId: string, expectedInput?: Relation): Promise<void> {
    const expected = expectedInput && RelationSchema.parse(expectedInput)
    if (expected && (expected.sourceId !== sourceId || expected.id !== relationId)) throw new Error('A relação não corresponde ao registro.')
    this.db.write(() => {
      const entity = this.records.get(worldId, sourceId)
      if (!entity) throw new EntityNotFoundError(sourceId)
      const current = entity.relations.find((item) => item.id === relationId)
      if (!current) return
      if (expected && JSON.stringify(current) !== JSON.stringify(expected)) throw new Error('A relação foi alterada em outra aba. Recarregue a página.')
      this.records.update({ ...entity, relations: entity.relations.filter((item) => item.id !== relationId), updatedAt: nextUpdatedAt(entity.updatedAt) })
    })
  }
  async getGraphSettings(worldId: string): Promise<GraphSettings> {
    return this.db.read(() => {
      this.db.requireActiveWorld(worldId)
      return this.readGraphSettings(worldId)
    })
  }
  async saveGraphSettings(worldId: string, input: GraphSettings): Promise<GraphSettings> {
    const parsed = GraphSettingsSchema.parse(input)
    if (parsed.worldId !== worldId) throw new Error('O mundo ativo mudou. Reabra o grafo.')
    return this.db.write(() => {
      this.db.requireActiveWorld(worldId)
      const current = this.readGraphSettings(worldId)
      if (canonicalGraph(current) === canonicalGraph(parsed)) return current
      if (current.revision !== parsed.revision) throw new Error('O grafo foi alterado em outra aba. Recarregue a página antes de salvar.')
      const previous = indexGraphFolders(current.folders)
      for (const [id, folder] of indexGraphFolders(parsed.folders)) {
        if (previous.get(id)?.id === folder.id) continue
        if (!this.records.get(worldId, id)) {
          throw new InvalidFolderMemberError('Um dos registros não está mais disponível neste mundo. Recarregue a página.')
        }
      }
      const next = GraphSettingsSchema.parse({ ...parsed, revision: current.revision + 1 })
      this.writeGraphSettings(next)
      return next
    })
  }
  private readGraphSettings(worldId: string): GraphSettings {
    const row = this.db.connection.prepare('SELECT document FROM graph_settings WHERE world_id = ?').get(worldId)
    if (!row) return emptyGraphSettings(worldId)
    const settings = parseGraphSettings(JSON.parse(String(row.document)))
    if (settings.worldId !== worldId) throw new Error('As configurações do grafo pertencem a outro mundo.')
    return settings
  }
  private writeGraphSettings(settings: GraphSettings): void {
    this.db.connection.prepare(`
      INSERT INTO graph_settings (world_id, document) VALUES (?, ?)
      ON CONFLICT (world_id) DO UPDATE SET document = excluded.document
    `).run(settings.worldId, JSON.stringify(settings))
  }
  async getBacklinks(worldId: string, id: string) {
    return this.db.read(() => this.records.getBacklinks(worldId, id))
  }

  async updateCalendar(...args: Parameters<WorldRepository['updateCalendar']>) { return this.calendar.updateCalendar(...args) }
  async updateCalendarMoons(...args: Parameters<WorldRepository['updateCalendarMoons']>) { return this.calendar.updateCalendarMoons(...args) }
  async updateCalendarSeasons(...args: Parameters<WorldRepository['updateCalendarSeasons']>) { return this.calendar.updateCalendarSeasons(...args) }
  async updateCampaignToday(...args: Parameters<WorldRepository['updateCampaignToday']>) { return this.calendar.updateCampaignToday(...args) }
  async updateCalendarLandmarks(...args: Parameters<WorldRepository['updateCalendarLandmarks']>) { return this.calendar.updateCalendarLandmarks(...args) }
  async updateCalendarAppearance(...args: Parameters<WorldRepository['updateCalendarAppearance']>) { return this.calendar.updateCalendarAppearance(...args) }
  async updateTimelineScaleDefaults(...args: Parameters<WorldRepository['updateTimelineScaleDefaults']>) { return this.calendar.updateTimelineScaleDefaults(...args) }
  async previewDateMigration(...args: Parameters<WorldRepository['previewDateMigration']>) { return this.dates.previewDateMigration(...args) }
  async startDateMigration(...args: Parameters<WorldRepository['startDateMigration']>) { return this.dates.startDateMigration(...args) }
  async recoverDateMigration(...args: Parameters<WorldRepository['recoverDateMigration']>) { return this.dates.recoverDateMigration(...args) }
  async createOriginEvent(worldId: string, input: NewEntityInput, content?: ContentDocument) { return this.origin.createOriginEvent(worldId, input, content) }
  async previewOriginEvent(...args: Parameters<WorldRepository['previewOriginEvent']>) { return this.origin.previewOriginEvent(...args) }
  async replaceOriginEvent(...args: Parameters<WorldRepository['replaceOriginEvent']>) { return this.origin.replaceOriginEvent(...args) }
  async getOriginEvent(...args: Parameters<WorldRepository['getOriginEvent']>) { return this.origin.getOriginEvent(...args) }
  getTimeline(...args: Parameters<WorldRepository['getTimeline']>) { return this.timelines.getTimeline(...args) }
  addTimelineAppearance(...args: Parameters<WorldRepository['addTimelineAppearance']>) { return this.timelines.addTimelineAppearance(...args) }
  updateTimelineAppearance(...args: Parameters<WorldRepository['updateTimelineAppearance']>) { return this.timelines.updateTimelineAppearance(...args) }
  createTimelineEvent(...args: Parameters<WorldRepository['createTimelineEvent']>) { return this.timelines.createTimelineEvent(...args) }
  addAllTimelineAppearances(...args: Parameters<WorldRepository['addAllTimelineAppearances']>) { return this.timelines.addAllTimelineAppearances(...args) }
  removeTimelineAppearance(...args: Parameters<WorldRepository['removeTimelineAppearance']>) { return this.timelines.removeTimelineAppearance(...args) }
  restoreTimelineAppearance(...args: Parameters<WorldRepository['restoreTimelineAppearance']>) { return this.timelines.restoreTimelineAppearance(...args) }
}

function nextUpdatedAt(current: string): string {
  return new Date(Math.max(Date.now(), Date.parse(current) + 1)).toISOString()
}

function canonicalGraph(settings: GraphSettings): string {
  return JSON.stringify({
    positions: Object.entries(settings.positions).sort(([a], [b]) => a.localeCompare(b)),
    preferences: settings.preferences,
    styles: [...settings.styles].sort((a, b) => a.type.localeCompare(b.type)),
    annotations: settings.annotations,
    folders: settings.folders,
  })
}
