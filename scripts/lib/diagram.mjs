import { render } from 'pele'

const WIDE = 640 // article width minus the diagram padding
const NARROW = 334 // phone width minus the gutters and the diagram padding
const MARKS = { breaks: 'Breaks a rule', mayBreak: 'Breaks a rule in some cases', bugPath: 'On the path to the bug', repeats: 'Repeats forever' }

// Turns one Mermaid block into a figure. A wide diagram gets a second, narrow
// render for phones. A state chart also gets its legend as HTML under it.
export function renderDiagram(source, { label, caption = '', id }) {
  if (!label) throw new Error(`diagram ${id} has no data-label`)
  const { text, legend } = takeLegend(source.trim())
  const wide = fit(text, `${id}w-`, WIDE)
  let body = frame(wide, WIDE, '')
  if (wide.width > NARROW + 40) {
    // A phone gets its own render. When that is still wide, it scrolls
    // sideways and keeps the text readable, rather than shrinking it.
    const narrow = fit(text, `${id}n-`, NARROW)
    body = frame(wide, WIDE, 'wide-only') + frame(narrow.width < wide.width * 0.9 ? narrow : wide, NARROW, 'narrow')
  }
  const cap = caption ? `<figcaption>${caption}</figcaption>` : ''
  const cls = /^stateDiagram/.test(text) ? 'diagram statechart' : 'diagram'
  return `<figure><div class="${cls}" role="img" aria-label="${label}">${body}${legend}</div>${cap}</figure>`
}

function frame(result, target, cls) {
  const scroll = result.width > target * 1.4 ? ` scroll" style="--w:${Math.ceil(result.width)}px` : ''
  return `<div class="${`${cls}${scroll}`.trim()}">${result.svg}</div>`
}

// Pele turns a wide LR flowchart into a vertical one, but not every type.
// So when LR is still much too wide, try TB and keep the one that fits better.
// A little too wide is fine: the SVG shrinks to the column.
function fit(text, idPrefix, maxWidth) {
  const first = draw(text, idPrefix, maxWidth)
  if (first.width <= maxWidth * 1.4 || !/direction\s+LR|^(flowchart|graph)\s+LR/m.test(text)) return first
  const tb = draw(text.replace(/direction\s+LR/, 'direction TB').replace(/^(flowchart|graph)\s+LR/m, '$1 TB'), idPrefix, maxWidth)
  return tb.width < first.width ? tb : first
}

// The statechart command puts a "Legend" box in the chart. It makes the chart
// wider, so the build draws it as a row of keys under the chart.
function takeLegend(text) {
  const box = text.match(/^\s*state "Legend" as (\w+) \{\n([\s\S]*?)\n\s*\}\s*$/m)
  const used = new Set([...text.matchAll(/^\s*class\s+([\w,]+)\s+(\w+)/gm)].filter((m) => !m[1].startsWith('lg')).map((m) => m[2]))
  let keys = []
  let out = text
  if (box) {
    const labels = Object.fromEntries([...box[2].matchAll(/(\w+):\s*(.+)/g)].map((m) => [m[1], m[2].trim()]))
    const classes = Object.fromEntries([...text.matchAll(/^\s*class\s+(lg\w*)\s+(\w+)/gm)].map((m) => [m[1], m[2]]))
    keys = Object.entries(labels).map(([k, v]) => [classes[k] || '', v])
    out = out.replace(box[0], '').replace(/^\s*class\s+lg\w*\s+\w+\s*$/gm, '')
  }
  for (const [cls, name] of Object.entries(MARKS)) if (used.has(cls) && !keys.some(([c]) => c === cls)) keys.push([cls, name])
  const legend = keys.length ? `<ul class="legend">${keys.map(([c, v]) => `<li><i class="k ${c}"></i>${v}</li>`).join('')}</ul>` : ''
  return { text: out.replace(/\n{3,}/g, '\n\n'), legend }
}

function draw(text, idPrefix, maxWidth) {
  try {
    return render(text, { idPrefix, maxWidth, fontSize: 14, fontFamily: 'system-ui, sans-serif', limit: 1_000_000, outputLimit: 8_000_000, maxEdges: 10_000 })
  } catch (error) {
    throw new Error(`diagram ${idPrefix.slice(0, -2)}: ${error.message}`)
  }
}
