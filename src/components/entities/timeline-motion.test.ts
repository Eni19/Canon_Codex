import { afterEach, describe, expect, it, vi } from 'vitest'
import { animateTimelineRemoval, timelineScrollBehavior } from './timeline-motion'

afterEach(() => vi.unstubAllGlobals())

function preference(reduced: boolean) {
  const media = { matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  vi.stubGlobal('window', { matchMedia: vi.fn(() => media) })
  return media
}

describe('acessibilidade e cancelamento do movimento da linha', () => {
  it('remove imediatamente e navega sem rolagem suave com movimento reduzido', async () => {
    preference(true)
    const animate = vi.fn()
    await animateTimelineRemoval({ animate } as unknown as HTMLElement)
    expect(animate).not.toHaveBeenCalled()
    expect(timelineScrollBehavior()).toBe('instant')
  })

  it('permite navegação suave quando não há preferência por redução', () => {
    preference(false)
    expect(timelineScrollBehavior()).toBe('smooth')
  })

  it('continua a remoção se a preferência mudar enquanto o fade está em curso', async () => {
    const media = preference(false)
    let rejectAnimation!: (error: Error) => void
    const finished = new Promise<void>((_, reject) => { rejectAnimation = reject })
    const animation = { finished, cancel: vi.fn(() => rejectAnimation(new Error('cancelled'))) }
    const removal = animateTimelineRemoval({ animate: () => animation } as unknown as HTMLElement)
    media.addEventListener.mock.calls[0][1]()
    await expect(removal).resolves.toBeUndefined()
    expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('limpa a animação e o listener depois da saída normal', async () => {
    const media = preference(false)
    const animation = { finished: Promise.resolve(), cancel: vi.fn() }
    await animateTimelineRemoval({ animate: () => animation } as unknown as HTMLElement)
    expect(animation.cancel).toHaveBeenCalledOnce()
    expect(media.removeEventListener).toHaveBeenCalledWith('change', media.addEventListener.mock.calls[0][1])
  })

  it('não depende de Web Animations nem de um cartão ainda montado para remover', async () => {
    preference(false)
    await expect(animateTimelineRemoval(null)).resolves.toBeUndefined()
    await expect(animateTimelineRemoval({} as HTMLElement)).resolves.toBeUndefined()
  })
})
