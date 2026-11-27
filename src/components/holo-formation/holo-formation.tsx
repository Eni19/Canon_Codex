'use client'

import { useLayoutEffect } from 'react'
import { HOLO_FRAGMENT, HOLO_VERTEX } from './holo-shader'

/**
 * Entrada holográfica de uma página: um canvas WebGL cobre a página como um fluido escuro e
 * marmorizado, que se desfaz por profundidade. A figura do retrato (`imageSelector`, dentro da
 * raiz) se forma primeiro, deformada e com reflexos de película; depois o resto da página aparece
 * a partir dela. Ao terminar, o canvas some e a imagem de verdade volta. Clique ou Esc pulam; sem
 * WebGL ou com movimento reduzido, não roda.
 *
 * A raiz deve vir do servidor com `data-holo-pending` (escondida por CSS): ela só aparece quando o
 * canvas já a cobre, para o navegador não pintar a página pronta antes do fluido.
 */
type HoloFormationProps = {
  /** Seletor da raiz da página que o fluido cobre. */
  rootSelector: string
  /** Seletor da imagem principal (dentro da raiz) que se forma primeiro. */
  imageSelector?: string
  /** Duração da curva de formação, em ms (o ritmo do fluido virando página). */
  duration?: number
  /** Quando a página assume, em ms: antes do fim da curva, que só acabaria de assentar as bordas. */
  handOffAt?: number
}

/** Converte qualquer cor CSS (inclusive oklch) em RGB 0–1, pintando um pixel. */
function cssColor(value: string, fallback: [number, number, number]): [number, number, number] {
  const element = document.createElement('canvas')
  element.width = element.height = 1
  const c = element.getContext('2d')
  if (!c || !value) return fallback
  c.fillStyle = '#000'
  c.fillStyle = value
  c.fillRect(0, 0, 1, 1)
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data
  return [r / 255, g / 255, b / 255]
}

/** Deslocamento da imagem dentro da caixa a partir de `object-position` (porcentagens ou px). */
function objectPosition(value: string, freeX: number, freeY: number): [number, number] {
  const parts = value.trim().split(/\s+/)
  const read = (part: string | undefined, free: number) => {
    if (!part) return free / 2
    if (part.endsWith('%')) return (parseFloat(part) / 100) * free
    if (part.endsWith('px')) return parseFloat(part)
    return free / 2
  }
  return [read(parts[0], freeX), read(parts[1], freeY)]
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader')
  return shader
}

/** Suave nas duas pontas: o fluido respira antes de formar e a página assenta devagar. */
const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2

