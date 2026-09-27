// Generates the sketch-style SVG diagrams for the WG Mesh deck.
// A flow diagram loops a small packet along each active arrow, and a frame strip shows the headers on that arrow.
// Every shape has a seed from its position, so a diagram looks the same in each stage.
import rough from 'roughjs'
import { writeFileSync, mkdirSync } from 'node:fs'

const OUT = process.argv[2]
mkdirSync(OUT, { recursive: true })

const gen = rough.generator()
const INK = '#1e1e1e'
const MUTED = '#ced4da'
const MUTED_TEXT = '#adb5bd'
const NOTE = '#6c757d'
const ACCENT = '#e8590c'
const RED = '#c92a2a'
const KIND = {
  plain: { fill: '#ffffff', stroke: '#495057' },
  payload: { fill: '#ffffff', stroke: '#868e96' },
  mesh: { fill: '#e6f4f1', stroke: '#0f766e' },
  wg: { fill: '#f1ebfc', stroke: '#6d28d9' },
  under: { fill: '#f8efe6', stroke: '#92400e' },
  ndp: { fill: '#f8efe6', stroke: '#92400e' },
  gw: { fill: '#fbe9f0', stroke: '#b4235a' },
  priv: { fill: '#fff9db', stroke: '#a37f00' },
  host: { fill: '#f8f9fa', stroke: '#868e96' },
}
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace"
const MOTION_STYLE = '<style>.static{display:none}@media (prefers-reduced-motion: reduce){.anim{display:none}.static{display:inline}}</style>'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const plain = (s) => String(s).replace(/\*/g, '')
const seedOf = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h % 100000) + 1 }
const sansWidth = (s, size) => plain(s).length * size * 0.55
const monoWidth = (s, size) => plain(s).length * size * 0.6
const opts = (key, o = {}) => ({ roughness: 1.1, bowing: 0.8, strokeWidth: 1.6, seed: seedOf(key), ...o })
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const fixed = (v) => Number(v.toFixed(4))
const pathLength = (pts) => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0)
const cellKey = (c) => `${c.kind}|${c.name}|${plain(c.detail)}`
const sameFrame = (a, b) => a && b && a.map(cellKey).join('/') === b.map(cellKey).join('/')

function roughSvg(drawable, dash = '') {
  const attr = dash ? ` stroke-dasharray="${dash}"` : ''
  return gen.toPaths(drawable).map((p) =>
    `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"${attr}/>`).join('')
}

// Text between asterisks is drawn in the accent colour.
function richText(line) {
  const arrows = (t) => esc(t).replace(/[→↔]/g, (a) => `<tspan font-family="${FONT}">${a}</tspan>`)
  return String(line).split('*').map((part, i) => (i % 2 ? `<tspan fill="${ACCENT}" font-weight="700">${arrows(part)}</tspan>` : arrows(part))).join('')
}

function textSvg(x, y, text, { size = 19, color = INK, anchor = 'middle', bold = false, mono = false, bg = false } = {}) {
  const lines = String(text).split('\n')
  const lh = size * 1.28
  const top = y - (lines.length - 1) * lh / 2
  const width = (l) => (mono ? monoWidth(l, size) : sansWidth(l, size))
  let out = ''
  if (bg) {
    const w = Math.max(...lines.map(width)) + 14
    const bx = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x - 7 : x - w + 7
    out += `<rect x="${bx}" y="${top - lh / 2 - 2}" width="${w}" height="${lines.length * lh + 4}" rx="4" fill="#ffffff" opacity="0.94"/>`
  }
  const family = mono ? ` font-family="${MONO}"` : ''
  out += `<text font-size="${size}" fill="${color}" text-anchor="${anchor}" dominant-baseline="central" font-weight="${bold ? 650 : 400}"${family}>` +
    lines.map((l, i) => `<tspan x="${x}" y="${top + i * lh}">${richText(l)}</tspan>`).join('') + '</text>'
  return out
}

// A discrete opacity window [start, end) inside a loop of length loop seconds.
function windowAnimation(start, end, loop) {
  if (start <= 0 && end >= loop) return ''
  const values = []
  const times = []
  if (start <= 0) { values.push(1); times.push(0) } else { values.push(0, 1); times.push(0, fixed(start / loop)) }
  if (end < loop) { values.push(0); times.push(fixed(end / loop)) }
  return `<animate attributeName="opacity" dur="${fixed(loop)}s" repeatCount="indefinite" calcMode="discrete" values="${values.join(';')}" keyTimes="${times.join(';')}"/>`
}

class Diagram {
  constructor(w, sceneHeight, { panel = false } = {}) {
    this.w = w
    this.panel = panel
    this.panelTop = sceneHeight + 8
    this.h = panel ? sceneHeight + 96 : sceneHeight
    this.parts = []
    this.animated = []
    this.still = []
    if (panel) {
      this.parts.push(`<line x1="20" y1="${sceneHeight + 4}" x2="${w - 20}" y2="${sceneHeight + 4}" stroke="#e9ecef" stroke-width="1.5" stroke-dasharray="6 6"/>`)
      this.parts.push(textSvg(20, this.panelTop + 52, 'packet', { size: 15, color: NOTE, anchor: 'start', bold: true }))
    }
  }

  save(name, alt) {
    const motion = this.animated.length ? MOTION_STYLE : ''
    const still = this.still.length ? `<g class="static">${this.still.join('')}</g>` : ''
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" font-family="${FONT}" role="img" aria-label="${esc(alt)}">` +
      `${motion}<rect width="100%" height="100%" fill="#ffffff"/>${this.parts.join('')}${still}${this.animated.join('')}</svg>\n`
    writeFileSync(`${OUT}/${name}.svg`, svg)
  }

  label(x, y, text, o) { this.parts.push(textSvg(x, y, text, o)) }

  // An accent note belongs to the current step. A grey note stays the same in every step.
  note(x, y, text, { accent = false, anchor = 'middle', size = 16 } = {}) {
    this.parts.push(textSvg(x, y, text, { size, color: accent ? ACCENT : NOTE, anchor, bg: true, mono: true, bold: accent }))
  }

  box(x, y, w, h, text, { kind = 'plain', dashed = false, muted = false, size = 19, bold = false } = {}) {
    const k = KIND[kind]
    const stroke = muted ? MUTED : k.stroke
    this.parts.push(`<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="6" fill="${muted ? '#fafafa' : k.fill}"/>`)
    this.parts.push(roughSvg(gen.rectangle(x, y, w, h, opts(`box${x},${y},${w},${h}`, { stroke })), dashed ? '8 6' : ''))
    if (text) this.label(x + w / 2, y + h / 2, text, { size, color: muted ? MUTED_TEXT : INK, bold })
  }

