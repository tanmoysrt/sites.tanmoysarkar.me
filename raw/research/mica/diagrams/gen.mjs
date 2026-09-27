// Generates the sketch-style SVG diagrams for the mica deck.
// Every element has a fixed seed, so a diagram looks the same in each stage.
import rough from 'roughjs'
import { writeFileSync, mkdirSync } from 'node:fs'

const OUT = process.argv[2]
mkdirSync(OUT, { recursive: true })

const gen = rough.generator()
const INK = '#1e1e1e'
const MUTED = '#ced4da'
const MUTED_TEXT = '#adb5bd'
const ACCENT = '#e8590c'
const RED = '#c92a2a'
const KIND = {
  guest: { fill: '#f1f3f5', stroke: '#495057' },
  mica: { fill: '#e7f0ff', stroke: '#1c4fa0' },
  ssd: { fill: '#e6f6ee', stroke: '#2b8a3e' },
  s3: { fill: '#f3f0ff', stroke: '#5f3dc4' },
  plain: { fill: '#ffffff', stroke: '#495057' },
}
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const seedOf = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h % 100000) + 1 }
const textWidth = (s, size) => s.length * size * 0.55

class Diagram {
  constructor(w, h) { this.w = w; this.h = h; this.parts = []; this.hasMotion = false }

  rough(drawable, dash) {
    const attr = dash ? ` stroke-dasharray="${dash}"` : ''
    this.parts.push(gen.toPaths(drawable).map((p) =>
      `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill || 'none'}" stroke-linecap="round" stroke-linejoin="round"${attr}/>`).join(''))
  }

  opts(key, o = {}) { return { roughness: 1.1, bowing: 0.8, strokeWidth: 1.6, seed: seedOf(key), ...o } }

  label(x, y, text, { size = 19, color = INK, anchor = 'middle', bold = false, bg = false } = {}) {
    const lines = String(text).split('\n')
    const lh = size * 1.28
    const top = y - (lines.length - 1) * lh / 2
    if (bg) {
      const w = Math.max(...lines.map((l) => textWidth(l, size))) + 12
      const bx = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x - 6 : x - w + 6
      this.parts.push(`<rect x="${bx}" y="${top - lh / 2 - 2}" width="${w}" height="${lines.length * lh + 4}" rx="4" fill="#ffffff" opacity="0.94"/>`)
    }
    this.parts.push(`<text font-size="${size}" fill="${color}" text-anchor="${anchor}" dominant-baseline="central" font-weight="${bold ? 650 : 400}">` +
      lines.map((l, i) => `<tspan x="${x}" y="${top + i * lh}">${esc(l)}</tspan>`).join('') + '</text>')
  }

  box(x, y, w, h, text, { kind = 'plain', dashed = false, muted = false, active = false, size = 21, bold = false } = {}) {
    const k = KIND[kind]
    const stroke = muted ? MUTED : active ? ACCENT : k.stroke
    this.parts.push(`<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="6" fill="${muted ? '#fafafa' : k.fill}"/>`)
    this.rough(gen.rectangle(x, y, w, h, this.opts(`box${x},${y},${w},${h}`, { stroke, strokeWidth: active ? 2.6 : 1.6 })), dashed ? '8 6' : '')
    if (text) this.label(x + w / 2, y + h / 2, text, { size, color: muted ? MUTED_TEXT : INK, bold })
  }

  cylinder(x, y, w, h, text, { kind = 's3', muted = false, size = 19 } = {}) {
    const k = KIND[kind]
    const e = 14
    const stroke = muted ? MUTED : k.stroke
    const body = `M ${x} ${y + e} L ${x} ${y + h - e} A ${w / 2} ${e} 0 0 0 ${x + w} ${y + h - e} L ${x + w} ${y + e}`
    this.parts.push(`<path d="${body} A ${w / 2} ${e} 0 0 0 ${x} ${y + e} Z" fill="${muted ? '#fafafa' : k.fill}"/>`)
    this.rough(gen.path(body, this.opts(`cyl${x},${y}`, { stroke })))
    this.rough(gen.ellipse(x + w / 2, y + e, w, 2 * e, this.opts(`cyle${x},${y}`, { stroke })))
    this.label(x + w / 2, y + h / 2 + e / 2, text, { size, color: muted ? MUTED_TEXT : INK })
  }

