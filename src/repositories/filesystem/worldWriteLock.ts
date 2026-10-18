import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { getWorldDir } from '@/lib/fs/paths'
import { hasInterruptedOriginEvent, recoverInterruptedOriginEvent } from './originEvent'

const WAIT_MS = 50
const MAX_WAIT_MS = 30_000
const ORPHAN_AGE_MS = 1_000

const LockOwnerSchema = z.object({ pid: z.number().int().positive(), token: z.uuid() })
type LockOwner = z.infer<typeof LockOwnerSchema>

function isRunning(pid: number): boolean {
  try { process.kill(pid, 0); return true }
  catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH' }
}

async function removeOrphan(lockDir: string): Promise<void> {
  let age: number
  try { age = Date.now() - (await stat(lockDir)).mtimeMs }
  catch { return }
  let original = ''
  let owner: LockOwner | null = null
  try { original = await readFile(path.join(lockDir, 'owner.json'), 'utf8'); owner = LockOwnerSchema.parse(JSON.parse(original)) }
  catch { /* The process may have stopped before writing the owner file. */ }
  if (owner && Number.isInteger(owner.pid) && isRunning(owner.pid)) return
  if (!owner && age < ORPHAN_AGE_MS) return

  // Recheck the owner before removing a stale lock another process may have replaced.
  try {
    const current = await readFile(path.join(lockDir, 'owner.json'), 'utf8')
    if (current !== original) return
  } catch { if (owner) return }
  await rm(lockDir, { recursive: true, force: true })
}

/**
 * For pure reads. Files are replaced atomically, so a read without the lock sees whole files; it
 * only takes the lock when an origin change is applying or was interrupted, so it waits for the
 * change or recovers it first. Taking the lock on every read made page and image requests queue.
 */
export async function withWorldRead<T>(worldDir: string, operation: () => Promise<T>): Promise<T> {
  if (await hasInterruptedOriginEvent(worldDir)) return withWorldWriteLock(worldDir, operation)
  return operation()
}

/** Serializes metadata/calendar writes across repository instances and local app processes. */
export async function withWorldWriteLock<T>(worldDir: string, operation: () => Promise<T>): Promise<T> {
  const lockRoot = path.join(tmpdir(), 'canon-codex-world-locks')
  await mkdir(lockRoot, { recursive: true })
  const worldPath = path.resolve(getWorldDir(worldDir))
  const key = createHash('sha256').update(process.platform === 'win32' ? worldPath.toLowerCase() : worldPath).digest('hex')
  const lockDir = path.join(lockRoot, key)
  const owner: LockOwner = { pid: process.pid, token: randomUUID() }
  const deadline = Date.now() + MAX_WAIT_MS
  while (true) {
    try {
      await mkdir(lockDir)
      try { await writeFile(path.join(lockDir, 'owner.json'), JSON.stringify(owner), 'utf8') }
      catch (error) { await rm(lockDir, { recursive: true, force: true }); throw error }
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      await removeOrphan(lockDir)
      if (Date.now() >= deadline) throw new Error('O mundo está ocupado por outra gravação. Tente novamente após a operação terminar.')
      await new Promise((resolve) => setTimeout(resolve, WAIT_MS))
    }
  }
  try {
    await recoverInterruptedOriginEvent(worldDir)
    return await operation()
  }
  finally {
    const current = await readFile(path.join(lockDir, 'owner.json'), 'utf8').catch(() => '')
    if (current === JSON.stringify(owner)) await rm(lockDir, { recursive: true, force: true })
  }
}