  group(x, y, w, h, text) {
    const k = KIND.host
    this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${k.fill}" opacity="0.6"/>`)
    this.parts.push(roughSvg(gen.rectangle(x, y, w, h, opts(`grp${x},${y}`, { stroke: k.stroke, strokeWidth: 1.2, roughness: 0.8 })), '6 6'))
    this.label(x + 14, y + 20, text, { size: 17, color: '#495057', anchor: 'start', bold: true })
  }

  head(a, b, color, width, key) {
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0])
    const p1 = [b[0] - 14 * Math.cos(angle - 0.42), b[1] - 14 * Math.sin(angle - 0.42)]
    const p2 = [b[0] - 14 * Math.cos(angle + 0.42), b[1] - 14 * Math.sin(angle + 0.42)]
    this.parts.push(roughSvg(gen.linearPath([p1, b, p2], opts(key, { stroke: color, strokeWidth: width, roughness: 0.6 }))))
  }

  // state: normal (done or fixed), active (the current step), muted, or hidden
  arrow(pts, { text = '', n = null, state = 'normal', both = false, dashed = false, color, lx, ly, anchor = 'middle', size = 17, plain: bare = false } = {}) {
    if (state === 'hidden') return
    const stroke = state === 'active' ? ACCENT : state === 'muted' ? MUTED : color || INK
    const width = state === 'active' ? 2.6 : 1.6
    const key = 'arr' + pts.flat().join(',')
    this.parts.push(roughSvg(gen.linearPath(pts, opts(key, { stroke, strokeWidth: width, roughness: 0.9 })), dashed ? '7 6' : ''))
    if (!bare) this.head(pts[pts.length - 2], pts[pts.length - 1], stroke, width, key + 'h')
    if (both && !bare) this.head(pts[1], pts[0], stroke, width, key + 't')
    if (!text && n === null) return
    if (lx === undefined || ly === undefined) {
      let best = 0
      let middle = pts[0]
      for (let i = 1; i < pts.length; i++) {
        const length = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        if (length > best) { best = length; middle = [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2] }
      }
      lx = lx ?? middle[0]
      ly = ly ?? middle[1]
    }
    const textColor = state === 'muted' ? MUTED_TEXT : state === 'active' ? ACCENT : color || INK
    this.step(lx, ly, n, text, { color: textColor, badge: state === 'muted' ? MUTED_TEXT : stroke, anchor, size, bold: state === 'active' })
  }

  step(x, y, n, text, { color = INK, badge = INK, anchor = 'middle', size = 17, bold = false } = {}) {
    const lines = String(text).split('\n')
    const tw = text ? Math.max(...lines.map((l) => sansWidth(l, size))) * (bold ? 1.06 : 1) : 0
    const bw = n === null ? 0 : (text ? 28 : 22)
    const total = bw + tw
    const start = anchor === 'middle' ? x - total / 2 : anchor === 'start' ? x : x - total
    const lh = size * 1.28
    this.parts.push(`<rect x="${start - 6}" y="${y - lines.length * lh / 2 - 3}" width="${total + 12}" height="${lines.length * lh + 6}" rx="4" fill="#ffffff" opacity="0.94"/>`)
    if (n !== null) {
      this.parts.push(`<circle cx="${start + 11}" cy="${y}" r="11" fill="${badge}"/><text x="${start + 11}" y="${y}" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${n}</text>`)
    }
    if (text) this.label(start + bw, y, text, { size, color, anchor: 'start', bold })
  }

  cross(x, y) {
    const s = 12
    this.parts.push(roughSvg(gen.line(x - s, y - s, x + s, y + s, opts(`x1${x},${y}`, { stroke: RED, strokeWidth: 2.8 }))))
    this.parts.push(roughSvg(gen.line(x + s, y - s, x - s, y + s, opts(`x2${x},${y}`, { stroke: RED, strokeWidth: 2.8 }))))
  }

  brace(x1, x2, y, { up = false, color = INK, depth = 14 } = {}) {
    const d = up ? -depth : depth
    const middle = (x1 + x2) / 2
    const r = Math.min(depth, (x2 - x1) / 4)
    const path = `M ${x1} ${y} Q ${x1} ${y + d} ${x1 + r} ${y + d} L ${middle - r} ${y + d} Q ${middle} ${y + d} ${middle} ${y + 2 * d} ` +
      `Q ${middle} ${y + d} ${middle + r} ${y + d} L ${x2 - r} ${y + d} Q ${x2} ${y + d} ${x2} ${y}`
    this.parts.push(roughSvg(gen.path(path, opts(`brace${x1},${y}`, { stroke: color, strokeWidth: 1.8, roughness: 0.5 }))))
  }

  // The header strip. A cell that is new since the previous frame gets the accent.
  frameSvg(frame, previous) {
    const previousKeys = new Set((previous || []).map(cellKey))
    const isSamePacket = frame.some((c) => previousKeys.has(cellKey(c)))
    const top = this.panelTop + 26
    const height = 56
    let x = 96
    let encryptedFrom = null
    let encryptedTo = null
    let out = ''
    for (const c of frame) {
      const w = Math.max(sansWidth(c.name, 16) * 1.08, monoWidth(c.detail, 15)) + 26
      const changed = isSamePacket && !previousKeys.has(cellKey(c))
      const k = KIND[c.kind]
      out += `<rect x="${x + 1}" y="${top + 1}" width="${w - 2}" height="${height - 2}" rx="4" fill="${k.fill}"/>`
      out += roughSvg(gen.rectangle(x, top, w, height, opts(`cell${x},${c.name}`, { stroke: changed ? ACCENT : k.stroke, strokeWidth: changed ? 2.8 : 1.4, roughness: 0.7 })))
      out += textSvg(x + 12, top + 18, c.name, { size: 16, bold: true, anchor: 'start', color: changed ? ACCENT : INK })
      out += textSvg(x + 12, top + 40, c.detail, { size: 15, mono: true, anchor: 'start', color: '#343a40' })
      if (c.encrypted) { encryptedFrom = encryptedFrom ?? x; encryptedTo = x + w }
      x += w + 6
    }
    if (encryptedFrom !== null) {
      const y = top - 10
      out += roughSvg(gen.linearPath([[encryptedFrom, y + 6], [encryptedFrom, y], [encryptedTo, y], [encryptedTo, y + 6]], opts(`enc${encryptedFrom}`, { stroke: KIND.wg.stroke, strokeWidth: 1.4, roughness: 0.5 })))
      out += textSvg((encryptedFrom + encryptedTo) / 2, y, 'encrypted by WireGuard', { size: 13, color: KIND.wg.stroke, bg: true, bold: true })
    }
    return out
  }

  // A small packet icon: one bar per header, outer header on the left.
  packetIcon(frame) {
    const bar = 8
    const height = 20
    const width = frame.length * bar
    const bars = frame.map((c, i) => `<rect x="${i * bar}" y="0" width="${bar}" height="${height}" fill="${KIND[c.kind].fill}" stroke="${KIND[c.kind].stroke}" stroke-width="1.3"/>`).join('')
    return `<g transform="translate(${-width / 2} ${-height / 2})"><rect x="-3" y="-3" width="${width + 6}" height="${height + 6}" rx="4" fill="#ffffff" stroke="${ACCENT}" stroke-width="2"/>${bars}</g>`
  }

  // Loop the packet along each segment in order. The frame strip follows the packet.
  play(segments, entry) {
    const items = []
    let time = 0.5
    for (const segment of segments) {
      const duration = clamp(pathLength(segment.pts) / 250, 0.9, 2.4)
      items.push({ ...segment, start: time, end: time + duration })
      time += duration + 0.9
    }
    const loop = time + 0.8

    items.forEach((item, i) => {
      const hideAt = items[i + 1] ? items[i + 1].start : loop - 0.3
      const path = item.pts.map(([x, y], j) => `${j ? 'L' : 'M'}${x},${y}`).join(' ')
      const a = fixed(item.start / loop)
      const b = fixed(item.end / loop)
      this.animated.push(`<g class="anim" opacity="0">${this.packetIcon(item.frame)}` +
        `<animateMotion dur="${fixed(loop)}s" repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;${a};${b};1" path="${path}"/>` +
        `<animate attributeName="opacity" dur="${fixed(loop)}s" repeatCount="indefinite" calcMode="discrete" values="0;1;0" keyTimes="0;${a};${fixed(hideAt / loop)}"/></g>`)
    })

    const windows = []
    items.forEach((item, i) => {
      const end = items[i + 1] ? items[i + 1].start : loop
      const last = windows[windows.length - 1]
      if (last && sameFrame(last.frame, item.frame)) { last.end = end; return }
      windows.push({ frame: item.frame, previous: last ? last.frame : entry, start: i === 0 ? 0 : item.start, end })
    })
    for (const w of windows) {
      this.animated.push(`<g class="anim" opacity="${w.start <= 0 ? 1 : 0}">${this.frameSvg(w.frame, w.previous)}${windowAnimation(w.start, w.end, loop)}</g>`)
    }
    const last = windows[windows.length - 1]
    this.still.push(this.frameSvg(last.frame, last.previous))
  }
}