  diamond(cx, cy, w, h, text, { kind = 'plain' } = {}) {
    const pts = [[cx, cy - h / 2], [cx + w / 2, cy], [cx, cy + h / 2], [cx - w / 2, cy]]
    this.parts.push(`<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${KIND[kind].fill}"/>`)
    this.rough(gen.polygon(pts, this.opts(`dia${cx},${cy}`, { stroke: KIND[kind].stroke })))
    this.label(cx, cy, text, { size: 20 })
  }

  group(x, y, w, h, text, kind) {
    const k = KIND[kind]
    this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${k.fill}" opacity="0.35"/>`)
    this.rough(gen.rectangle(x, y, w, h, this.opts(`grp${x},${y}`, { stroke: k.stroke, strokeWidth: 1.2, roughness: 0.8 })), '6 6')
    this.label(x + 12, y + 18, text, { size: 17, color: k.stroke, anchor: 'start', bold: true })
  }

  head(a, b, color, width, key) {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
    const L = 14
    const s = 0.42
    const p1 = [b[0] - L * Math.cos(ang - s), b[1] - L * Math.sin(ang - s)]
    const p2 = [b[0] - L * Math.cos(ang + s), b[1] - L * Math.sin(ang + s)]
    this.rough(gen.linearPath([p1, b, p2], this.opts(key, { stroke: color, strokeWidth: width, roughness: 0.6 })))
  }

  // state: normal, active (the step under discussion), muted (done or skipped), hidden
  arrow(pts, { text = '', n = null, state = 'normal', both = false, dashed = false, motion = false, lx, ly, anchor = 'middle', size = 18 } = {}) {
    if (state === 'hidden') return
    const color = state === 'active' ? ACCENT : state === 'muted' ? MUTED : INK
    const width = state === 'active' ? 2.6 : 1.6
    const key = 'arr' + pts.flat().join(',')
    this.rough(gen.linearPath(pts, this.opts(key, { stroke: color, strokeWidth: width, roughness: 0.9 })), dashed ? '7 6' : '')
    this.head(pts[pts.length - 2], pts[pts.length - 1], color, width, key + 'h')
    if (both) this.head(pts[1], pts[0], color, width, key + 't')
    if (motion && state === 'active') this.flow(pts)
    if (!text && n === null) return
    if (lx === undefined) {
      let best = 0
      for (let i = 1; i < pts.length; i++) {
        const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        if (len > best) { best = len; lx = (pts[i][0] + pts[i - 1][0]) / 2; ly = (pts[i][1] + pts[i - 1][1]) / 2 }
      }
    }
    const textColor = state === 'muted' ? MUTED_TEXT : state === 'active' ? ACCENT : INK
    this.step(lx, ly, n, text, { color: textColor, badge: color === MUTED ? MUTED_TEXT : color, anchor, size })
  }

  flow(pts) {
    this.hasMotion = true
    const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')
    this.parts.push(`<circle class="flow-dot" r="5" fill="${ACCENT}" aria-hidden="true">` +
      `<animateMotion path="${path}" dur="2.4s" repeatCount="indefinite"/>` +
      `<animate attributeName="opacity" values="0;0.8;0.8;0" keyTimes="0;0.1;0.9;1" dur="2.4s" repeatCount="indefinite"/>` +
      '</circle>')
  }

  // A numbered badge followed by a label, on a white background.
  step(x, y, n, text, { color = INK, badge = INK, anchor = 'middle', size = 18 } = {}) {
    const lines = String(text).split('\n')
    const tw = text ? Math.max(...lines.map((l) => textWidth(l, size))) : 0
    const bw = n === null ? 0 : 26
    const total = bw + tw
    let start = anchor === 'middle' ? x - total / 2 : anchor === 'start' ? x : x - total
    const lh = size * 1.28
    this.parts.push(`<rect x="${start - 6}" y="${y - lines.length * lh / 2 - 3}" width="${total + 12}" height="${lines.length * lh + 6}" rx="4" fill="#ffffff" opacity="0.94"/>`)
    if (n !== null) {
      this.parts.push(`<circle cx="${start + 11}" cy="${y}" r="11" fill="${badge}"/><text x="${start + 11}" y="${y}" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${n}</text>`)
    }
    if (text) this.label(start + bw, y, text, { size, color, anchor: 'start' })
  }

