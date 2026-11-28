import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { BoardCanvasSchema } from '../src/domain/boards/boardCanvas'
import { createBoardStressFixture } from './board-stress-fixture'

it('cria um mundo sintético com um quadro de 1.400 itens só dentro da pasta temporária', async () => {
  const configured = process.env.BOARD_STRESS_ROOT
  if (!configured) throw new Error('BOARD_STRESS_ROOT deve apontar para uma pasta temporária ainda inexistente.')
  const root = path.resolve(configured); const relative = path.relative(path.resolve(tmpdir()), root)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('A pasta de teste precisa estar dentro do diretório temporário.')
  await mkdir(root) // Falha em vez de sobrescrever uma pasta existente.
  const { world, entities, board } = createBoardStressFixture({ allTypes: process.env.BOARD_STRESS_TYPES === 'all' })
  const worldDir = path.join(root, 'worlds', world.slug)
  await mkdir(path.join(worldDir, 'boards', board.id), { recursive: true })
  await writeFile(path.join(worldDir, 'world.json'), JSON.stringify(world))
  await writeFile(path.join(worldDir, 'boards', board.id, 'board.json'), JSON.stringify(board))
  await Promise.all(entities.map(async (entity) => {
    const directory = path.join(worldDir, 'entities', entity.id)
    await mkdir(directory, { recursive: true })
    await writeFile(path.join(directory, 'metadata.json'), JSON.stringify(entity))
  }))
  expect(BoardCanvasSchema.parse(board.canvasSnapshot).shapes).toHaveLength(1400)
})