// Draw the arrows of a staged flow. Earlier stages stay in ink, the current stage is the accent, later stages are hidden.
function flow(d, arrows, stage, { entry = null } = {}) {
  let frame = null
  let previous = entry
  const segments = []
  for (const a of arrows) {
    if (a.frame) frame = a.frame
    const state = a.stage === stage ? 'active' : a.stage < stage ? 'normal' : 'hidden'
    if (a.stage < stage) previous = frame
    d.arrow(a.pts, { ...a, state })
    if (state !== 'active') continue
    segments.push({ pts: a.pts, frame })
    if (a.drop) d.cross(...a.pts[a.pts.length - 1])
  }
  if (segments.length && d.panel) d.play(segments, previous)
}

function notes(d, list, stage) {
  for (const n of list) {
    if (n.stage === 0) d.note(n.x, n.y, n.text, { anchor: n.anchor })
    else if (n.stage === stage) d.note(n.x, n.y, n.text, { accent: true, anchor: n.anchor })
  }
}

// Frames and addresses
const cell = (kind, name, detail, extra = {}) => ({ kind, name, detail, ...extra })
const TCP = cell('payload', 'TCP', 'data')
const A = 'fdaa:1:0:2::3'
const B = 'fdaa:1:0:2::7'
const C = 'fdaa:1:0:2::9'
const V = 'fdaa:1:0:abcd::5'
const GATEWAY = 'fdaa:1::56'
const PROXY = 'fdaa:1::10'
const CLIENT = '2001:db8:ffff::10'
const PUBLIC = '2001:db8:1:2:3:a:bcd0:5'
const mesh = (source, destination) => cell('mesh', 'IPv6', `${source} → ${destination}`)
const tunnel = (source, destination, next = 41) => cell('wg', `IPv6 · next header ${next}`, `${source} → ${destination}`)
const encrypted = (frame) => frame.map((c) => ({ ...c, encrypted: true }))
const wire = (source, destination, frame) => [cell('under', 'IPv4 + UDP', `${source} → ${destination}`), cell('wg', 'WireGuard', 'data message'), ...encrypted(frame)]
const solicitation = (target) => [cell('ndp', 'Neighbor Solicitation', `who has ${target}?`)]
const advertisement = (target, host) => [cell('ndp', 'Neighbor Advertisement', `${target} is at ${host} MAC`)]

const AB = [mesh(A, B), TCP]
const AB_TUNNEL = [tunnel('fdab::1', 'fdab::2'), ...AB]
const AB_WIRE = wire('10.0.0.1', '10.0.0.2', AB_TUNNEL)

function address() {
  const d = new Diagram(1160, 400)
  const size = 44
  const cw = size * 0.6
  const text = 'fdaa:0001:0000:0002:0000:0000:0000:0003'
  const x0 = (1160 - text.length * cw) / 2
  const fields = [
    [0, 4, 'prefix', 'fdaa · a VM', KIND.plain.stroke],
    [5, 9, 'region', '16 bits · 1', KIND.under.stroke],
    [10, 19, 'tenant', '32 bits · 2', KIND.wg.stroke],
    [20, 39, 'VM ID', '64 bits · 3', KIND.mesh.stroke],
  ]
  d.label(580, 44, 'fdaa:1:0:2::3', { size: 30, mono: true, bold: true })
  d.label(580, 82, 'written in full', { size: 17, color: NOTE })
  for (let i = 0; i < text.length; i++) {
    const field = fields.find(([from, to]) => i >= from && i < to)
    d.parts.push(`<text x="${x0 + i * cw + cw / 2}" y="160" font-size="${size}" font-family="${MONO}" text-anchor="middle" dominant-baseline="central" fill="${field ? field[4] : MUTED_TEXT}" font-weight="600">${text[i]}</text>`)
  }
  for (const [from, to, name, detail, color] of fields) {
    const x1 = x0 + from * cw + 2
    const x2 = x0 + to * cw - 2
    d.brace(x1, x2, 190, { color })
    d.label((x1 + x2) / 2, 246, name, { size: 22, bold: true, color })
    d.label((x1 + x2) / 2, 274, detail, { size: 17, color: NOTE })
  }
  d.label(x0 + 14.5 * cw, 302, 'the hooks compare this', { size: 17, color: ACCENT, bold: true })
  d.label(580, 360, 'fdab::/16 is the host range: one WireGuard address per host. A VM can never send to it.', { size: 18, color: NOTE })
  d.save('address', 'The address fdaa:1:0:2::3 written in full as fdaa:0001:0000:0002:0000:0000:0000:0003. Braces mark the fdaa prefix, the 16-bit region 1, the 32-bit tenant 2, and the 64-bit VM ID 3. The hooks compare the tenant field for isolation.')
}

