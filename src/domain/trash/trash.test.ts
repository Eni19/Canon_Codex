import { describe, expect, it } from 'vitest'
import { describeTrashRemaining, isTrashExpired, trashCutoff, trashExpiresAt } from './trash'

const deletedAt = '2026-11-20T12:00:00.000Z'

describe('prazo da lixeira', () => {
  it('vence sete dias depois da exclusão', () => {
    expect(trashExpiresAt(deletedAt)).toBe('2026-11-27T12:00:00.000Z')
    expect(trashCutoff(new Date('2026-11-27T12:00:00.000Z'))).toBe(deletedAt)
    expect(isTrashExpired(deletedAt, new Date('2026-11-27T11:59:59.999Z'))).toBe(false)
    expect(isTrashExpired(deletedAt, new Date('2026-11-27T12:00:00.000Z'))).toBe(true)
  })

  it('recusa uma data de exclusão inválida', () => {
    expect(() => trashExpiresAt('ontem')).toThrow('inválida')
  })

  it('descreve o tempo restante em dias, horas ou menos de uma hora', () => {
    const expiresAt = trashExpiresAt(deletedAt)
    expect(describeTrashRemaining(expiresAt, new Date(deletedAt))).toBe('Será apagado em 7 dias')
    expect(describeTrashRemaining(expiresAt, new Date('2026-11-26T11:00:00.000Z'))).toBe('Será apagado em 1 dia')
    expect(describeTrashRemaining(expiresAt, new Date('2026-11-26T13:00:00.000Z'))).toBe('Será apagado em 23 horas')
    expect(describeTrashRemaining(expiresAt, new Date('2026-11-27T10:30:00.000Z'))).toBe('Será apagado em 1 hora')
    expect(describeTrashRemaining(expiresAt, new Date('2026-11-27T11:30:00.000Z'))).toBe('Será apagado em menos de 1 hora')
    expect(describeTrashRemaining(expiresAt, new Date('2026-11-28T00:00:00.000Z'))).toBe('Será apagado agora')
  })
})
