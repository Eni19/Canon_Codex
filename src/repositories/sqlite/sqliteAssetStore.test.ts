import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDefaultWorldSeed } from '@/domain/worlds/defaultWorldSeed'
import type { World } from '@/domain/worlds/world'
import { SqliteDatabase } from './database'
import { SqliteAssetStore } from './sqliteAssetStore'

describe('SqliteAssetStore', () => {
  let db: SqliteDatabase
  let store: SqliteAssetStore
  let world: World
  let png: Buffer

  beforeEach(async () => {
    db = new SqliteDatabase(':memory:')
    store = new SqliteAssetStore(db)
    world = createDefaultWorldSeed()
    db.connection.prepare('INSERT INTO worlds (id, slug, document) VALUES (?, ?, ?)')
      .run(world.id, world.slug, JSON.stringify(world))
    png = await sharp({ create: { width: 1000, height: 500, channels: 3, background: '#123456' } })
      .png()
      .toBuffer()
  })

  afterEach(() => {
    db.close()
  })

  it('preserves the original bytes and serves the calendar variants in the owning world', async () => {
    const asset = await store.importFromBuffer(world.id, png, 'synthetic.png', 'image/png', 'calendar-background')
    expect(await store.getAsset(world.id, asset.id)).toEqual(asset)
    expect(await store.getVariant(world.id, asset.id, 'original')).toEqual({ bytes: new Uint8Array(png), mimeType: 'image/png' })
    const mobile = await store.getVariant(world.id, asset.id, 'calendar-mobile')
    expect(mobile?.mimeType).toBe('image/webp')
    expect((await sharp(mobile!.bytes).metadata()).width).toBe(768)
    expect(await store.getVariant(world.id, asset.id, 'calendar-desktop')).not.toBeNull()
    expect(await store.getVariant(crypto.randomUUID(), asset.id, 'original')).toBeNull()

    await store.removeAsset(world.id, asset.id)
    expect(await store.getAsset(world.id, asset.id)).toBeNull()
    expect(await store.getVariant(world.id, asset.id, 'original')).toBeNull()
    expect(db.connection.prepare('SELECT count(*) AS total FROM asset_variants').get()?.total).toBe(4)
  })

  it('rolls back metadata and prior BLOB inserts when the last variant fails', async () => {
    db.connection.exec(`
      CREATE TRIGGER reject_desktop
      BEFORE INSERT ON asset_variants
      WHEN NEW.variant = 'calendar-desktop'
      BEGIN
        SELECT RAISE(ABORT, 'test insert failure');
      END;
    `)

    await expect(store.importFromBuffer(world.id, png, 'synthetic.png', 'image/png', 'calendar-background'))
      .rejects.toThrow('test insert failure')
    expect(db.connection.prepare('SELECT count(*) AS total FROM assets').get()?.total).toBe(0)
    expect(db.connection.prepare('SELECT count(*) AS total FROM asset_variants').get()?.total).toBe(0)
  })
})
