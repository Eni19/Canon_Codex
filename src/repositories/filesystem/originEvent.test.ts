import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { dateToOrdinal } from '@/domain/worlds/calendar'
import { createWorld } from '@/services/worlds/worldLibrary'
import { getTimelineDataPath, getWorldDir } from '@/lib/fs/paths'
import { FileSystemWorldRepository } from './fileSystemWorldRepository'

describe('Evento de origem', () => {
  let temporary: string
  let repo: FileSystemWorldRepository
  let worldId: string

  beforeEach(async () => {
    temporary = await mkdtemp(path.join(tmpdir(), 'canon-origin-test-'))
    process.env.WIKI_WORKSPACE_DIR = temporary
    repo = new FileSystemWorldRepository()
    worldId = (await repo.listWorlds())[0].id
  })
  afterEach(async () => {
    delete process.env.WIKI_WORKSPACE_DIR
    await rm(temporary, { recursive: true, force: true })
  })

  it('cria somente uma origem por mundo e a posiciona na data informada do ano zero', async () => {
    const origin = await repo.createOriginEvent(worldId, { type: 'event', title: 'Marco sintético', properties: { eventDate: { start: { year: 12, month: 3, day: 5 } } } })
    const world = await repo.getWorld(worldId)
    expect(world.originEventId).toBe(origin.id)
    expect(world.calendar.origin).toMatchObject({ month: 3, day: 5 })
    expect((await repo.getEntity(worldId, origin.id))?.properties.eventDate).toEqual({ start: { year: 0, month: 3, day: 5 } })
    await expect(repo.createOriginEvent(worldId, { type: 'event', title: 'Outro', properties: { eventDate: { start: { year: 0, month: 1, day: 1 } } } })).rejects.toThrow()
    await expect(repo.updateEntity(worldId, origin.id, { properties: { eventDate: { start: { year: 1, month: 1, day: 1 } } } })).rejects.toThrow()
  })

  it('desloca datas ativas e na lixeira preservando as distâncias e isola outro mundo', async () => {
    const origin = await repo.createOriginEvent(worldId, { type: 'event', title: 'Origem', properties: { eventDate: { start: { year: 0, month: 1, day: 1 } } } })
    const next = await repo.createEntity(worldId, { type: 'event', title: 'Nova origem', properties: { eventDate: { start: { year: 2, month: 1, day: 1 } } } })
    const trashed = await repo.createEntity(worldId, { type: 'event', title: 'Na lixeira', properties: { eventDate: { start: { year: 3, month: 1, day: 1 } } } })
    const other = await createWorld('Mundo sintético separado')
    const otherOrigin = await repo.createOriginEvent(other.id, { type: 'event', title: 'Origem separada', properties: { eventDate: { start: { year: 0, month: 4, day: 2 } } } })
    await expect(repo.previewOriginEvent(worldId, otherOrigin.id)).rejects.toThrow('não está ativo neste mundo')
    await repo.deleteEntity(worldId, trashed.id)
    const before = await repo.getWorld(worldId)
    const beforeDistance = dateToOrdinal(before.calendar, { year: 2, month: 1, day: 1 }) - dateToOrdinal(before.calendar, { year: 0, month: 1, day: 1 })
    const preview = await repo.previewOriginEvent(worldId, next.id)
    expect(preview.shiftDays).toBe(-beforeDistance)
    const updated = await repo.replaceOriginEvent(worldId, next.id, preview.fingerprint)
    expect(updated.originEventId).toBe(next.id)
    expect((await repo.getEntity(worldId, next.id))?.properties.eventDate).toEqual({ start: { year: 0, month: 1, day: 1 } })
    const previousDate = (await repo.getEntity(worldId, origin.id))?.properties.eventDate as { start: { year: number; month: number; day: number } }
    expect(dateToOrdinal(updated.calendar, previousDate.start)).toBe(-beforeDistance)
    expect((await repo.getWorld(other.id)).originEventId).toBe(otherOrigin.id)
    expect((await repo.getWorld(other.id)).calendar.origin).toMatchObject({ month: 4, day: 2 })
    const worldDir = path.join(temporary, 'worlds', before.slug)
    const trashName = (await readdir(path.join(worldDir, 'trash'))).find((name) => name.startsWith(`entity-${trashed.id}-`))!
    const trashedRecord = JSON.parse(await readFile(path.join(worldDir, 'trash', trashName, 'metadata.json'), 'utf8'))
    expect(dateToOrdinal(updated.calendar, trashedRecord.properties.eventDate.start)).toBe(
      dateToOrdinal(before.calendar, { year: 3, month: 1, day: 1 }) - beforeDistance,
    )
    await expect(repo.replaceOriginEvent(worldId, origin.id, preview.fingerprint)).rejects.toThrow('mudou desde a prévia')
  })

  it('desloca aparições e restaura o arquivo da linha após operação interrompida', async () => {
    await repo.createOriginEvent(worldId, { type: 'event', title: 'Origem', properties: { eventDate: { start: { year: 0, month: 1, day: 1 } } } })
    const next = await repo.createEntity(worldId, { type: 'event', title: 'Nova origem', properties: { eventDate: { start: { year: 2, month: 1, day: 1 } } } })
    const timeline = await repo.createEntity(worldId, { type: 'timeline', title: 'Linha' })
    const before = await repo.getTimeline(worldId, timeline.id)
    await repo.addTimelineAppearance(worldId, timeline.id, next.id, { start: { year: 3, month: 2, day: 4 } }, before.updatedAt)
    const world = await repo.getWorld(worldId)
    const timelineFile = getTimelineDataPath(world.slug, timeline.id)
    const originalText = await readFile(timelineFile, 'utf8')
    const preview = await repo.previewOriginEvent(worldId, next.id)
    expect(preview.affectedDates).toBeGreaterThanOrEqual(2)
    await repo.replaceOriginEvent(worldId, next.id, preview.fingerprint)
    expect((await repo.getTimeline(worldId, timeline.id)).appearances[0].date?.start.year).toBe(1)
    const backupDir = path.join(getWorldDir(world.slug), 'origin-backups')
    const backupFile = path.join(backupDir, (await readdir(backupDir))[0])
    const backup = JSON.parse(await readFile(backupFile, 'utf8'))
    backup.state = 'applying'
    await writeFile(backupFile, JSON.stringify(backup))
    await repo.getWorld(worldId)
    expect(await readFile(timelineFile, 'utf8')).toBe(originalText)
  })

  it('reverte um backup marcado como operação interrompida antes da próxima leitura', async () => {
    const origin = await repo.createOriginEvent(worldId, { type: 'event', title: 'Origem', properties: { eventDate: { start: { year: 0, month: 1, day: 1 } } } })
    const other = await repo.createEntity(worldId, { type: 'event', title: 'Outro', properties: { eventDate: { start: { year: 1, month: 1, day: 1 } } } })
    const preview = await repo.previewOriginEvent(worldId, other.id)
    await repo.replaceOriginEvent(worldId, other.id, preview.fingerprint)
    const world = await repo.getWorld(worldId)
    const backups = path.join(getWorldDir(world.slug), 'origin-backups')
    const file = path.join(backups, (await readdir(backups))[0])
    const backup = JSON.parse(await readFile(file, 'utf8'))
    backup.state = 'applying'
    await writeFile(file, JSON.stringify(backup))
    expect((await repo.getWorld(worldId)).originEventId).toBe(origin.id)
    expect(JSON.parse(await readFile(file, 'utf8')).state).toBe('restored')
  })

  it('restaura a operação interrompida antes de aceitar outra edição', async () => {
    await repo.createOriginEvent(worldId, { type: 'event', title: 'Origem', properties: { eventDate: { start: { year: 0, month: 1, day: 1 } } } })
    const other = await repo.createEntity(worldId, { type: 'event', title: 'Outro', properties: { eventDate: { start: { year: 4, month: 1, day: 1 } } } })
    const preview = await repo.previewOriginEvent(worldId, other.id)
    await repo.replaceOriginEvent(worldId, other.id, preview.fingerprint)
    const world = await repo.getWorld(worldId)
    const backups = path.join(getWorldDir(world.slug), 'origin-backups')
    const file = path.join(backups, (await readdir(backups))[0])
    const backup = JSON.parse(await readFile(file, 'utf8'))
    backup.state = 'applying'
    await writeFile(file, JSON.stringify(backup))

    await repo.updateEntity(worldId, other.id, { title: 'Edição posterior' })
    await repo.previewOriginEvent(worldId, other.id)
    expect((await repo.getEntity(worldId, other.id))?.title).toBe('Edição posterior')
    expect(JSON.parse(await readFile(file, 'utf8')).state).toBe('restored')
  })

  it('mantém a precisão de ano e a duração aberta quando o deslocamento alinha os anos', async () => {
    await repo.createOriginEvent(worldId, { type: 'event', title: 'Origem', properties: { eventDate: { start: { year: 0, month: 1, day: 1 } } } })
    const next = await repo.createEntity(worldId, { type: 'event', title: 'Nova origem', properties: { eventDate: { start: { year: 4, month: 1, day: 1 } } } })
    const broad = await repo.createEntity(worldId, { type: 'event', title: 'Período aberto', properties: { eventDate: { start: { year: 8 } } } })
    const preview = await repo.previewOriginEvent(worldId, next.id)
    expect(preview.precisionChanges).toBe(0)
    await repo.replaceOriginEvent(worldId, next.id, preview.fingerprint)
    expect((await repo.getEntity(worldId, broad.id))?.properties.eventDate).toEqual({ start: { year: 4 } })
  })

  it('avisa sobre perda de precisão sem fechar uma duração aberta', async () => {
    await repo.createOriginEvent(worldId, { type: 'event', title: 'Origem', properties: { eventDate: { start: { year: 0, month: 1, day: 1 } } } })
    const next = await repo.createEntity(worldId, { type: 'event', title: 'Nova origem', properties: { eventDate: { start: { year: 1, month: 1, day: 1 } } } })
    const broad = await repo.createEntity(worldId, { type: 'event', title: 'Período aberto', properties: { eventDate: { start: { year: 3 } } } })
    const preview = await repo.previewOriginEvent(worldId, next.id)
    expect(preview.precisionChanges).toBe(1)
    await repo.replaceOriginEvent(worldId, next.id, preview.fingerprint)
    const shifted = (await repo.getEntity(worldId, broad.id))?.properties.eventDate as { start: { year: number; month: number; day: number }; end?: unknown }
    expect(shifted.end).toBeUndefined()
    const beforeOrdinal = dateToOrdinal((await repo.getWorld(worldId)).calendar, { year: 3, month: 1, day: 1 })
    expect(dateToOrdinal((await repo.getWorld(worldId)).calendar, shifted.start)).toBe(beforeOrdinal + preview.shiftDays)
  })

  it('identifica a origem vinculada mesmo quando seu Evento está na lixeira', async () => {
    const origin = await repo.createOriginEvent(worldId, { type: 'event', title: 'Marco guardado', properties: { eventDate: { start: { year: 0, month: 1, day: 1 } } } })
    await repo.deleteEntity(worldId, origin.id)
    expect(await repo.getOriginEvent(worldId)).toEqual({ id: origin.id, title: origin.title, trashed: true })
  })
})
