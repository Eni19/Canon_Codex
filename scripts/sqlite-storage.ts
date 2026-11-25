import { chmod, link, lstat, mkdtemp, realpath, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { SqliteDatabase } from '../src/repositories/sqlite/database'
import { readLegacySource, type LegacyWorld } from '../src/repositories/sqlite/legacy-source'
import { migrations } from '../src/repositories/sqlite/schema'
import { SqliteWorldRepository } from '../src/repositories/sqlite/sqliteWorldRepository'

const usage = [
  'npm run storage -- preview <origem>',
  'npm run storage -- import <origem> <novo-banco>',
  'npm run storage -- backup <banco> <novo-backup>',
].join('\n')

function summarize(worlds: LegacyWorld[]) {
  const totals = {
    mundos: worlds.length,
    mundosNaLixeira: 0,
    registros: 0,
    aparicoes: 0,
    aparicoesSemRegistro: 0,
    relacoesSemAlvo: 0,
    origensSemRegistro: 0,
    origensComRegistroDeOutroTipo: 0,
    midias: 0,
    variantesDeMidia: 0,
    quadros: 0,
    cenas: 0,
    playlists: 0,
    historicos: 0,
  }
  for (const world of worlds) {
    if (world.deletedAt !== null) totals.mundosNaLixeira += 1
    totals.registros += world.entities.length
    const entityTypes = new Map(world.entities.map(({ entity }) => [entity.id, entity.type]))
    for (const { entity, timeline } of world.entities) {
      totals.relacoesSemAlvo += entity.relations.filter(({ targetId }) => !entityTypes.has(targetId)).length
      if (!timeline) continue
      totals.aparicoes += timeline.appearances.length
      totals.aparicoesSemRegistro += timeline.appearances.filter(({ entityId }) => !entityTypes.has(entityId)).length
    }
    if (world.world.originEventId) {
      const originType = entityTypes.get(world.world.originEventId)
      if (originType === undefined) totals.origensSemRegistro += 1
      else if (originType !== 'event') totals.origensComRegistroDeOutroTipo += 1
    }
    totals.midias += world.assets.length
    for (const { variants } of world.assets) totals.variantesDeMidia += variants.length
    totals.quadros += world.boards.length
    totals.cenas += world.scenes.length
    totals.playlists += world.playlists.length
    totals.historicos += world.histories.length
  }
  return totals
}

function requireCurrentSchema(db: SqliteDatabase) {
  const version = db.connection.prepare('PRAGMA user_version').get()?.user_version
  if (version !== migrations.length) {
    throw new Error(`Versão do esquema SQLite incompatível: ${version}. Era esperada a versão ${migrations.length}.`)
  }
}

function validateDatabase(db: SqliteDatabase) {
  requireCurrentSchema(db)
  const integrity = db.connection.prepare('PRAGMA integrity_check').all()
  if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
    throw new Error('O banco SQLite falhou na verificação de integridade.')
  }
  if (db.connection.prepare('PRAGMA foreign_key_check').get()) {
    throw new Error('O banco SQLite contém referências inválidas.')
  }
}

async function requireNew(destination: string) {
  try {
    await lstat(destination)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  throw new Error('O arquivo de destino já existe. Escolha um caminho novo.')
}

async function publishDatabase(destination: string, prepare: (staged: string) => Promise<void>) {
  await requireNew(destination)
  const directory = await mkdtemp(path.join(path.dirname(destination), '.canon-sqlite-'))
  const staged = path.join(directory, 'database.sqlite')
  try {
    await prepare(staged)
    await chmod(staged, 0o600)
    const check = new SqliteDatabase(staged, { readOnly: true })
    try {
      validateDatabase(check)
    } finally {
      check.close()
    }
    // Publishing by link makes the new file visible only after validation and never overwrites.
    try {
      await link(staged, destination)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new Error('O arquivo de destino já existe. Escolha um caminho novo.')
      }
      throw error
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function main(args: string[]) {
  const [command, input, output] = args
  if (args.length === 1 && (command === '--help' || command === '-h')) {
    console.log(usage)
    return
  }
  if (command === 'preview' && input && args.length === 2) {
    console.log(JSON.stringify(summarize(await readLegacySource(input, 'library')), null, 2))
    return
  }
  if ((command !== 'import' && command !== 'backup') || !input || !output || args.length !== 3) {
    throw new Error(usage)
  }
  const source = await realpath(input)
  const requested = path.resolve(output)
  const destination = path.join(await realpath(path.dirname(requested)), path.basename(requested))
  if (source === destination) throw new Error('Escolha caminhos diferentes para a origem e o destino.')

  if (command === 'import') {
    const legacyRoot = path.basename(source) === 'worlds' ? path.dirname(source) : source
    const relative = path.relative(legacyRoot, destination)
    if (relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
      throw new Error('Escolha um destino fora da pasta de origem.')
    }
    await requireNew(destination)
    const worlds = await readLegacySource(source, 'library')
    await publishDatabase(destination, async (staged) => {
      const db = new SqliteDatabase(staged)
      try {
        new SqliteWorldRepository(db).importWorlds(worlds, true)
      } finally {
        db.close()
      }
    })
    console.log(JSON.stringify({ destino: destination, ...summarize(worlds) }, null, 2))
    return
  }

  if (!(await stat(source)).isFile()) throw new Error('Informe um arquivo SQLite como origem do backup.')
  const db = new SqliteDatabase(source, { readOnly: true })
  try {
    requireCurrentSchema(db)
    await publishDatabase(destination, (staged) => db.backupTo(staged))
  } finally {
    db.close()
  }
  console.log(JSON.stringify({ backup: destination }, null, 2))
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
