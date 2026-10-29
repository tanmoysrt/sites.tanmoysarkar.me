// Generates the sketch-style SVG diagrams for the ublk and io_uring deck.
// Every shape has a seed from its position, so a diagram looks the same in each step.
import rough from 'roughjs'
import { writeFileSync, mkdirSync } from 'node:fs'

const OUT = process.argv[2]
mkdirSync(OUT, { recursive: true })

const gen = rough.generator()
const INK = '#1e1e1e'
const NOTE = '#6c757d'
const MUTED = '#ced4da'
const MUTED_TEXT = '#adb5bd'
const ACCENT = '#e8590c'
const MESH = '#0f766e'
const KIND = {
  app: { fill: '#ffffff', stroke: '#495057' },
  kernel: { fill: '#e7f1fb', stroke: '#1c6fb8' },
  ring: { fill: '#fff9db', stroke: '#a37f00' },
  server: { fill: '#e6f4f1', stroke: MESH },
  file: { fill: '#f1f3f5', stroke: '#495057' },
  remote: { fill: '#f8efe6', stroke: '#92400e' },
  data: { fill: '#fbe9f0', stroke: '#b4235a' },
}
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const seedOf = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h % 100000) + 1 }
const opts = (key, o = {}) => ({ roughness: 1.1, bowing: 0.8, strokeWidth: 1.6, seed: seedOf(key), ...o })

function roughSvg(drawable, dash = '') {
  const attr = dash ? ` stroke-dasharray="${dash}"` : ''
  return gen.toPaths(drawable).map((p) =>
    `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"${attr}/>`).join('')
}

function textSvg(x, y, text, { size = 19, color = INK, anchor = 'middle', bold = false, bg = false } = {}) {
  const lines = String(text).split('\n')
  const lh = size * 1.28
  const top = y - (lines.length - 1) * lh / 2
  let out = ''
  if (bg) {
    const w = Math.max(...lines.map((l) => l.length * size * 0.55)) + 14
    const bx = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x - 7 : x - w + 7
    out += `<rect x="${bx}" y="${top - lh / 2 - 2}" width="${w}" height="${lines.length * lh + 4}" rx="4" fill="#ffffff" opacity="0.94"/>`
  }
  out += `<text font-size="${size}" fill="${color}" text-anchor="${anchor}" dominant-baseline="central" font-weight="${bold ? 650 : 400}">` +
    lines.map((l, i) => `<tspan x="${x}" y="${top + i * lh}">${esc(l)}</tspan>`).join('') + '</text>'
  return out
}