  cross(x, y) {
    this.rough(gen.line(x - 8, y - 8, x + 8, y + 8, this.opts(`x1${x},${y}`, { stroke: RED, strokeWidth: 2 })))
    this.rough(gen.line(x + 8, y - 8, x - 8, y + 8, this.opts(`x2${x},${y}`, { stroke: RED, strokeWidth: 2 })))
  }

  note(x, y, text, { color = '#495057', anchor = 'middle', size = 18 } = {}) {
    this.label(x, y, text, { size, color, anchor })
  }

  save(name, alt) {
    const motionStyle = this.hasMotion ? '<style>@media (prefers-reduced-motion: reduce) {.flow-dot {display: none}}</style>' : ''
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" font-family="${FONT}" role="img" aria-label="${esc(alt)}">` +
      `${motionStyle}<rect width="100%" height="100%" fill="#ffffff"/>${this.parts.join('')}</svg>`
    writeFileSync(`${OUT}/${name}.svg`, svg)
  }
}

// Picks a state for a step: active in its stage, muted before it, hidden after it.
// Stage 'all' shows every step as normal.
const at = (stage, step) => stage === 'all' ? 'normal' : step === stage ? 'active' : step < stage ? 'muted' : 'hidden'

function idea() {
  const d = new Diagram(1160, 400)
  d.box(20, 150, 210, 100, 'VM · container\nor host mount', { kind: 'guest' })
  d.box(300, 150, 210, 100, '/dev/mica/disk\n(ublk device)', { kind: 'guest' })
  d.box(580, 150, 230, 100, 'mica daemon', { kind: 'mica', bold: true })
  d.box(580, 300, 230, 80, 'local SSD', { kind: 'ssd' })
  d.cylinder(920, 110, 220, 170, 'S3 bucket\nR2 · Ceph · Garage')
  d.arrow([[230, 200], [300, 200]])
  d.arrow([[510, 200], [580, 200]])
  d.arrow([[695, 250], [695, 300]], { both: true, text: 'every write, most reads', lx: 675, ly: 275, anchor: 'end' })
  d.arrow([[920, 175], [810, 175]], { text: 'chunks, on demand', lx: 865, ly: 140 })
  d.arrow([[810, 225], [920, 225]], { text: 'changes, every 3 min', lx: 865, ly: 262 })
  d.save('idea', 'A VM or container uses /dev/mica/disk. The mica daemon writes to the local SSD, fetches chunks from S3 on demand, and uploads changes every 3 minutes.')
}

function chunks() {
  const d = new Diagram(1160, 230)
  const names = ['0', '1', '2', '…', '255', '256', '257', '…', '25,599']
  names.forEach((n, i) => {
    const x = 40 + i * 118
    d.box(x, 50, 110, 70, n, { active: n === '256', kind: n === '…' ? 'plain' : 'mica' })
  })
  const x256 = 40 + 5 * 118
  d.parts.push(`<rect x="${x256 + 14}" y="56" width="9" height="58" fill="${ACCENT}" opacity="0.8"/>`)
  d.note(40, 22, '100 GiB disk = 25,600 chunks of 4 MiB', { anchor: 'start' })
  d.arrow([[x256 + 18, 200], [x256 + 18, 124]], { state: 'active' })
  d.note(x256 + 36, 196, 'read 8 KiB at byte 1,073,745,920\n= chunk 256, 4,096 bytes in', { anchor: 'start', color: ACCENT })
  d.save('chunks', 'A disk drawn as a row of 4 MiB chunks. A read at byte 1,073,745,920 lands 4,096 bytes into chunk 256.')
}

