import 'server-only'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
}

/**
 * Writes JSON atomically: serialize -> write to a sibling temp file -> rename over the target.
 * `rename` is atomic on the same volume, so readers never observe a half-written file.
 */
export async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath))
  const tmpPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`)
  const serialized = JSON.stringify(data, null, 2)
  try {
    await writeFile(tmpPath, serialized, 'utf-8')
    await rename(tmpPath, filePath)
  } catch (error) {
    await rm(tmpPath, { force: true })
    throw error
  }
}

export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath)
    return true
  } catch {
    return false
  }
}

export async function removePath(targetPath: string): Promise<void> {
  await rm(targetPath, { recursive: true, force: true })
}