function mapping() {
  const d = new Diagram(1160, 420)
  const size = 38
  const cw = size * 0.6
  const x0 = (1160 - 39 * cw) / 2
  const publicText = '2001:0db8:0001:0002:0003:000a:bcd0:0005'
  const meshText = 'fdaa:0001:0000:abcd:0000:0000:0000:0005'
  const publicFields = [
    [0, 24, 'router block /80', KIND.gw.stroke, 58],
    [25, 26, 'reserved 0', MUTED_TEXT, 26],
    [26, 33, 'tenant · 24 bits', KIND.wg.stroke, 58],
    [33, 39, 'VM · 20 bits', KIND.mesh.stroke, 58],
  ]
  const meshFields = [
    [0, 4, 'fdaa', KIND.plain.stroke],
    [5, 9, 'region', KIND.under.stroke],
    [10, 19, 'tenant · 32 bits', KIND.wg.stroke],
    [20, 39, 'VM ID · 64 bits', KIND.mesh.stroke],
  ]
  const row = (text, y, fields) => {
    for (let i = 0; i < text.length; i++) {
      const field = fields.find(([from, to]) => i >= from && i < to)
      d.parts.push(`<text x="${x0 + i * cw + cw / 2}" y="${y}" font-size="${size}" font-family="${MONO}" text-anchor="middle" dominant-baseline="central" fill="${field ? field[3] : MUTED_TEXT}" font-weight="600">${text[i]}</text>`)
    }
  }
  row(publicText, 130, publicFields)
  row(meshText, 272, meshFields)
  d.label(40, 130, 'public', { size: 17, color: NOTE, anchor: 'start', bold: true })
  d.label(40, 272, 'mesh', { size: 17, color: NOTE, anchor: 'start', bold: true })
  for (const [from, to, name, color, labelY] of publicFields) {
    const x1 = x0 + from * cw + 1
    const x2 = x0 + to * cw - 1
    d.brace(x1, x2, 104, { up: true, color, depth: 10 })
    d.label((x1 + x2) / 2, labelY, name, { size: 17, bold: true, color, bg: true })
  }
  for (const [from, to, name, color] of meshFields) {
    const x1 = x0 + from * cw + 1
    const x2 = x0 + to * cw - 1
    d.brace(x1, x2, 298, { color, depth: 10 })
    d.label((x1 + x2) / 2, 344, name, { size: 17, bold: true, color })
  }
  d.arrow([[x0 + 29.5 * cw, 150], [x0 + 14.5 * cw, 252]], { state: 'active', both: true, dashed: true })
  d.arrow([[x0 + 36 * cw, 150], [x0 + 29.5 * cw, 252]], { state: 'active', both: true, dashed: true })
  d.label(580, 394, `${PUBLIC}   ↔   ${V}`, { size: 20 })
  d.save('mapping', 'The public address 2001:db8:1:2:3:a:bcd0:5 written in full above the mesh address fdaa:1:0:abcd::5. Braces mark the router block /80, a reserved zero, a 24-bit tenant, and a 20-bit VM in the public address, and the fdaa prefix, region, 32-bit tenant, and 64-bit VM ID in the mesh address. Arrows join the tenant fields and the VM fields.')
}

function layers() {
  const d = new Diagram(1160, 380, { panel: true })
  d.group(20, 10, 360, 360, 'Host 1')
  d.group(780, 10, 360, 360, 'Host 2')
  d.box(60, 44, 280, 66, 'VM A\nfdaa:1:0:2::3', { kind: 'mesh' })
  d.box(60, 164, 280, 66, 'wg0\nfdab::1', { kind: 'wg' })
  d.box(60, 284, 280, 66, 'private uplink\n10.0.0.1', { kind: 'under' })
  d.box(820, 44, 280, 66, 'VM B\nfdaa:1:0:2::7', { kind: 'mesh' })
  d.box(820, 164, 280, 66, 'wg0\nfdab::2', { kind: 'wg' })
  d.box(820, 284, 280, 66, 'private uplink\n10.0.0.2', { kind: 'under' })
  d.arrow([[340, 77], [818, 77]], { text: 'layer 3 · mesh · what the VMs see', dashed: true, color: KIND.mesh.stroke })
  d.arrow([[340, 197], [818, 197]], { text: 'layer 2 · WireGuard between hosts', dashed: true, color: KIND.wg.stroke })
  flow(d, [
    { stage: 1, pts: [[200, 112], [200, 162]], text: 'VM hook wraps', lx: 215, ly: 137, anchor: 'start', frame: AB_TUNNEL },
    { stage: 1, pts: [[200, 232], [200, 282]], text: 'WireGuard encrypts', lx: 215, ly: 257, anchor: 'start', frame: AB_WIRE },
    { stage: 1, pts: [[340, 317], [818, 317]], text: 'layer 1 · provider network · the real wire', frame: AB_WIRE },
    { stage: 1, pts: [[960, 282], [960, 232]], text: 'decrypts', lx: 975, ly: 257, anchor: 'start', frame: AB_TUNNEL },
    { stage: 1, pts: [[960, 162], [960, 112]], text: 'WG hook unwraps', lx: 975, ly: 137, anchor: 'start', frame: AB },
  ], 1, { entry: AB })
  d.save('layers', 'Two hosts. VM A on host 1 sends to VM B on host 2. The VM hook adds an outer IPv6 header for host 2, WireGuard encrypts it and sends it as UDP over the provider private network, and host 2 decrypts and unwraps it for VM B. The packet strip shows the headers at each step.')
}

