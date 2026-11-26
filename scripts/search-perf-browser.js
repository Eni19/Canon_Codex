// Abra a busca geral no mundo sintético e execute no Console do navegador.
(async () => {
  const input = document.querySelector('input[placeholder^="Buscar personagens"]')
  const dialog = input?.closest('[role="dialog"]')
  if (!dialog) throw new Error('Abra a busca geral com Ctrl+K.')
  const cases = [['Auorra', 'Aurora'], ['Mirante', 'Mirante'], ['Coruja', 'Zafira'], ['#lunar', 'Quorum']]
  const samples = []
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  for (let round = 0; round <= 10; round++) {
    for (const [query, expected] of cases) {
      if (document.hidden) throw new Error('Mantenha a aba visível.')
      setValue.call(input, query)
      const start = performance.now()
      input.dispatchEvent(new Event('input', { bubbles: true }))
      let visible = false
      while (performance.now() - start < 5000) {
        await frame()
        const title = dialog.querySelector('button span.flex-1')
        if (title?.textContent === expected && title.getBoundingClientRect().height > 0) {
          await frame()
          visible = true
          break
        }
      }
      if (!visible) throw new Error('Resultado esperado ausente: ' + expected)
      if (round) samples.push({ query, ms: performance.now() - start })
    }
  }
  const times = samples.map(sample => sample.ms).sort((a, b) => a - b)
  const p95 = times[Math.ceil(times.length * .95) - 1]
  console.table(samples)
  console.log({ browser: navigator.userAgent, viewport: [innerWidth, innerHeight], p95,
    percentWithin300: 100 * times.filter(ms => ms <= 300).length / times.length, passed: p95 <= 300 })
})()
