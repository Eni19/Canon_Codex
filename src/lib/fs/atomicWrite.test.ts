import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { atomicWriteJson, pathExists, readJsonFile, removePath } from '@/lib/fs/atomicWrite'

describe('atomicWriteJson', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'wiki-fs-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('creates parent directories and writes valid JSON', async () => {
    const target = path.join(dir, 'nested', 'entity.json')

    await atomicWriteJson(target, { title: 'Amadeus Klein' })

    expect(await readJsonFile(target)).toEqual({ title: 'Amadeus Klein' })
  })

  it('overwrites an existing file without leaving temp files behind', async () => {
    const target = path.join(dir, 'entity.json')

    await atomicWriteJson(target, { title: 'v1' })
    await atomicWriteJson(target, { title: 'v2' })

    expect(await readJsonFile(target)).toEqual({ title: 'v2' })
    const entries = await readdir(dir)
    expect(entries).toEqual(['entity.json'])
  })

  it('never leaves a corrupted file if the original write is interrupted before rename', async () => {
    const target = path.join(dir, 'entity.json')
    await writeFile(target, JSON.stringify({ title: 'original' }), 'utf-8')

    // Simulate a serialization failure mid-write: a value JSON.stringify cannot handle.
    const circular: Record<string, unknown> = {}
    circular.self = circular

    await expect(atomicWriteJson(target, circular)).rejects.toThrow()
    expect(await readJsonFile(target)).toEqual({ title: 'original' })
    const entries = await readdir(dir)
    expect(entries).toEqual(['entity.json'])
  })
})

describe('pathExists / removePath', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'wiki-fs-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('reports existence for files and directories, and removes both recursively', async () => {
    const filePath = path.join(dir, 'a', 'file.json')
    await atomicWriteJson(filePath, { ok: true })

    expect(await pathExists(filePath)).toBe(true)
    expect(await pathExists(path.join(dir, 'missing'))).toBe(false)

    await removePath(path.join(dir, 'a'))
    expect(await pathExists(filePath)).toBe(false)
  })
})