function host() {
  const d = new Diagram(1160, 440)
  d.group(190, 20, 760, 400, 'One host · tc eBPF hooks')
  d.box(20, 80, 140, 80, 'VMs', { kind: 'mesh' })
  d.box(990, 80, 150, 80, 'other hosts', { kind: 'under' })
  d.box(990, 290, 150, 80, 'provider\nrouter', { kind: 'gw' })
  d.box(220, 80, 230, 80, 'VM hook\neach VM interface', { size: 18 })
  d.box(220, 290, 230, 80, 'WireGuard hook\nwg0, after decrypt', { size: 18 })
  d.box(690, 80, 230, 80, 'Uplink hook\nprivate uplink', { size: 18 })
  d.box(690, 290, 230, 80, 'Public hook\npublic interface', { size: 18 })
  d.box(495, 180, 150, 100, 'pinned\nmaps', { kind: 'wg', bold: true })
  d.arrow([[450, 125], [495, 205]], { dashed: true, plain: true })
  d.arrow([[450, 330], [495, 258]], { dashed: true, plain: true })
  d.arrow([[690, 125], [645, 205]], { dashed: true, plain: true })
  d.arrow([[690, 330], [645, 258]], { dashed: true, plain: true })
  d.arrow([[160, 120], [218, 120]])
  d.arrow([[920, 120], [988, 120]], { both: true })
  d.arrow([[920, 330], [988, 330]], { both: true })
  d.note(335, 190, 'check · tunnel\nlook up · drop')
  d.note(335, 400, 'unwrap · NOT_HERE')
  d.note(805, 190, 'learn from NDP')
  d.note(805, 400, 'answer for prefixes')
  d.note(570, 400, '/sys/fs/bpf/atlas-wg-mesh', { size: 14 })
  d.save('host', 'One host runs four tc eBPF hooks that share pinned maps: the VM hook on each VM interface, the WireGuard hook on wg0, the uplink hook on the private uplink to other hosts, and the public hook on the public interface to the provider router.')
}

function sameHost() {
  const d = new Diagram(1160, 350, { panel: true })
  const frame = [mesh(A, C), TCP]
  d.group(20, 10, 1120, 330, 'Host 1')
  d.box(80, 44, 300, 64, `VM A · ${A}`, { kind: 'mesh', size: 18 })
  d.box(780, 44, 300, 64, `VM C · ${C}`, { kind: 'mesh', size: 18 })
  d.box(80, 184, 300, 64, 'VM hook')
  d.box(780, 184, 300, 64, 'Linux · host route to C')
  flow(d, [
    { stage: 1, pts: [[230, 108], [230, 182]], n: 1, text: 'send to C', lx: 245, ly: 145, anchor: 'start', frame },
    { stage: 1, pts: [[380, 216], [778, 216]], n: 2, text: 'C is local: pass' },
    { stage: 1, pts: [[930, 182], [930, 110]], n: 3, text: 'deliver', lx: 945, ly: 145, anchor: 'start' },
  ], 1)
  d.note(230, 292, 'not fdab ✓ owns source ✓ same tenant ✓')
  d.note(930, 292, 'no tunnel · no WireGuard')
  d.save('same-host', 'VM A and VM C of tenant 2 run on host 1. The VM hook checks the packet, sees that VM C is local, and lets Linux deliver it through the host route. No tunnel and no WireGuard.')
}

function known(stage) {
  const d = new Diagram(1160, 380, { panel: true })
  d.group(20, 10, 360, 360, 'Host 1 · fdab::1')
  d.group(780, 10, 360, 360, 'Host 2 · fdab::2')
  d.box(60, 50, 280, 64, 'VM A', { kind: 'mesh' })
  d.box(60, 160, 280, 64, 'VM hook')
  d.box(60, 270, 280, 64, 'wg0 · WireGuard', { kind: 'wg' })
  d.box(820, 50, 280, 64, 'VM B', { kind: 'mesh' })
  d.box(820, 160, 280, 64, 'WireGuard hook')
  d.box(820, 270, 280, 64, 'wg0 · WireGuard', { kind: 'wg' })
  flow(d, [
    { stage: 1, pts: [[200, 114], [200, 158]], n: 1, text: 'send to B', lx: 215, ly: 136, anchor: 'start', frame: AB },
    { stage: 1, pts: [[200, 224], [200, 268]], n: 2, text: 'wrap for fdab::2', lx: 215, ly: 246, anchor: 'start', frame: AB_TUNNEL },
    { stage: 2, pts: [[340, 302], [818, 302]], n: 3, text: 'encrypted UDP, private network', frame: AB_WIRE },
    { stage: 3, pts: [[960, 268], [960, 226]], n: 4, text: 'decrypt', lx: 975, ly: 246, anchor: 'start', frame: AB_TUNNEL },
    { stage: 3, pts: [[960, 160], [960, 116]], n: 5, text: 'unwrap, deliver', lx: 975, ly: 136, anchor: 'start', frame: AB },
  ], stage)
  notes(d, [
    { stage: 1, x: 560, y: 192, text: 'remote_vms: B → fdab::2' },
    { stage: 2, x: 560, y: 352, text: '1380 + 40 = 1420 ≤ 1440 (wg0 MTU)' },
    { stage: 3, x: 560, y: 192, text: 'local_vms has B ✓' },
  ], stage)
  const alts = [
    'VM A sends to VM B. The VM hook on host 1 checks the packet, finds VM B at fdab::2 in remote_vms, and adds an outer IPv6 header for host 2.',
    'WireGuard on host 1 encrypts the tunnel packet and sends it as UDP over the private network to host 2.',
    'Host 2 decrypts the packet. Its WireGuard hook finds VM B in local_vms, removes the outer header, and Linux delivers the packet to VM B.',
  ]
  d.save(`known-${stage}`, alts[stage - 1])
}

