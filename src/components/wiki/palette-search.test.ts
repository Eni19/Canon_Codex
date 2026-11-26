import { afterEach, expect, it, vi } from 'vitest'
import { schedulePaletteSearch } from './palette-search'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it.each(['sucesso', 'falha'])('preserva a lista atual após %s tardio da consulta anterior', async outcome => {
  vi.useFakeTimers()
  let finishOld!: (response: Response) => void
  let failOld!: (reason: Error) => void
  const oldResponse = new Promise<Response>((resolve, reject) => {
    finishOld = resolve
    failOld = reject
  })
  vi.stubGlobal('fetch', vi.fn()
    .mockReturnValueOnce(oldResponse)
    .mockResolvedValueOnce(Response.json([{ title: 'Aurora' }])))
  const update = vi.fn()
  const cancel = schedulePaletteSearch('Sol', update)
  await vi.advanceTimersByTimeAsync(150)
  cancel()
  schedulePaletteSearch('Aurora', update)
  await vi.advanceTimersByTimeAsync(150)
  expect(update).toHaveBeenCalledWith([{ title: 'Aurora' }])

  if (outcome === 'sucesso') finishOld(Response.json([{ title: 'Sol' }]))
  else failOld(new Error('Falha na consulta anterior'))
  await vi.advanceTimersByTimeAsync(0)
  expect(update).toHaveBeenCalledTimes(1)
})