export function HoloFormation({ rootSelector, imageSelector, duration = 4500, handOffAt = 3500 }: HoloFormationProps) {
  useLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>(rootSelector)
    if (!root) return
    // Em qualquer saída sem animação, a página aparece na hora.
    const reveal = () => root.removeAttribute('data-holo-pending')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { reveal(); return }
    const canvas = document.createElement('canvas')
    // Opacidade pré-multiplicada (o padrão): o shader entrega cor × opacidade.
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false })
    if (!gl) { reveal(); return }

    let program: WebGLProgram
    try {
      program = gl.createProgram()!
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, HOLO_VERTEX))
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, HOLO_FRAGMENT))
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { reveal(); return }
    } catch {
      reveal()
      return
    }

    // O canvas cobre a área da página (não a barra lateral), por cima de tudo, sem pegar cliques.
    let box = root.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    Object.assign(canvas.style, { position: 'fixed', zIndex: '40', pointerEvents: 'none', transition: 'opacity 0.45s ease' })
    /** Põe o canvas exatamente sobre a raiz (de novo sempre que ela mudar de lugar ou tamanho). */
    const fitCanvas = () => {
      Object.assign(canvas.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` })
      canvas.width = Math.max(1, Math.round(box.width * dpr))
      canvas.height = Math.max(1, Math.round(box.height * dpr))
    }
    fitCanvas()
    canvas.setAttribute('aria-hidden', 'true')
    document.body.appendChild(canvas)

    const image = imageSelector ? root.querySelector<HTMLImageElement>(imageSelector) : null
    if (image) image.style.opacity = '0'

    // O brilho em volta da figura (um drop-shadow num ancestral da imagem) começa apagado e acende
    // devagar depois da troca, em vez de surgir de uma vez quando a imagem real volta.
    let glow: { element: HTMLElement; inline: string } | null = null
    for (let element = image?.parentElement ?? null; element && element !== root; element = element.parentElement) {
      const filter = getComputedStyle(element).filter
      if (filter.includes('drop-shadow')) { glow = { element, inline: element.style.filter }; break }
    }
    // Começa na mesma cor de destaque, só que sem opacidade nem espalhamento: partir de "transparent"
    // (preto transparente) faria a transição passar por tons quase pretos e o brilho só aparecer no fim.
    if (glow) glow.element.style.filter = 'drop-shadow(0 0 0 color-mix(in oklch, var(--primary) 1%, transparent))'
    const lightUp = (immediate: boolean) => {
      if (!glow) return
      const { element, inline } = glow
      glow = null
      // Desmontando (ou o React refazendo o efeito em desenvolvimento): volta na hora, sem transição.
      if (immediate) { element.style.filter = inline; return }
      // Volta ao valor da própria página (inline ou da classe), com transição.
      element.style.transition = 'filter 2.2s cubic-bezier(0.33, 0, 0.2, 1)'
      void element.offsetWidth
      element.style.filter = inline
      timers.push(window.setTimeout(() => element.style.removeProperty('transition'), 2300))
    }

    gl.useProgram(program)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    const u = (name: string) => gl.getUniformLocation(program, name)
    const fitViewport = () => {
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(u('uRes'), canvas.width, canvas.height)
    }
    fitViewport()

    const style = getComputedStyle(root)
    gl.uniform3fv(u('uBase'), cssColor(style.getPropertyValue('--background').trim(), [0.06, 0.07, 0.09]))
    gl.uniform3fv(u('uAccent'), cssColor(style.getPropertyValue('--primary').trim(), [0.9, 0.7, 0.3]))
    gl.uniform1f(u('uHasImage'), 0)
    // Sem figura, a página se forma a partir do terço de cima, no meio.
    gl.uniform2f(u('uFocus'), canvas.width * 0.35, canvas.height * 0.4)

    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))
    for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v)
    gl.uniform1i(u('uImage'), 0)

    /**
     * Onde a imagem aparece de fato: a caixa (já com o enquadramento), o encaixe da imagem nela
     * (`object-fit` cover ou contain e `object-position`, lidos do estilo) e o corte vertical do contêiner.
     */
    const placeImage = (element: HTMLImageElement) => {
      const rect = element.getBoundingClientRect()
      const clip = (element.parentElement ?? element).getBoundingClientRect()
      const fit = getComputedStyle(element)
      const fitScale = fit.objectFit === 'contain' ? Math.min : Math.max
      const scale = fitScale(rect.width / element.naturalWidth, rect.height / element.naturalHeight)
      const w = element.naturalWidth * scale, h = element.naturalHeight * scale
      const [px, py] = objectPosition(fit.objectPosition, rect.width - w, rect.height - h)
      const x = rect.left + px - box.left, y = rect.top + py - box.top
      gl.uniform4f(u('uImageRect'), x * dpr, y * dpr, w * dpr, h * dpr)
      gl.uniform2f(u('uClipY'), (clip.top - box.top) * dpr, (clip.bottom - box.top) * dpr)
      gl.uniform2f(u('uFocus'), (x + w / 2) * dpr, (Math.max(y, clip.top - box.top) + Math.min(h, clip.height) * 0.38) * dpr)
    }

    let frame = 0, start = 0, finished = false, alive = true
    const timers: number[] = []
    const draw = (now: number) => {
      const elapsed = start ? now - start : 0
      gl.uniform1f(u('uTime'), now / 1000)
      gl.uniform1f(u('uProgress'), start ? ease(Math.min(1, elapsed / duration)) * 1.2 : 0)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    const finish = (immediate = false) => {
      if (finished) return
      finished = true
      cancelAnimationFrame(frame)
      if (image) image.style.removeProperty('opacity')
      lightUp(immediate)
      canvas.style.opacity = '0'
      timers.push(window.setTimeout(() => canvas.remove(), 480))
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', onKey)
    }
    // Pular pelo clique ou Esc ainda acende o brilho devagar (o evento não pode virar o `immediate`).
    const skip = () => finish()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') finish() }
    // A página ainda pode se mexer depois que a animação começa (por exemplo, a barra de rolagem
    // some quando a rolagem é travada e, no Edge, o conteúdo anda alguns pixels). A cada quadro, o
    // canvas e a imagem são medidos de novo, para a imagem desenhada terminar onde a real está.
    let imagePlaced = false
    const follow = () => {
      const next = root.getBoundingClientRect()
      if (next.left !== box.left || next.top !== box.top || next.width !== box.width || next.height !== box.height) {
        box = next
        fitCanvas()
        fitViewport()
      }
      if (image && imagePlaced) placeImage(image)
    }
    const loop = (now: number) => {
      if (!alive || finished) return
      follow()
      draw(now)
      // O canvas sai um pouco antes do fim da curva; o esmaecimento dele cobre o que faltava assentar.
      if (start && now - start >= Math.min(handOffAt, duration)) { draw(now); finish(); return }
      frame = requestAnimationFrame(loop)
    }
    // O primeiro quadro (tudo fluido) é desenhado antes da pintura; só então a página deixa de estar
    // escondida, já por baixo do fluido.
    draw(performance.now())
    reveal()
    frame = requestAnimationFrame(loop)

    // A formação começa quando a imagem chega (ou logo, se não houver imagem ou ela demorar).
    const begin = () => { if (!start) start = performance.now() }
    if (image) {
      const ready = () => {
        if (!alive || finished || !image.naturalWidth) { begin(); return }
        try {
          gl.bindTexture(gl.TEXTURE_2D, texture)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
          placeImage(image)
          imagePlaced = true
          gl.uniform1f(u('uHasImage'), 1)
        } catch { /* imagem sem permissão de leitura: forma só o fluido */ }
        begin()
      }
      if (image.complete && image.naturalWidth) ready()
      else image.addEventListener('load', ready, { once: true })
      timers.push(window.setTimeout(begin, 900))
    } else begin()

    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', onKey)
    return () => {
      alive = false
      finish(true)
      for (const timer of timers) window.clearTimeout(timer)
      canvas.remove()
      gl.deleteTexture(texture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    }
  }, [duration, handOffAt, imageSelector, rootSelector])

  return null
}