function dedup() {
  const d = new Diagram(1160, 400)
  const xs = [260, 390, 520, 650]
  d.note(40, 70, 'base-image', { anchor: 'start', color: '#1c4fa0', size: 20 })
  d.note(40, 340, 'sandbox-7', { anchor: 'start', color: '#1c4fa0', size: 20 })
  d.note(40, 205, 'S3 objects', { anchor: 'start', color: '#5f3dc4', size: 20 })
  ;['a', 'b', '0', 'c'].forEach((c, i) => d.box(xs[i], 40, 110, 60, c, { kind: c === '0' ? 'plain' : 'mica', dashed: c === '0' }))
  ;['a', 'b', '0', 'd'].forEach((c, i) => d.box(xs[i], 310, 110, 60, c, { kind: c === '0' ? 'plain' : 'mica', dashed: c === '0' }))
  const objects = { a: 260, b: 390, c: 650, d: 800 }
  for (const [c, x] of Object.entries(objects)) d.box(x, 175, 110, 60, `chunks/${c}…`, { kind: 's3', size: 19 })
  d.arrow([[315, 100], [315, 175]])
  d.arrow([[445, 100], [445, 175]])
  d.arrow([[705, 100], [705, 175]])
  d.arrow([[315, 310], [315, 235]])
  d.arrow([[445, 310], [445, 235]])
  d.arrow([[705, 310], [855, 235]])
  d.note(575, 205, 'zero chunk:\nno object', { color: '#868e96' })
  d.note(940, 205, 'same content\n= same object', { anchor: 'start' })
  d.save('dedup', 'Two disks list chunks a, b, zero, and c or d. Chunks a and b are one S3 object each, shared by both disks. The zero chunk has no object.')
}

function manifests(stage) {
  const d = new Diagram(1160, 330)
  const snap = stage === 2 ? 'active' : 'normal'
  const commit = stage === 1 ? 'active' : 'normal'
  d.box(20, 40, 220, 70, 'disks/disk-1/head', { kind: 's3', size: 19 })
  d.box(330, 40, 190, 70, 'manifest 42', { kind: 's3' })
  d.box(610, 40, 190, 70, 'manifest 41', { kind: 's3' })
  d.box(890, 40, 190, 70, 'manifest 40', { kind: 's3' })
  d.arrow([[240, 75], [330, 75]], { state: commit, motion: stage === 1, text: stage === 1 ? 'PUT head = commit' : '', lx: 285, ly: 20 })
  d.arrow([[520, 75], [610, 75]], { dashed: true, text: 'parent', lx: 565, ly: 50, size: 16 })
  d.arrow([[800, 75], [890, 75]], { dashed: true, text: 'parent', lx: 845, ly: 50, size: 16 })
  d.note(425, 140, 'lists every chunk\n32 bytes each', { color: '#868e96' })
  d.box(600, 230, 210, 64, 'snapshots/base', { kind: 's3', size: 19, active: stage === 2 })
  d.box(880, 230, 250, 64, 'disks/sandbox-7/head', { kind: 's3', size: 19, active: stage === 2 })
  d.arrow([[760, 230], [930, 110]], { state: snap, text: stage === 2 ? 'snapshot' : '', lx: 800, ly: 170 })
  d.arrow([[1005, 230], [1005, 110]], { state: snap, text: stage === 2 ? 'new disk' : '', lx: 1060, ly: 170 })
  d.save(`manifest-${stage}`, stage === 1
    ? 'The head of disk-1 points to manifest 42, which points to parents 41 and 40. Writing the head commits a new manifest.'
    : 'A snapshot and a new disk both point to manifest 40. Neither copies data.')
}