class Diagram {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.parts = []
    this.boxes = {}
  }

  save(name, alt) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" font-family="${FONT}" role="img" aria-label="${esc(alt)}">` +
      `<rect width="100%" height="100%" fill="#ffffff"/>${this.parts.join('')}</svg>\n`
    writeFileSync(`${OUT}/${name}.svg`, svg)
  }

  label(x, y, text, o) { this.parts.push(textSvg(x, y, text, o)) }

  note(x, y, text, { anchor = 'middle', size = 16 } = {}) {
    this.label(x, y, text, { size, color: NOTE, anchor, bg: true })
  }

  group(x, y, w, h, text) {
    this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#f8f9fa" opacity="0.7"/>`)
    this.parts.push(roughSvg(gen.rectangle(x, y, w, h, opts(`grp${x},${y}`, { stroke: '#868e96', strokeWidth: 1.2, roughness: 0.8 })), '6 6'))
    this.label(x + 14, y + 20, text, { size: 16, color: '#495057', anchor: 'start', bold: true })
  }

  box(id, x, y, w, h, text, { kind = 'app', dashed = false, muted = false, active = false, size = 18, bold = false } = {}) {
    this.boxes[id] = { x, y, w, h }
    const k = KIND[kind]
    const stroke = muted ? MUTED : active ? ACCENT : k.stroke
    this.parts.push(`<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="6" fill="${muted ? '#fafafa' : k.fill}"/>`)
    this.parts.push(roughSvg(gen.rectangle(x, y, w, h, opts(`box${x},${y},${w},${h}`, { stroke, strokeWidth: active ? 2.6 : 1.6 })), dashed ? '8 6' : ''))
    if (text) this.label(x + w / 2, y + h / 2, text, { size, color: muted ? MUTED_TEXT : INK, bold })
  }

  port(id, side, t = 0.5) {
    const b = this.boxes[id]
    if (side === 't') return [b.x + b.w * t, b.y]
    if (side === 'b') return [b.x + b.w * t, b.y + b.h]
    if (side === 'l') return [b.x, b.y + b.h * t]
    return [b.x + b.w, b.y + b.h * t]
  }

  head(a, b, color, width, key) {
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0])
    const p1 = [b[0] - 13 * Math.cos(angle - 0.42), b[1] - 13 * Math.sin(angle - 0.42)]
    const p2 = [b[0] - 13 * Math.cos(angle + 0.42), b[1] - 13 * Math.sin(angle + 0.42)]
    this.parts.push(roughSvg(gen.linearPath([p1, b, p2], opts(key, { stroke: color, strokeWidth: width, roughness: 0.6 }))))
  }

  // state: normal, active (the current step), muted, or hidden
  arrow(pts, { text = '', state = 'normal', dashed = false, both = false, color, lx, ly, anchor = 'middle', size = 16 } = {}) {
    if (state === 'hidden') return
    const stroke = state === 'active' ? ACCENT : state === 'muted' ? MUTED : color || INK
    const width = state === 'active' ? 2.6 : 1.6
    const key = 'arr' + pts.flat().join(',')
    this.parts.push(roughSvg(gen.linearPath(pts, opts(key, { stroke, strokeWidth: width, roughness: 0.7 })), dashed ? '7 6' : ''))
    this.head(pts[pts.length - 2], pts[pts.length - 1], stroke, width, key + 'h')
    if (both) this.head(pts[1], pts[0], stroke, width, key + 't')
    if (!text) return
    const mid = Math.floor((pts.length - 1) / 2)
    const x = lx ?? (pts[mid][0] + pts[mid + 1][0]) / 2
    const y = ly ?? (pts[mid][1] + pts[mid + 1][1]) / 2
    const color2 = state === 'active' ? ACCENT : state === 'muted' ? MUTED_TEXT : INK
    this.label(x, y, text, { size, color: color2, anchor, bg: true, bold: state === 'active' })
  }

  link(a, as, b, bs, o = {}) {
    this.arrow([this.port(a, as, o.at ?? 0.5), ...(o.via || []), this.port(b, bs, o.bt ?? 0.5)], o)
  }
}

// A sequence diagram: actors on top, one message per row.
function sequence(name, alt, actors, messages, { active = [], upTo = messages.length, rowH = 38, width = 1200 } = {}) {
  const margin = 20
  const step = (width - 2 * margin) / actors.length
  const center = Object.fromEntries(actors.map((a, i) => [a.id, margin + step * i + step / 2]))
  const top = 84
  const height = top + messages.length * rowH + 30
  const d = new Diagram(width, height)
  for (const a of actors) {
    const x = center[a.id]
    d.parts.push(`<line x1="${x}" y1="${top - 20}" x2="${x}" y2="${height - 12}" stroke="#ced4da" stroke-width="1.5" stroke-dasharray="5 6"/>`)
    d.box(a.id, x - step / 2 + 12, 10, step - 24, 54, a.label, { kind: a.kind, size: 17, bold: true })
  }
  messages.forEach((m, i) => {
    const state = i >= upTo ? 'hidden' : active.includes(i) ? 'active' : 'normal'
    const y = top + i * rowH + rowH / 2
    const x1 = center[m.from]
    const text = `${i + 1}. ${m.text}`
    if (m.from === m.to) {
      d.arrow([[x1, y - 9], [x1 + 34, y - 9], [x1 + 34, y + 9], [x1 + 4, y + 9]], { state })
      if (state !== 'hidden') d.label(x1 + 44, y, text, { size: 16, anchor: 'start', bg: true, color: state === 'active' ? ACCENT : INK, bold: state === 'active' })
      return
    }
    const x2 = center[m.to]
    const dir = Math.sign(x2 - x1)
    d.arrow([[x1 + dir * 4, y + 6], [x2 - dir * 4, y + 6]], { text, state, dashed: m.reply, ly: y - 8 })
  })
  d.save(name, alt)
}

