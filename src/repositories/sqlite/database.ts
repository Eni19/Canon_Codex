import 'server-only'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import { dirname } from 'node:path'
import { backup, DatabaseSync } from 'node:sqlite'
import { migrations } from './schema'

export class SqliteDatabase {
  readonly connection: DatabaseSync
  private transactionMode: 'read' | 'write' | undefined

  constructor(file: string, { readOnly = false }: { readOnly?: boolean } = {}) {
    if (!readOnly && file !== ':memory:') {
      mkdirSync(dirname(file), { recursive: true })
      try {
        closeSync(openSync(/* turbopackIgnore: true */ file, 'wx', 0o600))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
    }
    this.connection = new DatabaseSync(file, { enableForeignKeyConstraints: true, timeout: 1000, readOnly })
    if (readOnly) return
    try {
      this.write(() => {
        const version = Number(this.connection.prepare('PRAGMA user_version').get()?.user_version)
        if (version > migrations.length) throw new Error(`Banco SQLite com versão incompatível: ${version}.`)
        for (let index = version; index < migrations.length; index += 1) {
          this.connection.exec(migrations[index])
          this.connection.exec(`PRAGMA user_version = ${index + 1}`)
        }
      })
    } catch (error) {
      this.connection.close()
      throw error
    }
  }

  read<T>(operation: () => T): T {
    return this.transaction('read', operation)
  }

  write<T>(operation: () => T): T {
    return this.transaction('write', operation)
  }

  requireActiveWorld(worldId: string): void {
    if (!this.connection.prepare('SELECT id FROM worlds WHERE id = ? AND deleted_at IS NULL').get(worldId)) {
      throw new Error('O mundo não está mais disponível. Atualize a biblioteca.')
    }
  }

  async backupTo(destination: string): Promise<void> {
    await backup(this.connection, destination)
  }

  close(): void {
    this.connection.close()
  }

  private transaction<T>(mode: 'read' | 'write', operation: () => T): T {
    if (this.transactionMode) {
      if (mode === 'write' && this.transactionMode === 'read') throw new Error('A transação atual é somente de leitura.')
      return operation()
    }
    this.connection.exec(mode === 'write' ? 'BEGIN IMMEDIATE' : 'BEGIN')
    this.transactionMode = mode
    try {
      const result = operation()
      if (result && typeof result === 'object' && 'then' in result) {
        throw new Error('Operações SQLite devem concluir de forma síncrona dentro da transação.')
      }
      this.connection.exec('COMMIT')
      return result
    } catch (error) {
      if (this.connection.isTransaction) this.connection.exec('ROLLBACK')
      throw error
    } finally {
      this.transactionMode = undefined
    }
  }
}