function discovery(stage) {
  const d = new Diagram(1160, 380, { panel: true })
  d.group(20, 10, 360, 360, 'Host 1')
  d.group(780, 10, 360, 360, 'Host 2')
  d.box(60, 50, 280, 64, 'VM A', { kind: 'mesh' })
  d.box(60, 160, 280, 64, 'VM hook')
  d.box(60, 270, 280, 64, 'uplink hook', { kind: 'under' })
  d.box(820, 50, 280, 64, 'VM B', { kind: 'mesh' })
  d.box(820, 160, 280, 64, 'proxy NDP entry for B\nadded by vm sync', { size: 17 })
  d.box(820, 270, 280, 64, 'uplink · Linux', { kind: 'under' })
  flow(d, [
    { stage: 1, pts: [[200, 114], [200, 158]], n: 1, text: 'send to B', lx: 215, ly: 136, anchor: 'start', frame: AB },
    { stage: 1, pts: [[200, 224], [200, 268]], n: 2, text: 'no entry: ask', lx: 215, ly: 246, anchor: 'start', frame: solicitation(B) },
    { stage: 1, pts: [[340, 288], [818, 288]], n: 3, text: `who has ${B}?` },
    { stage: 2, pts: [[960, 224], [960, 268]], n: 4, text: 'answer at once', lx: 975, ly: 246, anchor: 'start', frame: advertisement(B, 'host 2') },
    { stage: 2, pts: [[818, 322], [342, 322]], n: 5, text: 'I do: host 2 MAC' },
    { stage: 3, pts: [[200, 114], [200, 158]], n: 6, text: 'retry', lx: 185, ly: 136, anchor: 'end', frame: AB },
    { stage: 3, pts: [[340, 176], [818, 96]], n: 7, text: 'tunnel through WireGuard', frame: AB_TUNNEL },
  ], stage)
  if (stage === 1) d.cross(580, 200)
  notes(d, [
    { stage: 1, x: 580, y: 160, text: 'the data in this packet is lost' },
    { stage: 2, x: 960, y: 352, text: 'proxy_delay = 0' },
    { stage: 3, x: 200, y: 352, text: 'remote_vms: B → fdab::2' },
    { stage: 3, x: 580, y: 228, text: 'MAC → peer_list → fdab::2' },
  ], stage)
  const alts = [
    'Host 1 has no location for VM B. The VM hook replaces the packet with a neighbor solicitation that asks who has fdaa:1:0:2::7, and sends it on the private uplink. The data is lost.',
    'Host 2 has a proxy NDP entry for VM B, so Linux answers at once with host 2 uplink MAC.',
    'The uplink hook on host 1 maps the answering MAC to host 2 through peer_list and stores VM B at fdab::2 in remote_vms. The retry goes through WireGuard.',
  ]
  d.save(`discovery-${stage}`, alts[stage - 1])
}

function unicast() {
  const d = new Diagram(1160, 350, { panel: true })
  const wrap = (destination) => [cell('under', 'IPv4 · protocol 41', `10.0.0.1 → ${destination}`), ...solicitation(B)]
  d.group(20, 10, 340, 330, 'Host 1')
  d.group(410, 10, 340, 330, 'Host 2')
  d.group(800, 10, 340, 330, 'Host 3')
  d.box(60, 44, 260, 60, 'VM hook')
  d.box(60, 170, 260, 60, 'uplink egress hook', { kind: 'under' })
  d.box(450, 170, 260, 60, 'uplink ingress hook', { kind: 'under' })
  d.box(840, 170, 260, 60, 'uplink ingress hook', { kind: 'under' })
  flow(d, [
    { stage: 1, pts: [[190, 104], [190, 168]], n: 1, text: 'solicitation', lx: 205, ly: 136, anchor: 'start', frame: solicitation(B) },
    { stage: 1, pts: [[320, 200], [448, 200]], n: 2, text: 'copy', lx: 385, ly: 160, frame: wrap('10.0.0.2') },
    { stage: 1, pts: [[190, 230], [190, 300], [970, 300], [970, 232]], n: 3, text: 'copy', frame: wrap('10.0.0.3') },
  ], 1, { entry: solicitation(B) })
  d.note(580, 262, 'accept from a peer only, unwrap')
  d.note(970, 80, 'one copy per peer')
  d.save('unicast', 'In unicast mode the uplink egress hook on host 1 wraps the neighbor solicitation in IPv4 protocol 41 and sends one copy to each peer. The ingress hook on each peer accepts it only from a peer address and unwraps it.')
}

function moved(stage) {
  const d = new Diagram(1160, 420, { panel: true })
  d.group(20, 10, 340, 326, 'Host 1')
  d.group(410, 10, 340, 326, 'Host 2 · old')
  d.group(800, 10, 340, 326, 'Host 3 · new')
  d.box(60, 44, 260, 60, 'VM A', { kind: 'mesh' })
  d.box(60, 150, 260, 60, 'WireGuard hook')
  d.box(60, 256, 260, 60, 'uplink hook', { kind: 'under' })
  d.box(450, 44, 260, 60, 'VM B was here', { dashed: true, muted: true })
  d.box(450, 150, 260, 60, 'WireGuard hook')
  d.box(450, 256, 260, 60, 'uplink', { muted: true })
  d.box(840, 44, 260, 60, 'VM B', { kind: 'mesh' })
  d.box(840, 150, 260, 60, 'WireGuard hook', { muted: true })
  d.box(840, 256, 260, 60, 'uplink · proxy NDP', { kind: 'under' })
  const notHere = [cell('wg', 'IPv6 · next header 253', 'fdab::2 → fdab::1'), cell('payload', 'VM address', B)]
  flow(d, [
    { stage: 1, pts: [[190, 104], [190, 148]], text: 'VM hook wraps', lx: 175, ly: 126, anchor: 'end', frame: AB_TUNNEL },
    { stage: 1, pts: [[320, 170], [448, 170]], n: 1, text: 'to fdab::2', lx: 385, ly: 128 },
    { stage: 2, pts: [[450, 196], [322, 196]], n: 2, text: 'NOT_HERE', lx: 385, ly: 232, frame: notHere },
    { stage: 3, pts: [[170, 316], [170, 356], [950, 356], [950, 318]], n: 3, text: 'who has B?', lx: 400, ly: 356, frame: solicitation(B) },
    { stage: 3, pts: [[990, 316], [990, 378], [210, 378], [210, 318]], n: 4, text: 'host 3 MAC', lx: 760, ly: 378, frame: advertisement(B, 'host 3') },
  ], stage)
  notes(d, [
    { stage: 1, x: 580, y: 406, text: 'host 1 still has B → fdab::2' },
    { stage: 2, x: 580, y: 406, text: 'host 2: B not local · host 1: sender matches, delete B' },
    { stage: 3, x: 580, y: 406, text: 'host 1: B → fdab::3' },
  ], stage)
  const alts = [
    'VM B moved from host 2 to host 3. Host 1 missed the announcement and still tunnels to host 2 at fdab::2.',
    'VM B is not in host 2 local_vms, so host 2 replies NOT_HERE with next header 253 and the VM address. Host 1 checks that the reply came from the stored host and deletes the entry.',
    'Host 1 sends a new lookup on the uplink. Host 3 answers, and host 1 stores VM B at fdab::3.',
  ]
  d.save(`moved-${stage}`, alts[stage - 1])
}