function uring(step) {
  const d = new Diagram(1200, 500)
  const st = (i) => (i < step ? 'normal' : i === step ? 'active' : 'hidden')
  d.group(330, 40, 470, 420, 'Memory shared by the program and the kernel')
  d.box('app', 40, 190, 220, 110, 'Program', { kind: 'app', bold: true, size: 20 })
  d.box('sq', 370, 80, 390, 150, '', { kind: 'ring' })
  d.label(565, 102, 'Submission queue (SQ)', { size: 17, bold: true })
  d.box('cq', 370, 280, 390, 150, '', { kind: 'ring' })
  d.label(565, 302, 'Completion queue (CQ)', { size: 17, bold: true })
  d.box('kernel', 880, 190, 280, 110, 'Kernel\nio_uring', { kind: 'kernel', bold: true, size: 20 })
  d.box('file', 880, 390, 280, 80, 'File on the SSD', { kind: 'file' })
  if (step >= 1) d.box('sqe', 395, 135, 340, 76, 'SQE · READ · fd 5\noffset 0 · 4096 bytes · user_data 42', { kind: 'data', size: 16, active: step === 1 })
  if (step >= 4) d.box('cqe', 395, 335, 340, 76, 'CQE · user_data 42\nres 4096 (bytes read)', { kind: 'data', size: 16, active: step === 4 })
  d.arrow([[260, 215], [370, 172]], { text: '1. write SQE', state: st(1), lx: 300, ly: 172 })
  d.arrow([[150, 190], [150, 18], [1020, 18], [1020, 190]], { text: '2. io_uring_enter()', state: st(2), lx: 585, ly: 18 })
  d.arrow([[760, 172], [880, 226]], { text: '3. take SQE', state: st(3), lx: 830, ly: 172 })
  d.arrow([[1020, 300], [1020, 390]], { text: '3. read', state: st(3), lx: 1070, ly: 345 })
  d.arrow([[880, 270], [760, 372]], { text: '4. write CQE', state: st(4), lx: 830, ly: 352 })
  d.arrow([[370, 372], [260, 278]], { text: '5. read CQE', state: st(5), lx: 300, ly: 345 })
  const alts = [
    '',
    'Step 1: the program writes a submission queue entry (SQE) for a 4096-byte read into the shared submission queue.',
    'Step 2: the program calls io_uring_enter once to tell the kernel that new entries are ready.',
    'Step 3: the kernel takes the SQE from the submission queue and reads the file.',
    'Step 4: the kernel writes a completion queue entry (CQE) with user_data 42 and result 4096 into the shared completion queue.',
    'Step 5: the program reads the CQE from shared memory. user_data 42 tells it which request finished.',
  ]
  d.save(`uring-${step}`, alts[step])
}

function fixed() {
  const d = new Diagram(1200, 440)
  d.box('sqe', 30, 160, 320, 110, 'SQE · READ_FIXED · fd 5\nbuf_index 2 · offset 0\n4096 bytes', { kind: 'data', size: 17 })
  d.group(420, 20, 330, 400, 'Registered buffer table')
  for (let i = 0; i < 4; i++) {
    const y = 70 + i * 86
    d.box(`row${i}`, 450, y, 270, 60, `index ${i}`, { kind: 'ring', active: i === 2 })
    d.box(`mem${i}`, 840, y, 330, 60, `buffer ${i} · pinned pages`, { kind: 'file', active: i === 2 })
    d.link(`row${i}`, 'r', `mem${i}`, 'l', { state: i === 2 ? 'active' : 'normal' })
  }
  d.link('sqe', 'r', 'row2', 'l', { state: 'active', text: 'buf_index 2', ly: 228 })
  d.save('fixed', 'A READ_FIXED entry names buffer index 2. The kernel looks up index 2 in the registered buffer table and reads into those pages, which were pinned once at registration.')
}

