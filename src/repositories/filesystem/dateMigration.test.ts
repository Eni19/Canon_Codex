import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { dateToOrdinal } from '@/domain/worlds/calendar'
import { getWorldJsonPath } from '@/lib/fs/paths'
import { FileSystemWorldRepository } from './fileSystemWorldRepository'
import { withWorldWriteLock } from './worldWriteLock'

describe('conversão explícita de datas antigas', () => {
  let root: string
  let repo: FileSystemWorldRepository
  let worldId: string
  let worldDir: string

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'canon-date-migration-'))
    process.env.WIKI_WORKSPACE_DIR = root
    repo = new FileSystemWorldRepository()
    const [world] = await repo.listWorlds()
    worldId = world.id
    worldDir = (await readdir(path.join(root, 'worlds')))[0]
  })
  afterEach(async () => { delete process.env.WIKI_WORKSPACE_DIR; await rm(root, { recursive: true, force: true }) })

  it('converte todos os campos declarados, inclusive tipo personalizado e lixeira, e preserva a distância ordinal', async () => {
    const world = await repo.getWorld(worldId)
    await writeFile(getWorldJsonPath(worldDir), JSON.stringify({ ...world, entityTypes: [...world.entityTypes, {
      id: 'custom', label: 'Custom', pluralLabel: 'Customs', icon: 'Calendar', showInSidebar: false,
      layout: ['header', 'properties'], properties: [{ key: 'when', label: 'Quando', kind: 'date' }],
    }] }))
    const first = await repo.createEntity(worldId, { type: 'event', title: 'Primeiro', properties: { eventDate: '2024-02-29' } })
    const second = await repo.createEntity(worldId, { type: 'event', title: 'Segundo', properties: { eventDate: '2024-03-01' } })
    const custom = await repo.createEntity(worldId, { type: 'custom', title: 'Terceiro', properties: { when: '2020-01-01' } })
    const timeline = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha sintética', properties: { startDate: '2001-01-01', endDate: '2001-01-03' } })
    const trashed = await repo.createEntity(worldId, { type: 'organization', title: 'Excluído', properties: { founded: '2000-01-01' } })
    await repo.deleteEntity(worldId, trashed.id)
    const invalid = await repo.createEntity(worldId, { type: 'event', title: 'Inválido', properties: { eventDate: '2023-02-29' } })
    const before = await repo.previewDateMigration(worldId)
    expect(before).toMatchObject({ total: 7, convertible: 6, invalid: 1, alreadyConverted: 0 })
    expect(before.problems[0]).toMatchObject({ entityId: invalid.id, before: '2023-02-29' })
    const backupId = await repo.startDateMigration(worldId, before.fingerprint)
    const backup = JSON.parse(await readFile(path.join(root, 'worlds', worldDir, 'date-migrations', `${backupId}.json`), 'utf8'))
    expect(backup.report).toMatchObject({ total: 7, convertible: 6, invalid: 1 })
    expect(backup.entries.find((entry: { relativePath: string }) => entry.relativePath.includes(first.id)).originalText).toContain('2024-02-29')
    const one = (await repo.getEntity(worldId, first.id))?.properties.eventDate as { start: { year: number; month: number; day: number } }
    const two = (await repo.getEntity(worldId, second.id))?.properties.eventDate as typeof one
    expect(dateToOrdinal(world.calendar, two.start) - dateToOrdinal(world.calendar, one.start)).toBe(1)
    expect((await repo.getEntity(worldId, custom.id))?.properties.when).toHaveProperty('start')
    expect((await repo.getEntity(worldId, timeline.id))?.properties).toMatchObject({ startDate: { start: {} }, endDate: { start: {} } })
    expect((await repo.getEntity(worldId, invalid.id))?.properties.eventDate).toBe('2023-02-29')
    const trashName = (await readdir(path.join(root, 'worlds', worldDir, 'trash')))[0]
    const trashText = await readFile(path.join(root, 'worlds', worldDir, 'trash', trashName, 'metadata.json'), 'utf8')
    expect(JSON.parse(trashText).properties.founded).toHaveProperty('start')
    expect(await repo.previewDateMigration(worldId)).toMatchObject({ convertible: 0, alreadyConverted: 6, invalid: 1 })
    await repo.recoverDateMigration(worldId, backupId, true)
    expect((await repo.getEntity(worldId, first.id))?.properties.eventDate).toBe('2024-02-29')
    expect((await repo.getEntity(worldId, custom.id))?.properties.when).toBe('2020-01-01')
  })

  it('exige prévia atual e não desloca datas numa segunda execução', async () => {
    const first = await repo.createEntity(worldId, { type: 'event', title: 'Marco', properties: { eventDate: '2024-01-01' } })
    const preview = await repo.previewDateMigration(worldId)
    await repo.updateEntity(worldId, first.id, { title: 'Marco editado' })
    await expect(repo.startDateMigration(worldId, preview.fingerprint)).rejects.toThrow('mudaram')
    const fresh = await repo.previewDateMigration(worldId)
    await repo.startDateMigration(worldId, fresh.fingerprint)
    const again = await repo.previewDateMigration(worldId)
    expect(again.convertible).toBe(0)
    await expect(repo.startDateMigration(worldId, again.fingerprint)).rejects.toThrow('Não há datas')
  })

  it('invalida a prévia quando a definição de um campo muda para date', async () => {
    const world = await repo.getWorld(worldId)
    const customType = {
      id: 'custom', label: 'Custom', pluralLabel: 'Customs', icon: 'Calendar', showInSidebar: false,
      layout: ['header', 'properties'], properties: [{ key: 'when', label: 'Quando', kind: 'text' }],
    }
    await writeFile(getWorldJsonPath(worldDir), JSON.stringify({ ...world, entityTypes: [...world.entityTypes, customType] }))
    await repo.createEntity(worldId, { type: 'event', title: 'Evento', properties: { eventDate: '2024-01-01' } })
    const custom = await repo.createEntity(worldId, { type: 'custom', title: 'Campo alterado', properties: { when: '2024-01-02' } })
    const preview = await repo.previewDateMigration(worldId)
    expect(preview.convertible).toBe(1)
    customType.properties[0].kind = 'date'
    await writeFile(getWorldJsonPath(worldDir), JSON.stringify({ ...world, entityTypes: [...world.entityTypes, customType] }))
    await expect(repo.startDateMigration(worldId, preview.fingerprint)).rejects.toThrow('mudaram')
    expect((await repo.getEntity(worldId, custom.id))?.properties.when).toBe('2024-01-02')
    expect((await repo.previewDateMigration(worldId)).convertible).toBe(2)
  })

  it('serializa confirmações simultâneas para a mesma prévia', async () => {
    await repo.createEntity(worldId, { type: 'event', title: 'Evento', properties: { eventDate: '2024-01-01' } })
    const preview = await repo.previewDateMigration(worldId)
    const results = await Promise.allSettled([
      repo.startDateMigration(worldId, preview.fingerprint),
      repo.startDateMigration(worldId, preview.fingerprint),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect((await readdir(path.join(root, 'worlds', worldDir, 'date-migrations'))).filter((name) => name.endsWith('.json'))).toHaveLength(1)
  })

  it('aguarda a conversão antes de gravar uma edição comum da entidade', async () => {
    const entity = await repo.createEntity(worldId, { type: 'event', title: 'Original' })
    let enter!: () => void
    let release!: () => void
    const entered = new Promise<void>((resolve) => { enter = resolve })
    const gate = new Promise<void>((resolve) => { release = resolve })
    const held = withWorldWriteLock(worldDir, async () => { enter(); await gate })
    await entered
    let edited = false
    const update = repo.updateEntity(worldId, entity.id, { title: 'Editado' }).then(() => { edited = true })
    try {
      await new Promise((resolve) => setTimeout(resolve, 75))
      expect(edited).toBe(false)
    } finally { release() }
    await Promise.all([held, update])
    expect((await repo.getEntity(worldId, entity.id))?.title).toBe('Editado')
  })

  it('lê sem aguardar a trava de gravação', async () => {
    const entity = await repo.createEntity(worldId, { type: 'event', title: 'Original' })
    let enter!: () => void
    let release!: () => void
    const entered = new Promise<void>((resolve) => { enter = resolve })
    const gate = new Promise<void>((resolve) => { release = resolve })
    const held = withWorldWriteLock(worldDir, async () => { enter(); await gate })
    await entered
    try {
      const [world, read, listed] = await Promise.all([repo.getWorld(worldId), repo.getEntity(worldId, entity.id), repo.listEntities(worldId)])
      expect(world.id).toBe(worldId)
      expect(read?.title).toBe('Original')
      expect(listed.map((item) => item.id)).toContain(entity.id)
    } finally { release() }
    await held
  })

  it('recusa manifesto malformado antes de restaurar metadados', async () => {
    const entity = await repo.createEntity(worldId, { type: 'event', title: 'Evento', properties: { eventDate: '2024-01-01' } })
    const preview = await repo.previewDateMigration(worldId)
    const id = await repo.startDateMigration(worldId, preview.fingerprint)
    const manifestFile = path.join(root, 'worlds', worldDir, 'date-migrations', `${id}.json`)
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
    manifest.entries[0].relativePath = 'world.json'
    await writeFile(manifestFile, JSON.stringify(manifest))
    await expect(repo.recoverDateMigration(worldId, id, true)).rejects.toThrow()
    manifest.entries[0].relativePath = `entities/${entity.id}/metadata.json`
    manifest.entries[0].convertedText = '{invalid-json'
    await writeFile(manifestFile, JSON.stringify(manifest))
    await expect(repo.recoverDateMigration(worldId, id, true)).rejects.toThrow()
    expect((await repo.getEntity(worldId, entity.id))?.properties.eventDate).toHaveProperty('start')
  })

  it('não conclui uma retomada se o conjunto de registros mudou', async () => {
    await repo.createEntity(worldId, { type: 'event', title: 'Original', properties: { eventDate: '2024-01-01' } })
    const preview = await repo.previewDateMigration(worldId)
    const id = await repo.startDateMigration(worldId, preview.fingerprint)
    const manifestFile = path.join(root, 'worlds', worldDir, 'date-migrations', `${id}.json`)
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
    manifest.state = 'applying'
    await writeFile(manifestFile, JSON.stringify(manifest))
    await repo.createEntity(worldId, { type: 'event', title: 'Novo', properties: { eventDate: '2024-01-02' } })
    await expect(repo.recoverDateMigration(worldId, id, false)).rejects.toThrow('mudou durante')
    expect((await repo.previewDateMigration(worldId)).recovery?.state).toBe('applying')
  })

  it('mantém ordem e distância em um calendário personalizado', async () => {
    const world = await repo.getWorld(worldId)
    const calendar = { ...world.calendar,
      months: [{ name: 'Bruma', length: 10 }, { name: 'Sol', length: 12 }],
      intercalaryRules: [], origin: { name: 'Marco', month: 1, day: 1 },
    }
    await repo.updateCalendar(worldId, calendar)
    const first = await repo.createEntity(worldId, { type: 'event', title: 'Primeiro', properties: { eventDate: '2024-02-29' } })
    const second = await repo.createEntity(worldId, { type: 'event', title: 'Segundo', properties: { eventDate: '2024-03-01' } })
    const preview = await repo.previewDateMigration(worldId)
    expect(preview.convertible).toBe(2)
    await repo.startDateMigration(worldId, preview.fingerprint)
    const one = (await repo.getEntity(worldId, first.id))?.properties.eventDate as { start: { year: number; month: number; day: number } }
    const two = (await repo.getEntity(worldId, second.id))?.properties.eventDate as typeof one
    expect(dateToOrdinal(calendar, two.start) - dateToOrdinal(calendar, one.start)).toBe(1)
  })

  it('preserva ISO que cairia em um dia intercalar sem mês e dia', async () => {
    const world = await repo.getWorld(worldId)
    await repo.updateCalendar(worldId, {
      ...world.calendar, months: [{ name: 'Único', length: 1 }], origin: { name: 'Marco', month: 1, day: 1 },
      intercalaryRules: [{ id: 'extra', name: 'Extra', month: 1, everyYears: 1, yearOffset: 0, extendsMonth: false }],
    })
    const entity = await repo.createEntity(worldId, { type: 'event', title: 'Intercalar', properties: { eventDate: '0000-01-02' } })
    const preview = await repo.previewDateMigration(worldId)
    expect(preview).toMatchObject({ total: 1, convertible: 0, invalid: 1 })
    expect(preview.problems[0].reason).toContain('intercalar')
    expect((await repo.getEntity(worldId, entity.id))?.properties.eventDate).toBe('0000-01-02')
  })

  it('retoma uma execução interrompida e recusa restaurar sobre edição posterior', async () => {
    const first = await repo.createEntity(worldId, { type: 'event', title: 'Um', properties: { eventDate: '2024-01-01' } })
    const second = await repo.createEntity(worldId, { type: 'event', title: 'Dois', properties: { eventDate: '2024-01-02' } })
    const preview = await repo.previewDateMigration(worldId)
    const id = await repo.startDateMigration(worldId, preview.fingerprint)
    const manifestFile = path.join(root, 'worlds', worldDir, 'date-migrations', `${id}.json`)
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
    manifest.state = 'applying'
    await writeFile(manifestFile, JSON.stringify(manifest))
    const entry = manifest.entries.find((item: { relativePath: string }) => item.relativePath.includes(second.id))
    await writeFile(path.join(root, 'worlds', worldDir, entry.relativePath), entry.originalText)
    expect((await repo.previewDateMigration(worldId)).recovery?.state).toBe('applying')
    await repo.recoverDateMigration(worldId, id, false)
    expect((await repo.getEntity(worldId, second.id))?.properties.eventDate).toHaveProperty('start')
    await repo.updateEntity(worldId, first.id, { title: 'Alterado depois' })
    await expect(repo.recoverDateMigration(worldId, id, true)).rejects.toThrow('mudou')
  })

  it('restaura uma execução interrompida sem deixar metade dos registros convertida', async () => {
    const first = await repo.createEntity(worldId, { type: 'event', title: 'Um', properties: { eventDate: '2024-01-01' } })
    const second = await repo.createEntity(worldId, { type: 'event', title: 'Dois', properties: { eventDate: '2024-01-02' } })
    const preview = await repo.previewDateMigration(worldId)
    const id = await repo.startDateMigration(worldId, preview.fingerprint)
    const manifestFile = path.join(root, 'worlds', worldDir, 'date-migrations', `${id}.json`)
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
    manifest.state = 'applying'
    await writeFile(manifestFile, JSON.stringify(manifest))
    const entry = manifest.entries.find((item: { relativePath: string }) => item.relativePath.includes(second.id))
    await writeFile(path.join(root, 'worlds', worldDir, entry.relativePath), entry.originalText)
    await repo.recoverDateMigration(worldId, id, true)
    expect((await repo.getEntity(worldId, first.id))?.properties.eventDate).toBe('2024-01-01')
    expect((await repo.getEntity(worldId, second.id))?.properties.eventDate).toBe('2024-01-02')
    expect((await repo.previewDateMigration(worldId)).recovery).toBeUndefined()
  })
})