function tenant() {
  const d = new Diagram(1160, 350, { panel: true })
  d.group(20, 10, 1120, 330, 'Host 1')
  d.box(80, 44, 300, 64, 'VM A · tenant 2', { kind: 'mesh' })
  d.box(780, 44, 300, 64, 'VM V · tenant abcd', { kind: 'mesh' })
  d.box(80, 184, 300, 64, 'VM hook')
  flow(d, [
    { stage: 1, pts: [[230, 108], [230, 182]], n: 1, text: 'send to V', lx: 245, ly: 145, anchor: 'start', frame: [cell('mesh', 'IPv6', 'fdaa:1:0:*2*::3 → fdaa:1:0:*abcd*::5'), TCP] },
    { stage: 1, pts: [[380, 216], [690, 216]], n: 2, text: 'tenant 2 ≠ abcd', drop: true },
  ], 1)
  d.note(580, 296, 'neither side is privileged: drop before Linux sees it, even on one host')
  d.save('tenant', 'VM A of tenant 2 sends to VM V of tenant abcd on the same host. The VM hook compares the tenant fields, finds that neither side is privileged, and drops the packet.')
}

function privileged() {
  const d = new Diagram(1160, 370, { panel: true })
  d.group(20, 10, 1120, 350, 'Host 1')
  d.box(430, 40, 300, 70, `HTTP proxy · ${PROXY}\ntenant 0 · privileged`, { kind: 'priv', size: 18 })
  d.box(80, 260, 300, 64, 'VM A · tenant 2', { kind: 'mesh' })
  d.box(780, 260, 300, 64, 'VM V · tenant abcd', { kind: 'mesh' })
  flow(d, [
    { stage: 1, pts: [[480, 112], [250, 258]], n: 1, text: 'tenant 0 → 2 ✓', frame: [mesh(PROXY, 'fdaa:1:0:*2*::3'), TCP] },
    { stage: 1, pts: [[690, 112], [910, 258]], n: 2, text: 'tenant 0 → abcd ✓', lx: 760, ly: 160, frame: [mesh(PROXY, 'fdaa:1:0:*abcd*::5'), TCP] },
    { stage: 1, pts: [[950, 258], [730, 112]], n: 3, text: 'reply ✓', lx: 890, ly: 214, frame: [mesh('fdaa:1:0:*abcd*::5', PROXY), TCP] },
    { stage: 1, pts: [[380, 292], [690, 292]], n: 4, text: 'tenant 2 → abcd ✗', drop: true, frame: [mesh('fdaa:1:0:*2*::3', 'fdaa:1:0:*abcd*::5'), TCP] },
  ], 1)
  d.note(580, 344, 'allowed when the tenants match, or either side is in privileged_vms')
  d.save('privileged', 'The HTTP proxy is a privileged tenant-0 VM. It reaches VM A of tenant 2 and VM V of tenant abcd, and VM V can reply to it. VM A cannot reach VM V, because neither of them is privileged.')
}

// Hosts for the gateway and router flows. The router slides reuse this layout and add the provider side.
function gatewayScene(d, { router = false } = {}) {
  d.group(20, 10, 380, 340, 'Host 1 · fdab::1')
  d.box(40, 44, 340, 60, `VM V · ${V}`, { kind: 'mesh', size: 18 })
  d.box(40, 150, 160, 60, 'WireGuard hook', { size: 17 })
  d.box(220, 150, 160, 60, 'VM hook')
  d.group(440, 10, 460, 340, 'Host 2 · fdab::2')
  d.box(460, 44, 420, 60, `${router ? 'IPv6 router VM' : 'gateway VM'} · ${GATEWAY}`, { kind: 'gw', size: 18 })
  if (router) d.box(460, 150, 130, 60, 'public hook', { size: 17 })
  d.box(605, 150, 130, 60, 'VM hook', { size: 17 })
  d.box(750, 150, 130, 60, 'WireGuard\nhook', { size: 17 })
  if (router) {
    d.box(940, 44, 200, 60, `client\n${CLIENT}`, { kind: 'gw', size: 16 })
    d.box(940, 256, 200, 60, 'provider router')
    d.note(548, 328, 'owned_prefixes:\n2001:db8:1:2:3::/80', { size: 14 })
  } else {
    d.box(940, 44, 200, 60, `outside network\n${CLIENT}`, { size: 16 })
  }
  d.note(210, 300, `V: 2000::/3 via ${GATEWAY}`, { size: 14 })
}

const OUTBOUND = [mesh(V, CLIENT), TCP]
const OUTBOUND_TUNNEL = [tunnel('fdab::1', 'fdab::2', 254), cell('gw', 'gateway address', GATEWAY), ...OUTBOUND]
const INBOUND = [cell('gw', 'IPv6 · outside source', `${CLIENT} → ${V}`), TCP]

function gatewayOut(stage) {
  const d = new Diagram(1160, 420, { panel: true })
  gatewayScene(d)
  flow(d, [
    { stage: 1, pts: [[300, 104], [300, 148]], n: 1, text: `to ${CLIENT}`, lx: 315, ly: 126, anchor: 'start', frame: OUTBOUND },
    { stage: 1, pts: [[360, 210], [360, 395], [815, 395], [815, 212]], n: 2, text: 'tunnel 254 + gateway address', lx: 560, ly: 395, frame: OUTBOUND_TUNNEL },
    { stage: 2, pts: [[815, 150], [815, 106]], n: 3, text: 'to the named gateway', lx: 800, ly: 127, anchor: 'end', frame: OUTBOUND },
    { stage: 2, pts: [[880, 74], [938, 74]], n: 4, text: 'its software forwards', lx: 1040, ly: 140 },
  ], stage)
  notes(d, [
    { stage: 1, x: 210, y: 262, text: 'longest match: 2000::/3' },
    { stage: 2, x: 670, y: 262, text: 'local and in gateways ✓' },
  ], stage)
  d.save(`gateway-out-${stage}`, stage === 1
    ? 'VM V on host 1 sends to an outside address. Its VM hook finds the longest matching gateway route, 2000::/3 via the gateway VM, and sends a tunnel with next header 254 and the gateway address to host 2.'
    : 'Host 2 reads the gateway address from the tunnel, checks that the gateway is local and a gateway interface, and delivers the packet to it. The gateway software forwards it outside.')
}

function gatewayIn(stage) {
  const d = new Diagram(1160, 420, { panel: true })
  gatewayScene(d)
  flow(d, [
    { stage: 1, pts: [[670, 104], [670, 148]], n: 1, text: 'outside source', lx: 655, ly: 127, anchor: 'end', frame: INBOUND },
    { stage: 1, pts: [[670, 210], [670, 380], [60, 380], [60, 212]], n: 2, text: 'tunnel 41', lx: 400, ly: 380, frame: [tunnel('fdab::2', 'fdab::1'), ...INBOUND] },
    { stage: 2, pts: [[60, 150], [60, 106]], n: 3, text: 'route back? ✓', lx: 75, ly: 127, anchor: 'start', frame: INBOUND },
  ], stage)
  notes(d, [
    { stage: 1, x: 790, y: 262, text: 'gateway interface ✓' },
    { stage: 2, x: 210, y: 262, text: 'route back: 2000::/3 ✓' },
  ], stage)
  d.save(`gateway-in-${stage}`, stage === 1
    ? 'The gateway VM sends a packet with an outside source to VM V. Its VM hook allows the outside source only because the interface is a gateway, and tunnels it to host 1 with next header 41.'
    : 'The WireGuard hook on host 1 checks that VM V has a gateway route back to the outside source, 2000::/3 via the gateway, and delivers the packet. Without that route it drops the packet.')
}