function parts() {
  const d = new Diagram(1200, 500)
  d.group(20, 20, 1160, 200, 'User space')
  d.group(20, 260, 1160, 220, 'Kernel')
  d.box('app', 60, 80, 260, 100, 'Application\nfilesystem · fio · VM', { kind: 'app', bold: true })
  d.box('srv', 560, 70, 300, 120, 'ublk server (mica)\none io_uring ring\nper queue', { kind: 'server', bold: true })
  d.box('back', 920, 80, 230, 100, 'Local SSD files\nS3', { kind: 'remote' })
  d.box('blk', 60, 330, 260, 100, 'Block layer\nrequests with tags', { kind: 'kernel' })
  d.box('drv', 520, 330, 300, 100, 'ublk_drv', { kind: 'kernel', bold: true, size: 22 })
  d.link('app', 'b', 'blk', 't', { text: 'read · write\n/dev/ublkbN', ly: 245 })
  d.link('blk', 'r', 'drv', 'l', { text: 'request' })
  d.link('srv', 'b', 'drv', 't', { at: 0.2, bt: 0.38, both: true, text: 'I/O commands\n/dev/ublkcN', lx: 545, ly: 245 })
  d.link('srv', 'b', 'drv', 't', { at: 0.75, bt: 0.85, dashed: true, text: 'control commands\n/dev/ublk-control', lx: 900, ly: 245 })
  d.link('srv', 'r', 'back', 'l', { both: true, text: 'data' })
  d.save('parts', 'The application uses /dev/ublkbN. The block layer turns its reads and writes into requests with tags and gives them to ublk_drv. The ublk server in user space talks to ublk_drv with I/O commands on /dev/ublkcN and control commands on /dev/ublk-control, and keeps the data in local SSD files and S3.')
}

const SEQ_ACTORS = [
  { id: 'app', label: 'Application', kind: 'app' },
  { id: 'blk', label: 'Block layer', kind: 'kernel' },
  { id: 'drv', label: 'ublk_drv', kind: 'kernel' },
  { id: 'srv', label: 'ublk server', kind: 'server' },
  { id: 'file', label: 'Backing file', kind: 'file' },
]

const READ_COPY = [
  { from: 'app', to: 'blk', text: 'read 4 KiB at 1 MiB' },
  { from: 'blk', to: 'drv', text: 'request · tag 7' },
  { from: 'drv', to: 'srv', text: 'FETCH done: READ · sector 2048 · 8 sectors', reply: true },
  { from: 'srv', to: 'file', text: 'io_uring READ into server buffer' },
  { from: 'file', to: 'srv', text: '4096 bytes', reply: true },
  { from: 'srv', to: 'drv', text: 'COMMIT_AND_FETCH · result 4096' },
  { from: 'drv', to: 'drv', text: 'copy server buffer → request pages' },
  { from: 'drv', to: 'blk', text: 'request done', reply: true },
  { from: 'blk', to: 'app', text: 'data', reply: true },
]

function readCopy() {
  const groups = [[0, 1], [2], [3, 4], [5, 6], [7, 8]]
  const alts = [
    'Steps 1 and 2: the application reads 4 KiB, and the block layer gives ublk_drv a request with tag 7.',
    'Step 3: ublk_drv completes the waiting FETCH command of tag 7. The server sees READ, sector 2048, 8 sectors.',
    'Steps 4 and 5: the server reads 4096 bytes from its backing file into its own buffer for tag 7.',
    'Steps 6 and 7: the server sends COMMIT_AND_FETCH with result 4096. ublk_drv copies the server buffer into the request pages.',
    'Steps 8 and 9: the request completes and the application gets its data. The command of tag 7 now waits for the next request.',
  ]
  groups.forEach((active, i) => sequence(`read-copy-${i + 1}`, alts[i], SEQ_ACTORS, READ_COPY, { active, upTo: Math.max(...active) + 1, rowH: 44 }))
}

