// Renders every scene in scenes/ with Excalidraw.
// A static scene becomes ../assets/<name>.svg.
// A flow scene has elements with customData.from and customData.to. Each step becomes ../motion/public/<name>/step-<k>.svg,
// and the header strip of each arrow becomes strip-<i>.svg. ../motion/src/flows.json tells Remotion what to play.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openExcalidraw } from './excalidraw-page.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCENES = join(HERE, 'scenes')
const ASSETS = join(HERE, '../assets')
const MOTION = join(HERE, '../motion')
const ACCENT = '#e8590c'
const STRIP_HEIGHT = 110

const visibleAt = (element, step) => (element.customData?.from ?? 0) <= step && step <= (element.customData?.to ?? Infinity)
const isNewAt = (element, step) => step > 0 && element.customData?.from === step
const cellKey = (cell) => `${cell.kind}|${cell.name}|${cell.detail}`

// Earlier steps keep their ink. The current step gets the accent. Later steps stay hidden.
function sceneAt(elements, step) {
  const byId = new Map(elements.map((element) => [element.id, element]))
  const owner = (element) => (element.containerId ? byId.get(element.containerId) : element)
  return elements
    .filter((element) => visibleAt(owner(element), step))
    .map((element) => {
      const container = owner(element)
      if (!isNewAt(container, step) || container.customData?.keepColor) return element
      if (element.containerId && container.type === 'ellipse') return element
      if (container.type === 'ellipse') return { ...element, strokeColor: ACCENT, backgroundColor: ACCENT }
      if (container.type === 'arrow') return { ...element, strokeColor: ACCENT, strokeWidth: 2.5 }
      if (container.type === 'rectangle' && element === container) return { ...element, strokeColor: ACCENT, strokeWidth: 2 }
      if (element.type === 'text' && !element.containerId) return { ...element, strokeColor: ACCENT }
      return element
    })
}

function stepCount(elements) {
  return Math.max(0, ...elements.map((element) => element.customData?.from ?? 0))
}

function arrowPath(arrow) {
  return arrow.points.map(([x, y]) => [arrow.x + x, arrow.y + y])
}

async function renderStrip(page, cells, previous) {
  const previousKeys = new Set((previous || []).map(cellKey))
  const isSameMessage = cells.some((cell) => previousKeys.has(cellKey(cell)))
  const marked = cells.map((cell) => ({ ...cell, changed: isSameMessage && !previousKeys.has(cellKey(cell)) }))
  return page.evaluate(async (cells, height, accent) => {
    const KIND = {
      payload: ['#ffffff', '#868e96'], mesh: ['#e6f4f1', '#0f766e'], tls: ['#f1ebfc', '#6d28d9'], net: ['#f8efe6', '#92400e'],
      dns: ['#e7f1fb', '#1c6fb8'], proxy: ['#fbe9f0', '#b4235a'], control: ['#fff9db', '#a37f00'],
    }
    const text = (id, x, y, value, extra) => ({ type: 'text', id, x, y, text: value, fontSize: 16, fontFamily: 5, strokeColor: '#1e1e1e', ...extra })
    const measured = window.convertScene(cells.flatMap((cell, i) => [
      text(`n${i}`, 0, 0, cell.name, { fontSize: 17 }),
      text(`d${i}`, 0, 0, cell.detail, { fontFamily: 8, fontSize: 15, strokeColor: '#343a40' }),
    ]))
    const widthOf = (id) => measured.find((element) => element.id === id).width
    const skeleton = [{ type: 'rectangle', id: 'bounds', x: 0, y: 0, width: 1160, height, strokeColor: 'transparent', backgroundColor: 'transparent' }]
    skeleton.push(text('label', 20, 52, 'headers', { fontSize: 15, strokeColor: '#868e96' }))
    let x = 100
    let encryptedFrom = null
    let encryptedTo = null
    let encryptedBy = ''
    cells.forEach((cell, i) => {
      const width = Math.max(widthOf(`n${i}`), widthOf(`d${i}`)) + 26
      const [fill, stroke] = KIND[cell.kind]
      skeleton.push({ type: 'rectangle', id: `c${i}`, x, y: 34, width, height: 60, backgroundColor: fill, fillStyle: 'solid', strokeColor: cell.changed ? accent : stroke, strokeWidth: cell.changed ? 2.5 : 1, roughness: 1 })
      skeleton.push(text(`n${i}`, x + 12, 42, cell.name, { fontSize: 17, strokeColor: cell.changed ? accent : '#1e1e1e' }))
      skeleton.push(text(`d${i}`, x + 12, 68, cell.detail, { fontFamily: 8, fontSize: 15, strokeColor: '#343a40' }))
      if (cell.encrypted) { encryptedFrom = encryptedFrom ?? x; encryptedTo = x + width; encryptedBy = cell.encrypted }
      x += width + 8
    })
    if (encryptedFrom !== null) {
      skeleton.push({ type: 'line', id: 'enc', x: encryptedFrom, y: 28, points: [[0, 0], [0, -8], [encryptedTo - encryptedFrom, -8], [encryptedTo - encryptedFrom, 0]], strokeColor: '#6d28d9', strokeWidth: 1, roundness: null })
      skeleton.push(text('enc-label', encryptedFrom + 10, 2, `encrypted by ${encryptedBy}`, { fontSize: 14, strokeColor: '#6d28d9' }))
    }
    return window.renderScene(window.convertScene(skeleton))
  }, marked, STRIP_HEIGHT, ACCENT)
}

async function renderFlow(page, name, elements, bounds) {
  const out = join(MOTION, 'public', name)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const steps = []
  let frame = null
  let previous = null
  let strips = 0
  for (let step = 1; step <= stepCount(elements); step++) {
    writeFileSync(join(out, `step-${step}.svg`), await page.evaluate((scene) => window.renderScene(scene), sceneAt(elements, step)))
    const arrows = []
    for (const arrow of elements.filter((element) => element.type === 'arrow' && element.customData?.from === step)) {
      if (arrow.customData.frame) {
        if (frame) previous = frame
        frame = arrow.customData.frame
        strips += 1
        writeFileSync(join(out, `strip-${strips}.svg`), await renderStrip(page, frame, previous))
      }
      arrows.push({ path: arrowPath(arrow), strip: strips })
    }
    steps.push({ arrows })
  }
  return { name, width: bounds.width, height: bounds.height, stripHeight: STRIP_HEIGHT, steps }
}

const { page, close } = await openExcalidraw()
const flows = []
try {
  mkdirSync(ASSETS, { recursive: true })
  for (const file of readdirSync(SCENES).filter((file) => file.endsWith('.excalidraw')).sort()) {
    const name = basename(file, '.excalidraw')
    const { elements } = JSON.parse(readFileSync(join(SCENES, file), 'utf8'))
    const bounds = elements.find((element) => element.customData?.bounds)
    if (!bounds) throw new Error(`${file} needs a bounds rectangle with customData.bounds`)
    if (stepCount(elements) === 0) {
      writeFileSync(join(ASSETS, `${name}.svg`), await page.evaluate((scene) => window.renderScene(scene), elements))
    } else {
      flows.push(await renderFlow(page, name, elements, bounds))
    }
    console.log(`rendered ${name}`)
  }
} finally {
  await close()
}
writeFileSync(join(MOTION, 'src/flows.json'), JSON.stringify(flows, null, 2) + '\n')
