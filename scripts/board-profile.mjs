// Perfil de pan, zoom e arraste do quadro via CDP (intervalos de DrawFrame). Use só com o mundo
// sintético de scripts/seed-board-stress.test.ts.
// Uso: node scripts/board-profile.mjs http://localhost:3212/boards/<id> <rótulo> [segundos] [vista]
// vista: "fit" (enquadra os 1.400 itens) ou "100" (zoom 100% sobre os cartões; inclui o arraste).
// CHROME_PATH aponta para um Chrome ou Edge; PROFILE=1 imprime as funções mais amostradas no pan.
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const [url, label = 'run', secondsArg = '10', view = 'fit'] = process.argv.slice(2)
const seconds = Number(secondsArg)
const boardId = url.split('/').pop()
const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(path.join(tmpdir(), 'cdp-board-'))
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--window-size=1440,900', '--force-device-scale-factor=1', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let target
for (let i = 0; i < 50 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page') } catch {}
  if (!target) await sleep(200)
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0; const pending = new Map(); const listeners = []
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  else listeners.forEach((l) => l(msg))
})
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
// Gravações bloqueadas: o ensaio não muda nem o mundo sintético. Contá-las confirma que o arraste
// moveu um cartão (selecionar uma área não salva nada).
let saves = 0
await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/boards/*', requestStage: 'Request' }] })
listeners.push((m) => {
  if (m.method !== 'Fetch.requestPaused') return
  const { requestId, request } = m.params
  if (request.method === 'PUT') saves++
  if (request.method === 'PUT') void send('Fetch.fulfillRequest', { requestId, responseCode: 200, body: Buffer.from('{"updatedAt":"x"}').toString('base64') })
  else void send('Fetch.continueRequest', { requestId })
})
// Câmera inicial: sem nada salvo, o quadro enquadra tudo; com "100", começa a 100% sobre os cartões.
await send('Page.navigate', { url: new URL('/boards', url).href }); await sleep(2500)
await evalJs(`localStorage.clear(); ${view === '100' ? `localStorage.setItem('canon-codex:board-camera:${boardId}', JSON.stringify({ x: 400, y: 120, z: 1 }))` : ''}`)
await send('Page.navigate', { url })
for (let i = 0; i < 100; i++) { if (await evalJs('!!document.querySelector("[aria-label=\'Canvas do quadro\'] canvas")')) break; await sleep(200) }
await sleep(2500)
const rect = await evalJs('(() => { const r = document.querySelector("[aria-label=\'Canvas do quadro\']").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })()')
const cx = rect.x + rect.w * 0.6, cy = rect.y + rect.h / 2

async function trace(gesture) {
  const events = []
  const onData = (m) => { if (m.method === 'Tracing.dataCollected') events.push(...m.params.value) }
  listeners.push(onData)
  let done
  const complete = new Promise((r) => { done = r })
  listeners.push((m) => { if (m.method === 'Tracing.tracingComplete') done() })
  await send('Tracing.start', { categories: 'disabled-by-default-devtools.timeline.frame,devtools.timeline,benchmark', transferMode: 'ReportEvents' })
  await gesture(Date.now() + seconds * 1000)
  await send('Tracing.end'); await complete
  const draws = events.filter((e) => e.name === 'DrawFrame').map((e) => e.ts).sort((a, b) => a - b)
  const intervals = draws.slice(1).map((t, i) => (t - draws[i]) / 1000).sort((a, b) => a - b)
  const q = (p) => intervals[Math.min(intervals.length - 1, Math.floor(p * intervals.length))]
  return { frames: draws.length, p50: q(0.5)?.toFixed(2), p95: q(0.95)?.toFixed(2), dropped: events.filter((e) => e.name === 'DroppedFrame').length }
}
const wheel = (deltaX, deltaY, modifiers = 0) => send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: cx, y: cy, deltaX, deltaY, modifiers })
const mouse = (type, x, y, buttons = 1) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 })
const results = {}
if (process.env.PROFILE) { await send('Profiler.enable'); await send('Profiler.setSamplingInterval', { interval: 200 }); await send('Profiler.start') }
results.pan = await trace(async (end) => {
  let t = 0
  while (Date.now() < end) { t++; await wheel(Math.sin(t / 10) * 40, Math.cos(t / 10) * 40) }
})
if (process.env.PROFILE) {
  const { result } = await send('Profiler.stop'); const prof = result.profile
  const total = new Map(); const byId = new Map(prof.nodes.map((n) => [n.id, n]))
  const counts = new Map(); for (const s of prof.samples) counts.set(s, (counts.get(s) ?? 0) + 1)
  for (const [nid, c] of counts) { const n = byId.get(nid); const k = n.callFrame.functionName + ' ' + n.callFrame.url.split('/').pop() + ':' + n.callFrame.lineNumber + ':' + n.callFrame.columnNumber; total.set(k, (total.get(k) ?? 0) + c) }
  console.error([...total].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, c]) => c + ' ' + k).join('\n'))
}
results.zoom = await trace(async (end) => {
  let t = 0
  while (Date.now() < end) { t++; await wheel(0, (Math.floor(t / 20) % 2 ? 1 : -1) * 53, 2) }
})
if (view === '100') {
  // Cartão 0 fica em (400 + 140, 120 + 85) no canvas com a câmera inicial; o pan acima o deslocou,
  // então recarrega a câmera antes do arraste.
  await evalJs(`localStorage.setItem('canon-codex:board-camera:${boardId}', JSON.stringify({ x: 400, y: 120, z: 1 }))`)
  await send('Page.reload'); await sleep(4000)
  const card = { x: rect.x + 540 + 400 - 400, y: rect.y + 205 }
  results.drag = await trace(async (end) => {
    await mouse('mouseMoved', card.x, card.y, 0)
    await mouse('mousePressed', card.x, card.y)
    let t = 0
    while (Date.now() < end) { t++; await mouse('mouseMoved', card.x + 120 * Math.sin(t / 15), card.y + 80 * Math.cos(t / 15)) }
    await mouse('mouseReleased', card.x, card.y, 0)
  })
  const before = saves
  await sleep(1500)
  results.drag.movedCard = saves > before || saves > 0
}
console.log(JSON.stringify({ label, view, rect, ...results }))
ws.close(); chrome.kill()