function writeCopy() {
  sequence('write-copy', 'A write in copy mode: ublk_drv first copies the request pages into the server buffer of tag 3, then completes the FETCH command. The server writes its buffer to the backing file and sends COMMIT_AND_FETCH.', SEQ_ACTORS, [
    { from: 'app', to: 'blk', text: 'write 4 KiB at 0' },
    { from: 'blk', to: 'drv', text: 'request · tag 3' },
    { from: 'drv', to: 'drv', text: 'copy request pages → server buffer' },
    { from: 'drv', to: 'srv', text: 'FETCH done: WRITE · sector 0 · 8 sectors', reply: true },
    { from: 'srv', to: 'file', text: 'io_uring WRITE from server buffer' },
    { from: 'file', to: 'srv', text: 'done', reply: true },
    { from: 'srv', to: 'drv', text: 'COMMIT_AND_FETCH · result 4096' },
    { from: 'drv', to: 'blk', text: 'request done', reply: true },
    { from: 'blk', to: 'app', text: 'write returns', reply: true },
  ], { active: [2], rowH: 44 })
}

function micaQueue() {
  const d = new Diagram(1200, 500)
  d.group(20, 20, 700, 450, 'One mica queue thread (up to 4 for each disk)')
  d.group(760, 20, 420, 450, 'tokio runtime')
  d.box('ring', 40, 70, 250, 90, 'io_uring ring\nublk commands + file I/O', { kind: 'ring', size: 17 })
  d.box('tasks', 390, 70, 300, 90, '64 tasks, one per tag', { kind: 'server', size: 17 })
  d.box('check', 390, 215, 300, 80, 'Is all data local?', { kind: 'app', size: 18, bold: true })
  d.box('fast', 390, 360, 300, 90, 'READ or WRITE on a local file\non the same ring', { kind: 'server', size: 17 })
  d.box('slow', 790, 200, 360, 110, 'S3 download\nFUA write · wait for a lock', { kind: 'remote', size: 17 })
  d.link('ring', 'r', 'tasks', 'l', { text: 'request', ly: 92 })
  d.link('tasks', 'b', 'check', 't')
  d.link('check', 'b', 'fast', 't', { text: 'yes', lx: 560, ly: 328, anchor: 'start' })
  d.link('check', 'r', 'slow', 'l', { at: 0.35, bt: 0.3, text: 'no', ly: 228 })
  d.link('slow', 'l', 'check', 'r', { at: 0.75, bt: 0.75, dashed: true, text: 'result · eventfd wake', lx: 740, ly: 300 })
  d.save('mica-queue', 'In mica, each queue thread owns one io_uring ring for the ublk commands and for file I/O. A request whose data is all local is read or written on the same ring. Other requests go to the tokio runtime, which downloads from S3 or waits for locks, then wakes the queue thread through an eventfd.')
}

function recovery() {
  sequence('recovery', 'User recovery: the old server exits. ublk_drv keeps /dev/ublkbN and holds I/O, and with REISSUE it puts requests the old server had back in the queue. A new server sends START_USER_RECOVERY, a FETCH for every tag, and END_USER_RECOVERY. The held requests then go to the new server.', [
    { id: 'app', label: 'Application', kind: 'app' },
    { id: 'drv', label: 'ublk_drv', kind: 'kernel' },
    { id: 'old', label: 'Old server', kind: 'server' },
    { id: 'new', label: 'New server', kind: 'server' },
  ], [
    { from: 'old', to: 'old', text: 'exits or crashes' },
    { from: 'drv', to: 'drv', text: 'keep /dev/ublkbN · requeue issued requests' },
    { from: 'app', to: 'drv', text: 'more I/O waits' },
    { from: 'new', to: 'drv', text: 'START_USER_RECOVERY' },
    { from: 'new', to: 'drv', text: 'FETCH for every tag' },
    { from: 'new', to: 'drv', text: 'END_USER_RECOVERY' },
    { from: 'drv', to: 'new', text: 'held requests arrive again', reply: true },
  ], { active: [1, 6], rowH: 46 })
}