function read(stage) {
  const d = new Diagram(1160, 470)
  d.box(20, 190, 180, 90, 'guest reads\n8 KiB', { kind: 'guest' })
  d.box(290, 190, 200, 90, 'mica', { kind: 'mica', bold: true })
  d.arrow([[200, 215], [290, 215]])
  d.arrow([[290, 258], [200, 258]], { state: 'active', text: 'data', lx: 245, ly: 300 })
  const sources = [
    ['dirty/256.chunk\nown recent write', 'ssd'],
    ['dirty/256.frozen\nuploading now', 'ssd'],
    ['zero chunk\nno file, no GET', 'plain'],
    ['cache/<hash>\nclean copy', 'ssd'],
    ['S3 chunks/<hash>\nGET, check SHA-256', 's3'],
  ]
  const hit = { 1: 1, 2: 4, 3: 5 }[stage]
  sources.forEach(([text, kind], i) => {
    const y = 20 + i * 90
    const cy = y + 31
    const n = i + 1
    d.box(700, y, 320, 62, text, { kind, dashed: kind === 'plain', active: n === hit, size: 19 })
    const state = n === hit ? 'active' : n < hit ? 'muted' : 'hidden'
    d.arrow([[490, 235], [600, cy], [700, cy]], { n, state, motion: stage === 3 && n === hit, lx: 640, ly: cy })
    if (n < hit) d.cross(680, cy)
  })
  d.arrow([[1020, 411], [1070, 411], [1070, 321], [1020, 321]], { state: stage === 3 ? 'active' : 'hidden', text: 'save', lx: 1105, ly: 366 })
  d.save(`read-${stage}`, [
    'The read finds the chunk in the dirty folder, the guest\'s own recent write.',
    'The chunk is not dirty and not zero, so the read uses the cached copy.',
    'Nothing local has the chunk, so mica fetches it from S3, checks its hash and saves it in the cache.',
  ][stage - 1])
}

function write(stage) {
  const d = new Diagram(1160, 440)
  const s = (n) => stage === 'all' ? 'normal' : stage === 1 ? (n <= 2 ? 'active' : 'hidden') : (n <= 2 ? 'muted' : 'active')
  d.box(20, 170, 180, 90, 'guest writes\n4 KiB', { kind: 'guest' })
  d.box(280, 170, 200, 90, 'mica\nlocks chunk 256', { kind: 'mica' })
  d.group(600, 20, 540, 400, 'local SSD', 'ssd')
  d.box(640, 60, 230, 64, 'cache/<hash>', { kind: 'ssd', size: 19 })
  d.box(640, 190, 230, 64, 'dirty/256.tmp', { kind: 'ssd', size: 19 })
  d.box(640, 320, 230, 64, 'dirty/256.chunk', { kind: 'ssd', size: 19, active: stage === 2 })
  d.arrow([[200, 195], [280, 195]])
  d.arrow([[755, 124], [755, 190]], { n: 1, text: 'copy (a reflink: no I/O)', state: s(1), lx: 780, ly: 157, anchor: 'start' })
  d.arrow([[755, 254], [755, 320]], { n: 2, text: 'sync, then rename', state: s(2), lx: 780, ly: 287, anchor: 'start' })
  d.arrow([[480, 240], [560, 240], [560, 352], [640, 352]], { n: 3, text: 'write data', state: s(3), lx: 560, ly: 300 })
  d.arrow([[280, 240], [200, 240]], { n: 4, text: 'done\n(no sync)', state: s(4), lx: 240, ly: 310 })
  d.save(stage === 'all' ? 'write-all' : `write-${stage}`, stage === 1
    ? 'On the first write to a chunk, mica copies the clean chunk to a temp file, syncs it and renames it to .chunk.'
    : 'mica writes the data into the .chunk file and returns to the guest without a sync.')
}

function fastPath() {
  const d = new Diagram(1160, 340)
  d.box(20, 130, 200, 80, 'kernel request', { kind: 'guest' })
  d.diamond(440, 170, 260, 150, 'all chunks local,\nno lock busy?')
  d.box(720, 30, 420, 84, 'queue thread\nio_uring into the request buffer', { kind: 'mica', active: true, size: 20 })
  d.box(720, 226, 420, 84, 'disk engine on tokio\ndownloads · new chunks · flushes', { kind: 'mica', size: 20 })
  d.arrow([[220, 170], [310, 170]])
  d.arrow([[440, 95], [440, 72], [720, 72]], { state: 'active', text: 'yes · about 10 µs', lx: 580, ly: 45 })
  d.arrow([[440, 245], [440, 268], [720, 268]], { text: 'no', lx: 580, ly: 245 })
  d.save('fast-path', 'A request whose chunks are all local runs on the queue thread with io_uring. Other requests go to the disk engine on tokio.')
}

