// Generates the sketch-style SVG diagrams for the HTTP proxy deck.
// A flow diagram loops a small message along each active arrow, and a strip shows the headers on that arrow.
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
  tls: { fill: '#f1ebfc', stroke: '#6d28d9' },
  net: { fill: '#f8efe6', stroke: '#92400e' },
  dns: { fill: '#e7f1fb', stroke: '#1c6fb8' },
  proxy: { fill: '#fbe9f0', stroke: '#b4235a' },
  control: { fill: '#fff9db', stroke: '#a37f00' },
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
      this.parts.push(textSvg(20, this.panelTop + 52, 'headers', { size: 15, color: NOTE, anchor: 'start', bold: true }))
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
    let encryptedBy = ''
    let out = ''
    for (const c of frame) {
      const w = Math.max(sansWidth(c.name, 16) * 1.08, monoWidth(c.detail, 15)) + 26
      const changed = isSamePacket && !previousKeys.has(cellKey(c))
      const k = KIND[c.kind]
      out += `<rect x="${x + 1}" y="${top + 1}" width="${w - 2}" height="${height - 2}" rx="4" fill="${k.fill}"/>`
      out += roughSvg(gen.rectangle(x, top, w, height, opts(`cell${x},${c.name}`, { stroke: changed ? ACCENT : k.stroke, strokeWidth: changed ? 2.8 : 1.4, roughness: 0.7 })))
      out += textSvg(x + 12, top + 18, c.name, { size: 16, bold: true, anchor: 'start', color: changed ? ACCENT : INK })
      out += textSvg(x + 12, top + 40, c.detail, { size: 15, mono: true, anchor: 'start', color: '#343a40' })
      if (c.encrypted) { encryptedFrom = encryptedFrom ?? x; encryptedTo = x + w; encryptedBy = c.encrypted }
      x += w + 6
    }
    if (encryptedFrom !== null) {
      const y = top - 10
      out += roughSvg(gen.linearPath([[encryptedFrom, y + 6], [encryptedFrom, y], [encryptedTo, y], [encryptedTo, y + 6]], opts(`enc${encryptedFrom}`, { stroke: KIND.tls.stroke, strokeWidth: 1.4, roughness: 0.5 })))
      out += textSvg((encryptedFrom + encryptedTo) / 2, y, `encrypted by ${encryptedBy}`, { size: 13, color: KIND.tls.stroke, bg: true, bold: true })
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

// Messages and addresses
const cell = (kind, name, detail, extra = {}) => ({ kind, name, detail, ...extra })
const CLIENT = '198.51.100.7'
const NODE = '203.0.113.12'
const PROXY = 'fdaa:1::10'
const VM_OLD = 'fdaa:1:0:2::b'
const VM_NEW = 'fdaa:1:0:2::c'
const SITE = 'erp.par-1.example.com'
const CUSTOM = 'www.customer.com'
const tcp = (port) => cell('net', `IPv4 · TCP ${port}`, `${CLIENT} → ${NODE}`)
const tls = (name) => cell('tls', 'TLS', `SNI ${name}`)
const http = (host, encrypted = false) => cell('payload', 'HTTP', `GET / · Host ${host}`, encrypted ? { encrypted: 'TLS' } : {})
const mesh = (destination) => cell('mesh', 'IPv6 · WG Mesh', `${PROXY} → ${destination}`)

const CHANGE = [cell('net', 'HTTPS', 'PATCH /v1/sites/erp'), cell('control', 'Authorization', 'Bearer JWT'), cell('payload', 'body', `address ${VM_NEW}`)]
const REPLICATE = [cell('net', 'HTTPS · peer', 'leader → peer'), cell('control', 'X-Atlas-Cluster-Password', 'regional password'), cell('payload', 'change · generation 42', `erp → ${VM_NEW}`)]
const ACK = [cell('payload', 'acknowledge', 'generation 42')]

function overview() {
  const d = new Diagram(1160, 380)
  d.box(40, 20, 220, 70, 'DNS\n*which node?*', { kind: 'dns' })
  d.box(40, 190, 180, 70, 'browser')
  d.group(320, 130, 340, 190, 'proxy node')
  d.box(350, 190, 280, 70, 'route map\n*which VM?*', { kind: 'proxy' })
  d.group(800, 130, 340, 190, 'Metal host')
  d.box(830, 190, 280, 70, `site VM\n${VM_OLD}`, { kind: 'mesh' })
  d.arrow([[110, 188], [110, 92]], { both: true, text: 'name → IP', lx: 125, ly: 140, anchor: 'start' })
  d.arrow([[220, 225], [348, 225]], { text: 'HTTPS', ly: 205 })
  d.arrow([[630, 225], [828, 225]], { text: 'WG Mesh\n*which host?*', ly: 180 })
  d.note(150, 355, 'Atlas writes DNS')
  d.note(490, 355, 'Central and Atlas write routes')
  d.note(970, 355, 'WG Mesh learns host locations')
  d.save('overview', 'A browser asks DNS which proxy node to use, then sends HTTPS to that node. The node route map selects the site VM. WG Mesh carries the request to the Metal host that runs the VM. Atlas writes DNS, Central and Atlas write routes, and WG Mesh learns host locations.')
}

function node() {
  const d = new Diagram(1160, 440)
  d.group(230, 20, 720, 400, 'one proxy node · a service VM')
  d.box(20, 70, 180, 64, 'public clients')
  d.box(290, 60, 360, 84, 'OpenResty\nports 80 and 443', { kind: 'proxy' })
  d.box(990, 70, 150, 64, 'site VMs', { kind: 'mesh' })
  d.box(290, 190, 360, 70, 'route maps\nshared memory')
  d.box(700, 190, 220, 70, 'cluster-state.json\nsaved snapshot', { size: 17 })
  d.box(290, 310, 360, 84, 'control daemon\n127.0.0.1:9000', { kind: 'control' })
  d.box(20, 320, 180, 64, 'Central · Atlas', { kind: 'control' })
  d.box(990, 320, 150, 64, 'peer nodes', { kind: 'proxy' })
  d.arrow([[200, 102], [288, 102]])
  d.arrow([[650, 102], [988, 102]], { text: 'HTTP or TLS' })
  d.arrow([[470, 188], [470, 146]], { text: 'read per request', lx: 485, ly: 167, anchor: 'start' })
  d.arrow([[470, 308], [470, 262]], { text: 'write through admin.sock', lx: 485, ly: 285, anchor: 'start' })
  d.arrow([[650, 330], [740, 262]], { dashed: true, text: 'save', lx: 715, ly: 310, anchor: 'start' })
  d.arrow([[200, 352], [288, 352]])
  d.arrow([[650, 372], [988, 372]], { both: true, text: 'replicate' })
  d.save('node', 'One proxy node runs OpenResty and the control daemon. Public clients reach OpenResty, which reads the route maps in shared memory for each request and sends traffic to site VMs. Central and Atlas send route changes to the control daemon. The daemon writes the maps through admin.sock, saves cluster-state.json, and replicates changes with peer nodes.')
}

function requestScene(d, { dns = true } = {}) {
  if (dns) d.box(20, 20, 200, 60, 'DNS · Route 53', { kind: 'dns' })
  d.box(20, 200, 200, 70, `browser\n${CLIENT}`)
  d.group(330, 110, 380, 210, `proxy node · ${NODE}`)
  d.box(360, 200, 320, 70, 'OpenResty', { kind: 'proxy' })
  d.group(820, 110, 320, 210, 'Metal host · any')
  d.box(850, 200, 260, 70, `site VM\n${VM_OLD}`, { kind: 'mesh' })
}

function request(stage) {
  const d = new Diagram(1160, 330, { panel: true })
  requestScene(d)
  flow(d, [
    { stage: 1, pts: [[80, 198], [80, 82]], n: 1, text: 'ask', lx: 95, ly: 140, anchor: 'start', frame: [cell('dns', 'DNS query', `A ${SITE}?`)] },
    { stage: 1, pts: [[170, 82], [170, 198]], n: 2, text: 'node', lx: 185, ly: 140, anchor: 'start', frame: [cell('dns', 'DNS answer', `CNAME proxy.par-1.example.com · A ${NODE}`)] },
    { stage: 2, pts: [[220, 235], [358, 235]], n: 3, text: 'HTTPS', ly: 212, frame: [tcp(443), tls(SITE), http(SITE, true)] },
    { stage: 3, pts: [[680, 235], [848, 235]], n: 4, text: 'HTTP :80', ly: 212, frame: [mesh(VM_OLD), http(SITE)] },
  ], stage)
  notes(d, [
    { stage: 1, x: 690, y: 50, text: 'one A record per healthy node' },
    { stage: 2, x: 520, y: 165, text: `site map: erp → ${VM_OLD}` },
    { stage: 2, x: 520, y: 300, text: 'wildcard certificate ends TLS' },
    { stage: 3, x: 980, y: 165, text: 'WG Mesh finds the host' },
  ], stage)
  const alts = [
    'The browser asks DNS for erp.par-1.example.com. Route 53 answers with the IPv4 address of one healthy proxy node.',
    'The browser sends HTTPS to the proxy node. OpenResty ends TLS with the wildcard certificate and reads erp in its local site map: fdaa:1:0:2::b.',
    'OpenResty sends plain HTTP to port 80 on fdaa:1:0:2::b. WG Mesh carries it to the Metal host that runs the VM.',
  ]
  d.save(`request-${stage}`, alts[stage - 1])
}

function customDomain() {
  const d = new Diagram(1160, 330, { panel: true })
  requestScene(d, { dns: false })
  flow(d, [
    { stage: 1, pts: [[220, 235], [358, 235]], n: 1, text: 'HTTPS', ly: 212, frame: [tcp(443), tls(CUSTOM), http(CUSTOM, true)] },
    { stage: 1, pts: [[680, 235], [848, 235]], n: 2, text: 'TLS :443', ly: 212, frame: [mesh(VM_OLD), cell('net', 'PROXY v2', `client ${CLIENT}`), tls(CUSTOM), http(CUSTOM, true)] },
  ], 1)
  d.note(520, 165, `SNI map: ${CUSTOM} → ${VM_OLD}`, { size: 14 })
  d.note(520, 300, 'reads SNI · does not decrypt')
  d.note(980, 165, 'holds the certificate')
  d.save('custom-domain', 'The browser sends HTTPS for www.customer.com. OpenResty reads only the SNI name, finds the VM in its SNI map, and sends the unchanged TLS stream to port 443 on the VM with a PROXY protocol v2 header that carries the client address. The VM holds the certificate.')
}

function monoRow(d, text, y, size, fields) {
  const cw = size * 0.6
  const x0 = (1160 - text.length * cw) / 2
  for (let i = 0; i < text.length; i++) {
    const field = fields.find(([from, to]) => i >= from && i < to)
    d.parts.push(`<text x="${x0 + i * cw + cw / 2}" y="${y}" font-size="${size}" font-family="${MONO}" text-anchor="middle" dominant-baseline="central" fill="${field ? field[2] : MUTED_TEXT}" font-weight="600">${esc(text[i])}</text>`)
  }
  return (index) => x0 + index * cw
}

function bracedRow(d, text, y, size, fields, { labelY, detailY } = {}) {
  const at = monoRow(d, text, y, size, fields.map(([from, to, , , color]) => [from, to, color]))
  for (const [from, to, name, detail, color] of fields) {
    const x1 = at(from) + 2
    const x2 = at(to) - 2
    d.brace(x1, x2, y + size * 0.7, { color, depth: 10 })
    d.label((x1 + x2) / 2, labelY, name, { size: 19, bold: true, color })
    if (detail) d.label((x1 + x2) / 2, detailY, detail, { size: 16, color: NOTE })
  }
  return at
}

function siteKey() {
  const d = new Diagram(1160, 330)
  d.label(580, 40, 'Host header, or SNI for HTTPS', { size: 17, color: NOTE })
  bracedRow(d, SITE, 110, 46, [
    [0, 3, 'site key', 'one label', KIND.mesh.stroke],
    [4, 21, 'wildcard zone', '/var/lib/nginx/region', KIND.proxy.stroke],
  ], { labelY: 190, detailY: 218 })
  d.label(580, 285, `site map:  erp → ${VM_OLD}`, { size: 22, mono: true })
  d.save('site-key', 'The name erp.par-1.example.com. A brace marks erp as the site key and par-1.example.com as the wildcard zone from /var/lib/nginx/region. The site map gives erp → fdaa:1:0:2::b.')
}

function autoProxy() {
  const d = new Diagram(1160, 460)
  bracedRow(d, 'site-lpc8lqa.par-1.example.com', 50, 40, [
    [0, 5, 'prefix', 'configured', KIND.control.stroke],
    [5, 12, 'label', 'base 36', ACCENT],
    [13, 30, 'zone', '', KIND.proxy.stroke],
  ], { labelY: 112, detailY: 136 })
  d.arrow([[424, 158], [424, 196]], { text: 'decode base 36', lx: 440, ly: 177, anchor: 'start' })
  const at = monoRow(d, '47244640258 = (11 << 32) | 2', 226, 32, [[0, 11, ACCENT], [15, 17, KIND.mesh.stroke], [27, 28, KIND.tls.stroke]])
  d.label(at(16), 266, 'VM number · VM-00011', { size: 17, bold: true, color: KIND.mesh.stroke })
  d.label(at(27.5), 266, 'tenant', { size: 17, bold: true, color: KIND.tls.stroke })
  d.arrow([[580, 288], [580, 326]], { text: 'put into the mesh address', lx: 596, ly: 307, anchor: 'start' })
  bracedRow(d, VM_OLD, 356, 40, [
    [0, 6, 'region', 'from config', KIND.dns.stroke],
    [6, 10, 'tenant 2', '', KIND.tls.stroke],
    [10, 13, 'VM 11', '', KIND.mesh.stroke],
  ], { labelY: 418, detailY: 442 })
  d.save('auto-proxy', 'The name site-lpc8lqa.par-1.example.com has the prefix site-, the base-36 label lpc8lqa, and the zone. The label decodes to 47244640258, which is 11 shifted left by 32 bits, or tenant 2. OpenResty puts the numbers into the mesh address fdaa:1:0:2::b: the region prefix from config, tenant 2, and VM 11.')
}

function write(stage) {
  const d = new Diagram(1160, 350, { panel: true })
  d.box(20, 140, 170, 70, 'Central', { kind: 'control' })
  d.box(260, 140, 200, 70, 'proxy-001\nfollower', { kind: 'proxy' })
  d.box(540, 140, 200, 70, 'proxy-002\nleader', { kind: 'proxy', bold: true })
  d.box(940, 20, 200, 64, 'proxy-003', { kind: 'proxy' })
  d.box(940, 143, 200, 64, 'proxy-004', { kind: 'proxy' })
  d.box(940, 266, 200, 64, 'proxy-005', { kind: 'proxy' })
  flow(d, [
    { stage: 1, pts: [[190, 165], [258, 165]], n: 1, text: '', frame: CHANGE },
    { stage: 1, pts: [[460, 165], [538, 165]], n: 2, text: 'forward', ly: 120 },
    { stage: 2, pts: [[740, 152], [938, 50]], n: 3, text: '', frame: REPLICATE },
    { stage: 2, pts: [[740, 170], [938, 170]], n: 3, text: '' },
    { stage: 2, pts: [[740, 192], [938, 294]], n: 3, text: '' },
    { stage: 3, pts: [[938, 68], [746, 168]], n: 4, text: '', lx: 860, ly: 125, frame: ACK },
    { stage: 3, pts: [[938, 188], [742, 188]], n: 4, text: '', lx: 840, ly: 200 },
    { stage: 3, pts: [[538, 195], [462, 195]], n: 5, text: '', frame: [cell('net', 'HTTP 200', 'X-Atlas-Proxy-Generation: 42')] },
    { stage: 3, pts: [[258, 195], [192, 195]], n: 5, text: '' },
  ], stage)
  notes(d, [
    { stage: 1, x: 360, y: 260, text: 'any ready node accepts' },
    { stage: 2, x: 640, y: 260, text: 'apply · generation 41 → 42' },
    { stage: 3, x: 500, y: 260, text: 'leader + 2 peers = 3 of 5: success' },
    { stage: 3, x: 1040, y: 342, text: 'late: catches up later' },
  ], stage)
  const alts = [
    'Central sends PATCH /v1/sites/erp to proxy-001, a follower. The follower forwards the change to proxy-002, the leader.',
    'The leader applies the change, moves the generation from 41 to 42, and sends the change to proxy-003, proxy-004, and proxy-005 at the same time.',
    'proxy-003 and proxy-004 acknowledge. With the leader that is 3 of 5, so the leader returns 200 with the new generation through the follower. proxy-005 is late and catches up later.',
  ]
  d.save(`write-${stage}`, alts[stage - 1])
}

function partial(stage) {
  const d = new Diagram(1160, 350, { panel: true })
  d.box(20, 110, 170, 120, 'Central', { kind: 'control' })
  d.box(330, 110, 220, 120, 'proxy-001\nleader', { kind: 'proxy', bold: true })
  d.box(820, 40, 220, 70, 'proxy-002', { kind: 'proxy' })
  if (stage < 3) d.box(820, 240, 220, 70, 'proxy-003\ndown', { dashed: true, muted: true })
  else d.box(820, 240, 220, 70, 'proxy-003\nback', { kind: 'proxy' })
  flow(d, [
    { stage: 1, pts: [[190, 135], [328, 135]], n: 1, text: '', frame: CHANGE },
    { stage: 1, pts: [[550, 140], [818, 72]], n: 2, text: '', frame: REPLICATE },
    { stage: 1, pts: [[550, 190], [818, 268]], n: 2, text: 'no answer', dashed: true, drop: true },
    { stage: 2, pts: [[818, 92], [552, 158]], n: 3, text: '', frame: ACK },
    { stage: 2, pts: [[328, 175], [192, 175]], n: 4, text: '503', frame: [cell('net', 'HTTP 503', 'replication threshold not met')] },
    { stage: 3, pts: [[552, 222], [818, 300]], n: 5, text: 'heartbeat', lx: 690, ly: 302, frame: [cell('payload', 'heartbeat', 'leader generation 42')] },
    { stage: 3, pts: [[190, 200], [328, 200]], n: 6, text: 'retry', frame: CHANGE },
    { stage: 3, pts: [[328, 222], [192, 222]], n: 7, text: '200', ly: 250, frame: [cell('net', 'HTTP 200', 'X-Atlas-Proxy-Generation')] },
  ], stage)
  notes(d, [
    { stage: 1, x: 440, y: 270, text: 'applied · generation 42' },
    { stage: 1, x: 930, y: 135, text: 'applied · generation 42' },
    { stage: 2, x: 440, y: 270, text: '2 of 3: not enough' },
    { stage: 2, x: 930, y: 135, text: 'keeps 42 · no rollback' },
    { stage: 3, x: 930, y: 332, text: 'installs the newest snapshot' },
    { stage: 3, x: 440, y: 270, text: '3 of 3: success' },
  ], stage)
  const alts = [
    'A 3-node region with proxy-003 down. Central sends a route change to proxy-001, the leader. The leader and proxy-002 apply generation 42. proxy-003 does not answer.',
    'proxy-002 acknowledges, but 2 of 3 is not enough. The leader returns 503. The leader and proxy-002 keep generation 42 and do not roll back.',
    'proxy-003 comes back. A leader heartbeat makes it install the newest snapshot. Central sends the same change again, and the leader returns 200 after 3 of 3 acknowledgements.',
  ]
  d.save(`partial-${stage}`, alts[stage - 1])
}

overview()
node()
siteKey()
autoProxy()
customDomain()
for (const stage of [1, 2, 3]) { request(stage); write(stage); partial(stage) }