function copies() {
  const d = new Diagram(1200, 470)
  d.group(20, 20, 1160, 200, 'Copy mode: two copies')
  d.group(20, 250, 1160, 200, 'Zero-copy: one copy')
  d.box('pc1', 50, 80, 280, 100, 'File data\n(page cache)', { kind: 'file' })
  d.box('buf1', 460, 80, 280, 100, 'Server buffer\n512 KiB for each tag', { kind: 'data' })
  d.box('req1', 870, 80, 280, 100, 'Request pages', { kind: 'kernel' })
  d.link('pc1', 'r', 'buf1', 'l', { text: 'copy 1: READ' })
  d.link('buf1', 'r', 'req1', 'l', { text: 'copy 2: at commit' })
  d.box('pc2', 50, 310, 280, 100, 'File data\n(page cache)', { kind: 'file' })
  d.box('buf2', 460, 310, 280, 100, 'no server buffer', { kind: 'data', dashed: true, muted: true })
  d.box('req2', 870, 310, 280, 100, 'Request pages\n(registered buffer)', { kind: 'kernel', active: true })
  d.arrow([[330, 330], [600, 290], [870, 330]], { state: 'active', text: 'READ_FIXED into the request pages', lx: 600, ly: 280 })
  d.save('copies', 'Copy mode needs two copies for a read: from the file into the server buffer, then from the server buffer into the request pages. Zero-copy needs one: READ_FIXED reads the file straight into the registered request pages, and the server buffer is gone.')
}

const ZC_ACTORS = [
  { id: 'drv', label: 'ublk_drv', kind: 'kernel' },
  { id: 'srv', label: 'ublk server', kind: 'server' },
  { id: 'file', label: 'Backing file', kind: 'file' },
]

function zeroCopy() {
  sequence('zc-manual', 'SUPPORT_ZERO_COPY: after FETCH completes, the server sends REGISTER_IO_BUF to put the request pages at buffer index 7, does READ_FIXED with buf_index 7, sends UNREGISTER_IO_BUF, then COMMIT_AND_FETCH.', ZC_ACTORS, [
    { from: 'drv', to: 'srv', text: 'FETCH done: READ · tag 7', reply: true },
    { from: 'srv', to: 'drv', text: 'REGISTER_IO_BUF · index 7' },
    { from: 'srv', to: 'file', text: 'READ_FIXED · buf_index 7' },
    { from: 'file', to: 'srv', text: 'done: data is in the request pages', reply: true },
    { from: 'srv', to: 'drv', text: 'UNREGISTER_IO_BUF · index 7' },
    { from: 'srv', to: 'drv', text: 'COMMIT_AND_FETCH · result 4096' },
  ], { active: [1, 4], rowH: 46 })
  sequence('zc-auto', 'AUTO_BUF_REG: ublk_drv registers the request pages at index 7 before it completes FETCH. The server does READ_FIXED and COMMIT_AND_FETCH. ublk_drv unregisters the buffer when the request completes.', ZC_ACTORS, [
    { from: 'drv', to: 'drv', text: 'register request pages at index 7' },
    { from: 'drv', to: 'srv', text: 'FETCH done: READ · tag 7', reply: true },
    { from: 'srv', to: 'file', text: 'READ_FIXED · buf_index 7' },
    { from: 'file', to: 'srv', text: 'done: data is in the request pages', reply: true },
    { from: 'srv', to: 'drv', text: 'COMMIT_AND_FETCH · result 4096' },
    { from: 'drv', to: 'drv', text: 'unregister index 7 · complete request' },
  ], { active: [0, 5], rowH: 46 })
}

function userCopy() {
  sequence('user-copy', 'USER_COPY on a cache miss: FETCH completes for tag 7, the server downloads the chunk from S3 into memory, writes it to /dev/ublkcN at the position of queue 0 and tag 7 to fill the request pages, then sends COMMIT_AND_FETCH.', [
    { id: 'drv', label: 'ublk_drv', kind: 'kernel' },
    { id: 'srv', label: 'ublk server', kind: 'server' },
    { id: 's3', label: 'S3', kind: 'remote' },
  ], [
    { from: 'drv', to: 'srv', text: 'FETCH done: READ · tag 7', reply: true },
    { from: 'srv', to: 's3', text: 'GET chunk' },
    { from: 's3', to: 'srv', text: 'chunk bytes in memory', reply: true },
    { from: 'srv', to: 'drv', text: 'write /dev/ublkcN at pos(queue 0, tag 7)' },
    { from: 'srv', to: 'drv', text: 'COMMIT_AND_FETCH · result' },
  ], { active: [3], rowH: 46 })
}

for (let i = 1; i <= 5; i++) uring(i)
fixed()
parts()
readCopy()
writeCopy()
micaQueue()
recovery()
copies()
zeroCopy()
userCopy()