function flush() {
  const d = new Diagram(1160, 340)
  d.box(20, 130, 180, 80, 'guest FLUSH', { kind: 'guest' })
  d.box(280, 130, 200, 80, 'mica', { kind: 'mica', bold: true })
  d.group(570, 30, 310, 280, 'local SSD', 'ssd')
  d.box(600, 70, 250, 50, 'dirty/12.chunk', { kind: 'ssd', size: 19 })
  d.box(600, 140, 250, 50, 'dirty/256.chunk', { kind: 'ssd', size: 19 })
  d.box(600, 210, 250, 50, 'dirty/ folder', { kind: 'ssd', size: 19 })
  d.cylinder(960, 100, 180, 140, 'S3', { muted: true })
  d.arrow([[200, 155], [280, 155]])
  d.arrow([[480, 165], [570, 165]], { state: 'active', text: 'fdatasync,\nall at once', lx: 525, ly: 105 })
  d.arrow([[280, 190], [200, 190]], { text: 'done', lx: 240, ly: 225 })
  d.note(1050, 280, 'not touched', { color: MUTED_TEXT })
  d.save('flush', 'A guest flush makes mica sync the changed chunk files and the dirty folder on the local SSD. S3 is not touched.')
}

function checkpoint(stage) {
  const d = new Diagram(1160, 490)
  d.group(40, 16, 1080, 116, 'S3', 's3')
  d.box(80, 56, 220, 56, 'chunks/<hash>', { kind: 's3', size: 19 })
  d.box(340, 56, 220, 56, 'manifests/<hash>', { kind: 's3', size: 19 })
  d.box(600, 56, 220, 56, 'disks/d/attached', { kind: 's3', size: 19 })
  d.box(860, 56, 220, 56, 'disks/d/head', { kind: 's3', size: 19, active: stage === 3 })
  d.box(430, 200, 300, 84, 'checkpoint\nevery 3 min while dirty', { kind: 'mica', size: 20 })
  d.group(120, 340, 920, 130, 'local SSD', 'ssd')
  d.box(150, 378, 240, 60, 'dirty/256.chunk', { kind: 'ssd', size: 19 })
  d.box(460, 378, 240, 60, 'dirty/256.frozen', { kind: 'ssd', size: 19 })
  d.box(770, 378, 240, 60, 'cache/<hash>', { kind: 'ssd', size: 19 })
  const st = (step) => at(stage, step)
  d.arrow([[390, 408], [460, 408]], { n: 1, text: 'rename', state: st(1), lx: 425, ly: 362 })
  d.arrow([[580, 378], [580, 284]], { state: st(2) })
  d.arrow([[470, 200], [230, 112]], { n: 2, text: 'PUT chunks, 16 at a time', state: st(2), lx: 290, ly: 142 })
  d.arrow([[540, 200], [460, 112]], { n: 2, text: 'PUT manifest', state: st(2), lx: 505, ly: 166 })
  d.arrow([[620, 200], [700, 112]], { n: 3, text: 'still ours?', state: st(3), lx: 680, ly: 166 })
  d.arrow([[690, 200], [940, 112]], { n: 3, text: 'PUT head', state: st(3), motion: stage === 3, lx: 850, ly: 142 })
  d.arrow([[430, 250], [130, 250], [130, 112]], { n: 4, text: 'HEAD each chunk, upload missing', state: st(4), dashed: true, lx: 270, ly: 250 })
  d.arrow([[700, 408], [770, 408]], { n: 4, text: 'move', state: st(4), lx: 735, ly: 362 })
  d.save(stage === 'all' ? 'checkpoint-all' : `checkpoint-${stage}`, [
    'Step 1: each changed chunk file is renamed from .chunk to .frozen. Guest writes continue into new .chunk files.',
    'Step 2: frozen chunks are uploaded, 16 at a time, then the manifest.',
    'Step 3: mica checks the attached marker is still its own, then writes the head. This is the commit.',
    'Step 4: mica checks every committed chunk exists and uploads any missing one, then moves frozen files into the cache.',
  ][stage - 1] || 'All checkpoint steps: rename, upload chunks and manifest, check owner and write head, repair and move to cache.')
}