const ROUTED = [cell('gw', 'IPv6', `${CLIENT} → ${PUBLIC}`), TCP]
const TRANSLATED = [cell('gw', 'IPv6', `${CLIENT} → *${V}*`), TCP]

function routerIn(stage) {
  const d = new Diagram(1160, 420, { panel: true })
  gatewayScene(d, { router: true })
  flow(d, [
    { stage: 1, pts: [[1040, 104], [1040, 254]], n: 1, text: 'public destination', lx: 1040, ly: 180, frame: ROUTED },
    { stage: 1, pts: [[938, 290], [525, 290], [525, 212]], n: 2, text: 'owned prefix', lx: 720, ly: 290 },
    { stage: 1, pts: [[525, 150], [525, 106]], n: 3, text: 'Linux route', lx: 510, ly: 127, anchor: 'end' },
    { stage: 2, pts: [[670, 104], [670, 148]], n: 4, text: 'destination → mesh', lx: 685, ly: 127, anchor: 'start', frame: TRANSLATED },
    { stage: 2, pts: [[670, 210], [670, 380], [60, 380], [60, 212]], n: 5, text: 'tunnel 41', lx: 400, ly: 380, frame: [tunnel('fdab::2', 'fdab::1'), ...TRANSLATED] },
    { stage: 2, pts: [[60, 150], [60, 106]], n: 6, text: 'route back? ✓', lx: 75, ly: 127, anchor: 'start', frame: TRANSLATED },
  ], stage)
  notes(d, [
    { stage: 1, x: 760, y: 262, text: 'public hook answers NDP for the /80' },
    { stage: 2, x: 210, y: 262, text: 'route back: 2000::/3 ✓' },
  ], stage)
  d.save(`router-in-${stage}`, stage === 1
    ? 'A client sends to the public address 2001:db8:1:2:3:a:bcd0:5. The provider router sends it to host 2, whose public hook answers NDP for the owned prefix, and Linux routes it to the IPv6 router VM.'
    : 'The router changes only the destination to the mesh address of VM V and keeps the client source. From here it is the gateway inbound path: the VM hook tunnels it to host 1, and the WireGuard hook checks the return route before it delivers.')
}

function routerOut() {
  const d = new Diagram(1160, 420, { panel: true })
  gatewayScene(d, { router: true })
  flow(d, [
    { stage: 1, pts: [[300, 104], [300, 148]], n: 1, text: 'reply to client', lx: 315, ly: 126, anchor: 'start', frame: OUTBOUND },
    { stage: 1, pts: [[360, 210], [360, 395], [815, 395], [815, 212]], n: 2, text: 'tunnel 254 + gateway address', lx: 560, ly: 395, frame: OUTBOUND_TUNNEL },
    { stage: 1, pts: [[815, 150], [815, 106]], n: 3, text: 'to the named gateway', lx: 800, ly: 127, anchor: 'end', frame: OUTBOUND },
    { stage: 1, pts: [[880, 74], [938, 74]], n: 4, text: 'source → public', lx: 1040, ly: 140, frame: [cell('gw', 'IPv6', `*${PUBLIC}* → ${CLIENT}`), TCP] },
  ], 1)
  d.save('router-out', 'VM V replies to the client. The reply takes the gateway outbound path to the router, and the router changes the source from the mesh address to the public address 2001:db8:1:2:3:a:bcd0:5.')
}

function routerMoved(stage) {
  const d = new Diagram(1160, 420, { panel: true })
  d.box(20, 170, 170, 60, 'provider router')
  d.group(230, 10, 380, 340, 'Host 2 · old')
  d.box(250, 170, 340, 60, 'public hook', { kind: 'gw' })
  d.group(660, 10, 480, 340, 'Host 3 · new')
  d.box(680, 44, 440, 60, 'IPv6 router VM', { kind: 'gw' })
  d.box(680, 170, 200, 60, 'WireGuard hook')
  d.box(920, 170, 200, 60, 'public hook', { kind: 'gw' })
  const announcement = [cell('ndp', 'Neighbor Advertisement · override', `${PUBLIC} is at host 3 MAC`)]
  flow(d, [
    { stage: 1, pts: [[190, 200], [248, 200]], n: 1, text: 'cached MAC', lx: 220, ly: 148, frame: ROUTED },
    { stage: 1, pts: [[590, 200], [678, 200]], n: 2, text: 'tunnel', lx: 635, ly: 148, frame: [tunnel('fdab::2', 'fdab::3'), ...ROUTED] },
    { stage: 1, pts: [[880, 200], [918, 200]], n: 3, text: 'becomes an NA', lx: 900, ly: 262, frame: announcement },
    { stage: 1, pts: [[1020, 230], [1020, 380], [80, 380], [80, 232]], n: 4, text: 'unsolicited NA: host 3 MAC', lx: 400, ly: 380 },
    { stage: 2, pts: [[130, 230], [130, 402], [1070, 402], [1070, 232]], n: 5, text: 'direct to host 3', lx: 800, ly: 402, frame: ROUTED },
    { stage: 2, pts: [[1020, 170], [1020, 106]], n: 6, text: 'Linux route', lx: 1005, ly: 138, anchor: 'end' },
  ], stage)
  d.note(420, 300, 'moved_prefixes: /80, 5 min')
  d.note(900, 310, 'owned_prefixes: /80')
  d.save(`router-moved-${stage}`, stage === 1
    ? 'The router moved from host 2 to host 3. The provider still sends to host 2, whose public hook finds the prefix in moved_prefixes and tunnels the packet to host 3. Host 3 turns it into an unsolicited neighbor advertisement with the override flag, and the provider learns host 3 MAC.'
    : 'The provider now sends the public address straight to host 3, and Linux routes it to the router VM.')
}

address()
mapping()
layers()
host()
sameHost()
unicast()
tenant()
privileged()
routerOut()
for (const stage of [1, 2, 3]) { known(stage); discovery(stage); moved(stage) }
for (const stage of [1, 2]) { gatewayOut(stage); gatewayIn(stage); routerIn(stage); routerMoved(stage) }
