// Perfil de pan, zoom e arraste do grafo via CDP (DrawFrame). Use só com mundos sintéticos.
// Uso: node scripts/relationship-graph-profile.mjs http://localhost:3211/relationships <rótulo> [segundos]
// CHROME_PATH aponta para o Chrome; PROFILE=1 imprime as funções mais amostradas no zoom;
// PROFILE_ZOOM=n aproxima n passos antes dos gestos.
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const [url, label = 'run', secondsArg = '10'] = process.argv.slice(2)
const seconds = Number(secondsArg)
const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(path.join(tmpdir(), 'cdp-prof-'))
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
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url })
const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value
for (let i = 0; i < 100; i++) { if (await evalJs('!!document.querySelector("canvas")')) break; await sleep(200) }
await sleep(1500)
const rect = await evalJs('(() => { const c = [...document.querySelectorAll("canvas")].pop(); const r = c.parentElement.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })()')
const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2
// PROFILE_ZOOM=n starts every gesture n zoom steps closer than the framed graph (about ×1.42 each),
// to measure the levels of detail between the batched overview and full cards.
for (let i = 0; i < Number(process.env.PROFILE_ZOOM ?? 0); i++) {
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: cx, y: cy, deltaX: 0, deltaY: -27, modifiers: 2 })
  await sleep(50)
}
if (process.env.PROFILE_ZOOM) await sleep(800)

async function trace(gesture) {
  const events = []
  const onMsg = (m) => { if (m.method === 'Tracing.dataCollected') events.push(...m.params.value) }
  listeners.push(onMsg)
  let done
  const complete = new Promise((r) => { done = r })
  listeners.push((m) => { if (m.method === 'Tracing.tracingComplete') done() })
  await send('Tracing.start', { categories: 'disabled-by-default-devtools.timeline.frame,devtools.timeline,benchmark', transferMode: 'ReportEvents' })
  const end = Date.now() + seconds * 1000
  await gesture(end)
  await send('Tracing.end'); await complete
  const draws = events.filter((e) => e.name === 'DrawFrame').map((e) => e.ts).sort((a, b) => a - b)
  const intervals = draws.slice(1).map((t, i) => (t - draws[i]) / 1000).sort((a, b) => a - b)
  const q = (p) => intervals[Math.min(intervals.length - 1, Math.floor(p * intervals.length))]
  const dropped = events.filter((e) => e.name === 'DroppedFrame').length
  return { frames: draws.length, p50: q(0.5)?.toFixed(2), p95: q(0.95)?.toFixed(2), dropped }
}
const mouse = (type, x, y, buttons = 1) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 })
// Pan on empty background: find an empty spot near the top-left corner of the canvas.
const empty = await evalJs(`(() => {
  const canvases = [...document.querySelectorAll('canvas')]
  const data = canvases.map((c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data)
  const r = canvases[0].getBoundingClientRect(); const w = canvases[0].width; const sx = w / r.width
  // Prefer the middle of the canvas; a dense layout may fill it, so fall back to the margins. The pan
  // gesture moves up to 200 px above the spot, so the fallback starts low enough to stay inside.
  for (const [x0, x1, y0, y1] of [[0.3, 0.7, 0.3, 0.7], [0.15, 0.85, 0.35, 0.95]]) for (let y = r.height * y0; y < r.height * y1; y += 7) for (let x = r.width * x0; x < r.width * x1; x += 7) {
    const px = Math.round(x * sx), py = Math.round(y * sx)
    let clear = true
    for (let oy = -12; oy <= 12 && clear; oy += 4) for (let ox = -12; ox <= 12 && clear; ox += 4)
      for (const d of data.slice(-1)) if (d[((py + oy) * w + px + ox) * 4 + 3] !== 0) { clear = false; break }
    const el = document.elementFromPoint(r.x + x, r.y + y)
    if (clear && el && el.tagName === 'CANVAS') return { x: r.x + x, y: r.y + y }
  }
  return null
})()`)
console.error('empty', empty)
const results = {}
results.pan = await trace(async (end) => {
  await mouse('mousePressed', empty.x, empty.y)
  let t = 0
  while (Date.now() < end) { t++; await mouse('mouseMoved', empty.x + 150 * Math.sin(t / 15), empty.y + 100 * Math.cos(t / 15) - 100) }
  await mouse('mouseReleased', empty.x, empty.y, 0)
})
if (process.env.PROFILE) { await send('Profiler.enable'); await send('Profiler.setSamplingInterval', { interval: 200 }); await send('Profiler.start') }
results.zoom = await trace(async (end) => {
  let t = 0
  while (Date.now() < end) { t++; await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: cx, y: cy, deltaX: 0, deltaY: (Math.floor(t / 20) % 2 ? 1 : -1) * 53, modifiers: 0 }) }
})
if (process.env.PROFILE) {
  const { result } = await send('Profiler.stop'); const prof = result.profile
  const total = new Map(); const byId = new Map(prof.nodes.map((n) => [n.id, n]))
  const counts = new Map(); for (const s of prof.samples) counts.set(s, (counts.get(s) ?? 0) + 1)
  for (const [nid, c] of counts) { const n = byId.get(nid); const k = n.callFrame.functionName + ' ' + n.callFrame.url.split('/').pop() + ':' + n.callFrame.lineNumber; total.set(k, (total.get(k) ?? 0) + c) }
  console.error([...total].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, c]) => c + ' ' + k).join(String.fromCharCode(10)))
}
// Drag a card: find a card by sampling for one via the debug hook if exposed, else drag at center.
const card = await evalJs(`(() => {
  const canvases = [...document.querySelectorAll('canvas')]; const c = canvases[canvases.length - 1]
  const r = c.getBoundingClientRect(); const ctx = c.getContext('2d'); const sx = c.width / r.width
  const d = ctx.getImageData(0, 0, c.width, c.height).data
  let best = null
  for (let y = 0; y < c.height; y += 3) for (let x = 0; x < c.width; x += 3) {
    let solid = true
    for (const [ox, oy] of [[0,0],[6,0],[-6,0],[0,4],[0,-4]]) { const i = ((y + oy) * c.width + (x + ox)) * 4; if (!(d[i + 3] === 255)) { solid = false; break } }
    if (solid) { const dist = Math.hypot(x / sx - r.width / 2, y / sx - r.height / 2); if (!best || dist < best.dist) best = { dist, x: r.x + x / sx, y: r.y + y / sx } }
  }
  return best && { x: best.x, y: best.y }
})()`) ?? { x: cx, y: cy }
results.drag = await trace(async (end) => {
  await mouse('mousePressed', card.x, card.y)
  let t = 0
  while (Date.now() < end) { t++; await mouse('mouseMoved', card.x + 120 * Math.sin(t / 15), card.y + 80 * Math.cos(t / 15)) }
  await mouse('mouseReleased', card.x, card.y, 0)
})
console.log(JSON.stringify({ label, empty, rect, card, ...results }))
ws.close(); chrome.kill()