function move(stage) {
  const d = new Diagram(1160, 430)
  const st = (step) => at(stage, step)
  d.group(20, 30, 280, 370, 'node A', 'mica')
  d.box(40, 80, 240, 60, stage === 'all' || stage >= 1 ? 'sandbox stopped' : 'sandbox', { kind: 'guest', size: 19 })
  d.box(40, 300, 240, 60, 'local chunks', { kind: 'ssd', size: 19 })
  d.group(440, 30, 260, 370, 'S3', 's3')
  d.box(460, 80, 220, 60, 'attached marker', { kind: 's3', size: 19 })
  d.box(460, 190, 220, 60, 'head + manifest', { kind: 's3', size: 19 })
  d.box(460, 300, 220, 60, 'chunks', { kind: 's3', size: 19 })
  d.group(860, 30, 280, 370, 'node B', 'mica')
  d.box(880, 80, 240, 60, stage === 3 || stage === 'all' ? 'sandbox boots' : 'sandbox', { kind: 'guest', size: 19, active: stage === 3 })
  d.box(880, 300, 240, 60, 'cache', { kind: 'ssd', size: 19 })
  d.arrow([[280, 330], [460, 330]], { n: 1, text: 'last checkpoint', state: st(1), lx: 370, ly: 290 })
  d.arrow([[280, 110], [460, 110]], { n: 1, text: 'delete marker', state: st(1), lx: 370, ly: 72 })
  d.arrow([[880, 98], [680, 98]], { n: 2, text: 'PUT marker', state: st(2), lx: 780, ly: 66 })
  d.arrow([[680, 124], [880, 124]], { n: 2, text: 'wait 1 s, GET', state: st(2), lx: 780, ly: 156 })
  d.arrow([[680, 220], [880, 220]], { n: 3, text: 'GET head', state: st(3), lx: 780, ly: 190 })
  d.arrow([[680, 330], [880, 330]], { n: 3, text: 'chunks, on demand', state: st(3), lx: 780, ly: 290 })
  d.save(stage === 'all' ? 'move-all' : `move-${stage}`, [
    'Node A uploads its last checkpoint and deletes the attached marker.',
    'Node B writes its marker, waits one second and reads it back.',
    'Node B reads the head and manifest, starts the sandbox, and downloads chunks as they are read.',
  ][stage - 1] || 'The full move: node A checkpoints and releases, node B claims, reads the head and fetches chunks on demand.')
}

function fence(stage) {
  const d = new Diagram(1160, 330)
  d.box(20, 120, 230, 90, 'node A', { kind: 'mica', bold: true })
  d.box(460, 120, 240, 90, stage === 1 ? 'attached marker\n?' : 'attached marker\nclaim b7', { kind: 's3', size: 20 })
  d.box(910, 120, 230, 90, 'node B', { kind: 'mica', bold: true, active: stage === 2 })
  const one = stage === 1 ? 'active' : 'muted'
  d.arrow([[250, 145], [460, 145]], { n: 1, text: 'PUT claim a1', state: one, lx: 355, ly: 110 })
  d.arrow([[910, 145], [700, 145]], { n: 1, text: 'PUT claim b7', state: one, lx: 805, ly: 110 })
  if (stage === 2) {
    d.arrow([[460, 188], [250, 188]], { n: 2, text: 'reads b7: back off', state: 'normal', lx: 355, ly: 228 })
    d.arrow([[700, 188], [910, 188]], { n: 2, text: 'reads b7: mine', state: 'active', lx: 805, ly: 228 })
    d.note(580, 290, 'a watcher reads the marker again every 60 s')
  }
  d.save(`fence-${stage}`, stage === 1
    ? 'Nodes A and B write claims to the attached marker at the same moment.'
    : 'After one second both read the marker back. Node B sees its own claim and wins. Node A backs off.')
}

