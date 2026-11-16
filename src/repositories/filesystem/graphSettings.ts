import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { emptyGraphSettings, GraphSettingsSchema, parseGraphSettings, type GraphSettings } from '@/domain/relations/graphSettings'
import { atomicWriteJson } from '@/lib/fs/atomicWrite'
import { getWorldDir } from '@/lib/fs/paths'
import { resolveWorldDir } from './worldDirRegistry'
import { withWorldRead, withWorldWriteLock } from './worldWriteLock'

async function readSettings(worldDir: string, worldId: string): Promise<GraphSettings> {
  let raw: string
  try { raw = await readFile(path.join(getWorldDir(worldDir), 'relationship-graph.json'), 'utf8') }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyGraphSettings(worldId); throw error }
  const settings = parseGraphSettings(JSON.parse(raw))
  if (settings.worldId !== worldId) throw new Error('As configurações do grafo pertencem a outro mundo.')
  return settings
}

export async function getGraphSettings(worldId: string): Promise<GraphSettings> {
  const worldDir = await resolveWorldDir(worldId)
  return withWorldRead(worldDir, () => readSettings(worldDir, worldId))
}

function canonical(settings: GraphSettings): string {
  return JSON.stringify({ positions: Object.entries(settings.positions).sort(([a], [b]) => a.localeCompare(b)), preferences: settings.preferences, styles: [...settings.styles].sort((a, b) => a.type.localeCompare(b.type)), annotations: settings.annotations })
}

export async function saveGraphSettings(worldId: string, input: GraphSettings): Promise<GraphSettings> {
  const parsed = GraphSettingsSchema.parse(input)
  if (parsed.worldId !== worldId) throw new Error('O mundo ativo mudou. Reabra o grafo.')
  const worldDir = await resolveWorldDir(worldId)
  return withWorldWriteLock(worldDir, async () => {
    const current = await readSettings(worldDir, worldId)
    if (canonical(current) === canonical(parsed)) return current
    if (current.revision !== parsed.revision) throw new Error('O grafo foi alterado em outra aba. Recarregue a página antes de salvar.')
    const next = { ...parsed, revision: current.revision + 1 }
    await atomicWriteJson(path.join(getWorldDir(worldDir), 'relationship-graph.json'), next)
    return next
  })
}