function gc(stage) {
  const d = new Diagram(1160, 400)
  d.box(20, 60, 200, 90, 'mica gc', { kind: 'guest', bold: true })
  d.group(380, 20, 400, 360, 'S3', 's3')
  d.box(420, 70, 320, 64, 'chunks/X', { kind: 's3', active: stage === 2 })
  d.box(420, 290, 320, 64, 'disks/d/head', { kind: 's3' })
  d.box(940, 60, 200, 90, 'checkpoint', { kind: 'mica', bold: true })
  const race = stage === 1 ? 'normal' : 'muted'
  d.arrow([[220, 85], [420, 85]], { n: 1, text: 'X is old, unused', state: race, lx: 300, ly: 55 })
  d.arrow([[940, 85], [740, 85]], { n: 2, text: 'PUT X', state: race, lx: 860, ly: 55 })
  d.arrow([[220, 125], [420, 125]], { n: 3, text: 'DELETE X', state: stage === 1 ? 'active' : 'muted', lx: 300, ly: 160 })
  d.arrow([[1040, 150], [1040, 322], [740, 322]], { n: 4, text: 'PUT head → X', state: race, lx: 890, ly: 322 })
  if (stage === 1) d.note(580, 175, 'X is gone, the head needs it', { color: RED })
  if (stage === 2) {
    d.arrow([[940, 125], [740, 125]], { n: 5, text: 'HEAD X: missing\n→ PUT X again', state: 'active', lx: 840, ly: 190 })
    d.note(580, 175, 'repaired from the local copy', { color: '#2b8a3e' })
  }
  d.save(`gc-${stage}`, stage === 1
    ? 'GC finds chunk X old and unused. A checkpoint uploads X again, GC deletes it, and the checkpoint commits a head that needs X.'
    : 'After the commit the checkpoint checks X, finds it missing and uploads it again from its local copy.')
}

function restart(stage) {
  const d = new Diagram(1160, 420)
  const state = (step) => at(stage, step <= 2 ? 1 : step <= 4 ? 2 : 3)
  d.box(20, 170, 170, 80, 'guest I/O', { kind: 'guest' })
  d.box(280, 160, 220, 100, 'kernel · ublk', { kind: 'guest', bold: true })
  d.box(640, 30, 240, 80, 'old mica', { kind: 'mica' })
  d.box(640, 310, 240, 80, 'new mica', { kind: 'mica' })
  d.box(950, 175, 190, 70, 'local chunk\nfiles', { kind: 'ssd', size: 19 })
  d.arrow([[640, 70], [390, 70], [390, 160]], { n: 1, text: 'last checkpoint, exit,\nkeep the device', state: state(1), lx: 515, ly: 70 })
  d.arrow([[190, 210], [280, 210]], { n: 2, text: 'waits', state: state(2), lx: 235, ly: 150 })
  d.arrow([[880, 350], [1045, 350], [1045, 245]], { n: 3, text: 'open', state: state(3), lx: 965, ly: 350 })
  d.arrow([[640, 365], [390, 365], [390, 260]], { n: 4, text: 'take over the device', state: state(4), lx: 515, ly: 365 })
  d.arrow([[500, 225], [600, 225], [700, 310]], { n: 5, text: 'send held I/O again', state: state(5), motion: stage === 3, lx: 610, ly: 195 })
  const alt = [
    'The old daemon exits and the kernel holds guest I/O.',
    'The new daemon opens local chunks and takes over the device while I/O waits.',
    'The kernel sends held I/O to the new daemon.',
  ][stage - 1]
  d.save(stage === 3 ? 'restart' : `restart-${stage}`, alt)
}

idea()
chunks()
dedup()
manifests(1); manifests(2)
read(1); read(2); read(3)
write(1); write(2); write('all')
fastPath()
flush()
checkpoint(1); checkpoint(2); checkpoint(3); checkpoint(4); checkpoint('all')
move(1); move(2); move(3); move('all')
fence(1); fence(2)
gc(1); gc(2)
restart(1); restart(2); restart(3)
console.log('ok')
