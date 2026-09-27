// Generates the sketch-style SVG diagrams for the WG Mesh deck.
// Each shape has a seed from its position, so a diagram looks the same in every stage.
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
const KIND = {
  plain: { fill: '#ffffff', stroke: '#495057' },
  mesh: { fill: '#e6f4f1', stroke: '#0f766e' },
  wg: { fill: '#f1ebfc', stroke: '#6d28d9' },
  under: { fill: '#f8efe6', stroke: '#92400e' },
  gw: { fill: '#fbe9f0', stroke: '#b4235a' },
  host: { fill: '#f8f9fa', stroke: '#868e96' },
}
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const seedOf = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h % 100000) + 1 }
const textWidth = (s, size) => s.length * size * 0.55

class Diagram {
  constructor(w, h) { this.w = w; this.h = h; this.parts = [] }

  save(name, alt) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" font-family="${FONT}" role="img" aria-label="${esc(alt)}">` +
      `<rect width="100%" height="100%" fill="#ffffff"/>${this.parts.join('')}</svg>\n`
    writeFileSync(`${OUT}/${name}.svg`, svg)
  }

  rough(drawable, dash) {
    const attr = dash ? ` stroke-dasharray="${dash}"` : ''
    this.parts.push(gen.toPaths(drawable).map((p) =>
      `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"${attr}/>`).join(''))
  }

  opts(key, o = {}) { return { roughness: 1.1, bowing: 0.8, strokeWidth: 1.6, seed: seedOf(key), ...o } }

  label(x, y, text, { size = 19, color = INK, anchor = 'middle', bold = false, bg = false, mono = false } = {}) {
    const lines = String(text).split('\n')
    const lh = size * 1.28
    const top = y - (lines.length - 1) * lh / 2
    if (bg) {
      const w = Math.max(...lines.map((l) => textWidth(l, size))) + 14
      const bx = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x - 7 : x - w + 7
      this.parts.push(`<rect x="${bx}" y="${top - lh / 2 - 2}" width="${w}" height="${lines.length * lh + 4}" rx="4" fill="#ffffff" opacity="0.94"/>`)
    }
    const family = mono ? ` font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace"` : ''
    this.parts.push(`<text font-size="${size}" fill="${color}" text-anchor="${anchor}" dominant-baseline="central" font-weight="${bold ? 650 : 400}"${family}>` +
      lines.map((l, i) => `<tspan x="${x}" y="${top + i * lh}">${esc(l)}</tspan>`).join('') + '</text>')
  }

  // A note is grey text on a white patch: state that the step reads or writes.
  note(x, y, text, { anchor = 'middle', color = NOTE, size = 16 } = {}) {
    this.label(x, y, text, { size, color, anchor, bg: true, mono: true })
  }

  box(x, y, w, h, text, { kind = 'plain', dashed = false, muted = false, size = 19, bold = false } = {}) {
    const k = KIND[kind]
    const stroke = muted ? MUTED : k.stroke
    this.parts.push(`<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="6" fill="${muted ? '#fafafa' : k.fill}"/>`)
    this.rough(gen.rectangle(x, y, w, h, this.opts(`box${x},${y},${w},${h}`, { stroke })), dashed ? '8 6' : '')
    if (text) this.label(x + w / 2, y + h / 2, text, { size, color: muted ? MUTED_TEXT : INK, bold })
  }

  group(x, y, w, h, text) {
    const k = KIND.host
    this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${k.fill}" opacity="0.6"/>`)
    this.rough(gen.rectangle(x, y, w, h, this.opts(`grp${x},${y}`, { stroke: k.stroke, strokeWidth: 1.2, roughness: 0.8 })), '6 6')
    this.label(x + 14, y + 20, text, { size: 17, color: '#495057', anchor: 'start', bold: true })
  }

  head(a, b, color, width, key) {
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0])
    const length = 14
    const spread = 0.42
    const p1 = [b[0] - length * Math.cos(angle - spread), b[1] - length * Math.sin(angle - spread)]
    const p2 = [b[0] - length * Math.cos(angle + spread), b[1] - length * Math.sin(angle + spread)]
    this.rough(gen.linearPath([p1, b, p2], this.opts(key, { stroke: color, strokeWidth: width, roughness: 0.6 })))
  }

  // state: normal, active (the step under discussion), muted, or hidden
  arrow(pts, { text = '', n = null, state = 'normal', both = false, dashed = false, color, lx, ly, anchor = 'middle', size = 17, plain = false } = {}) {
    if (state === 'hidden') return
    const stroke = state === 'active' ? ACCENT : state === 'muted' ? MUTED : color || INK
    const width = state === 'active' ? 2.6 : 1.6
    const key = 'arr' + pts.flat().join(',')
    this.rough(gen.linearPath(pts, this.opts(key, { stroke, strokeWidth: width, roughness: 0.9 })), dashed ? '7 6' : '')
    if (!plain) this.head(pts[pts.length - 2], pts[pts.length - 1], stroke, width, key + 'h')
    if (both && !plain) this.head(pts[1], pts[0], stroke, width, key + 't')
    if (!text && n === null) return
    if (lx === undefined || ly === undefined) {
      let best = 0
      let mid = pts[0]
      for (let i = 1; i < pts.length; i++) {
        const length = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        if (length > best) { best = length; mid = [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2] }
      }
      lx = lx ?? mid[0]
      ly = ly ?? mid[1]
    }
    const textColor = state === 'muted' ? MUTED_TEXT : state === 'active' ? ACCENT : color || INK
    this.step(lx, ly, n, text, { color: textColor, badge: state === 'muted' ? MUTED_TEXT : stroke, anchor, size })
  }

  // A numbered badge followed by a label, on a white patch.
  step(x, y, n, text, { color = INK, badge = INK, anchor = 'middle', size = 17 } = {}) {
    const lines = String(text).split('\n')
    const tw = text ? Math.max(...lines.map((l) => textWidth(l, size))) : 0
    const bw = n === null ? 0 : (text ? 28 : 22)
    const total = bw + tw
    const start = anchor === 'middle' ? x - total / 2 : anchor === 'start' ? x : x - total
    const lh = size * 1.28
    this.parts.push(`<rect x="${start - 6}" y="${y - lines.length * lh / 2 - 3}" width="${total + 12}" height="${lines.length * lh + 6}" rx="4" fill="#ffffff" opacity="0.94"/>`)
    if (n !== null) {
      this.parts.push(`<circle cx="${start + 11}" cy="${y}" r="11" fill="${badge}"/><text x="${start + 11}" y="${y}" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${n}</text>`)
    }
    if (text) this.label(start + bw, y, text, { size, color, anchor: 'start' })
  }

  cross(x, y) {
    const s = 11
    this.rough(gen.line(x - s, y - s, x + s, y + s, this.opts(`x1${x},${y}`, { stroke: '#c92a2a', strokeWidth: 2.4 })))
    this.rough(gen.line(x + s, y - s, x - s, y + s, this.opts(`x2${x},${y}`, { stroke: '#c92a2a', strokeWidth: 2.4 })))
  }
}

const on = (active) => (active ? 'active' : 'muted')

function layers() {
  const d = new Diagram(1160, 420)
  d.group(20, 20, 360, 380, 'Host 1')
  d.group(780, 20, 360, 380, 'Host 2')
  d.box(60, 60, 280, 70, 'VM A\nfdaa:1:0:2::3', { kind: 'mesh' })
  d.box(60, 190, 280, 70, 'wg0\nfdab::1', { kind: 'wg' })
  d.box(60, 310, 280, 70, 'private uplink\n10.0.0.1', { kind: 'under' })
  d.box(820, 60, 280, 70, 'VM B\nfdaa:1:0:2::7', { kind: 'mesh' })
  d.box(820, 190, 280, 70, 'wg0\nfdab::2', { kind: 'wg' })
  d.box(820, 310, 280, 70, 'private uplink\n10.0.0.2', { kind: 'under' })
  d.arrow([[200, 132], [200, 188]], { text: 'VM hook wraps', lx: 215, ly: 160, anchor: 'start' })
  d.arrow([[200, 262], [200, 308]], { text: 'WireGuard encrypts', lx: 215, ly: 285, anchor: 'start' })
  d.arrow([[960, 308], [960, 262]], { text: 'decrypts', lx: 975, ly: 285, anchor: 'start' })
  d.arrow([[960, 188], [960, 132]], { text: 'WG hook unwraps', lx: 975, ly: 160, anchor: 'start' })
  d.arrow([[340, 95], [818, 95]], { text: 'layer 3 · mesh · what the VMs see', dashed: true, color: KIND.mesh.stroke })
  d.arrow([[340, 225], [818, 225]], { text: 'layer 2 · WireGuard tunnel', dashed: true, color: KIND.wg.stroke })
  d.arrow([[340, 345], [818, 345]], { text: 'layer 1 · provider network · the real wire', color: KIND.under.stroke })
  d.save('layers', 'Two hosts. VM A on host 1 sends to VM B on host 2. The VM hook wraps the packet for wg0. WireGuard encrypts it and sends it over the provider private network. Host 2 decrypts it and its WireGuard hook unwraps it for VM B.')
}

function envelope() {
  const d = new Diagram(1160, 400)
  const levels = [
    ['under', 'IPv4 + UDP', '10.0.0.1 → 10.0.0.2', false],
    ['wg', 'WireGuard', 'encrypted', true],
    ['wg', 'IPv6 · next header 41', 'fdab::1 → fdab::2 · +40 bytes', false],
    ['mesh', 'IPv6 · the VM packet', 'fdaa:1:0:2::3 → fdaa:1:0:2::7 · up to 1380 bytes', false],
    ['plain', 'TCP payload', 'the VM data', false],
  ]
  levels.forEach(([kind, title, detail, dashed], i) => {
    const x = 20 + i * 36
    const y = 20 + i * 58
    const w = 1120 - i * 72
    const h = 360 - i * 72
    d.box(x, y, w, h, '', { kind, dashed })
    d.label(x + 18, y + 27, title, { size: 19, anchor: 'start', bold: true })
    d.label(x + w - 18, y + 27, detail, { size: 17, anchor: 'end', mono: true, color: '#343a40' })
  })
  d.save('envelope', 'A VM packet on the wire, outer layer first: IPv4 and UDP between host addresses, WireGuard encryption, an IPv6 header from fdab::1 to fdab::2 with next header 41, the VM IPv6 packet, and the TCP payload.')
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
  d.note(570, 400, '/sys/fs/bpf/atlas-wg-mesh', { size: 14 })
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
  d.save('host', 'One host runs four tc eBPF hooks that share pinned maps: the VM hook on each VM interface, the WireGuard hook on wg0, the uplink hook on the private uplink to other hosts, and the public hook on the public interface to the provider router.')
}

function known(stage) {
  const d = new Diagram(1160, 440)
  d.group(20, 20, 360, 380, 'Host 1 · fdab::1')
  d.group(780, 20, 360, 380, 'Host 2 · fdab::2')
  d.box(60, 64, 280, 64, 'VM A', { kind: 'mesh' })
  d.box(60, 174, 280, 64, 'VM hook')
  d.box(60, 284, 280, 64, 'wg0 · WireGuard', { kind: 'wg' })
  d.box(820, 64, 280, 64, 'VM B', { kind: 'mesh' })
  d.box(820, 174, 280, 64, 'WireGuard hook')
  d.box(820, 284, 280, 64, 'wg0 · WireGuard', { kind: 'wg' })
  d.arrow([[200, 128], [200, 172]], { n: 1, text: 'to fdaa:1:0:2::7', state: on(stage === 1), lx: 215, ly: 151, anchor: 'start' })
  d.arrow([[200, 238], [200, 282]], { n: 2, text: 'wrap for fdab::2', state: on(stage === 1), lx: 215, ly: 261, anchor: 'start' })
  d.arrow([[340, 316], [818, 316]], { n: 3, text: 'encrypted UDP, private network', state: on(stage === 2) })
  d.arrow([[960, 284], [960, 240]], { n: 4, text: 'decrypt', state: on(stage === 3), lx: 975, ly: 261, anchor: 'start' })
  d.arrow([[960, 174], [960, 130]], { n: 5, text: 'unwrap, deliver', state: on(stage === 3), lx: 975, ly: 151, anchor: 'start' })
  if (stage === 1) d.note(560, 206, 'host 1 remote_vms\nB → fdab::2')
  if (stage === 2) d.note(560, 370, 'WG Mesh does not own keys or peers')
  if (stage === 3) d.note(560, 206, 'host 2 local_vms\nB → its interface')
  const alts = [
    'VM A sends to VM B. The VM hook on host 1 checks the packet, finds VM B at fdab::2 in remote_vms, and adds an outer header for host 2.',
    'WireGuard on host 1 encrypts the tunnel packet and sends it as UDP over the private network to host 2.',
    'Host 2 decrypts the packet. Its WireGuard hook finds VM B in local_vms, removes the outer header, and Linux delivers the packet to VM B.',
  ]
  d.save(`known-${stage}`, alts[stage - 1])
}

function discovery(stage) {
  const d = new Diagram(1160, 440)
  d.group(20, 20, 360, 390, 'Host 1')
  d.group(780, 20, 360, 390, 'Host 2')
  d.box(60, 64, 280, 64, 'VM A', { kind: 'mesh' })
  d.box(60, 174, 280, 64, 'VM hook')
  d.box(60, 284, 280, 64, 'uplink hook', { kind: 'under' })
  d.box(820, 64, 280, 64, 'VM B', { kind: 'mesh' })
  d.box(820, 174, 280, 64, 'proxy NDP entry for B\nadded by vm sync', { size: 17 })
  d.box(820, 284, 280, 64, 'uplink · Linux', { kind: 'under' })
  d.arrow([[200, 128], [200, 172]], { n: 1, text: 'to B, no entry', state: on(stage === 1), lx: 215, ly: 151, anchor: 'start' })
  d.arrow([[200, 238], [200, 282]], { n: 2, text: 'becomes a solicitation', state: on(stage === 1), lx: 215, ly: 261, anchor: 'start' })
  d.arrow([[340, 302], [818, 302]], { n: 3, text: 'who has fdaa:1:0:2::7?', state: on(stage === 1) })
  d.arrow([[960, 238], [960, 282]], { text: 'answer at once', state: on(stage === 2), lx: 975, ly: 261, anchor: 'start' })
  d.arrow([[818, 336], [342, 336]], { n: 4, text: 'I do: host 2 MAC', state: on(stage === 2) })
  if (stage === 1) {
    d.cross(560, 206)
    d.note(560, 170, 'the data is lost')
  }
  if (stage === 2) d.note(960, 380, 'proxy_delay = 0')
  if (stage === 3) {
    d.note(200, 380, 'remote_vms: B → fdab::2', { color: ACCENT })
    d.note(560, 180, 'MAC → peer_list → fdab::2\nthe retry uses WireGuard')
  }
  const alts = [
    'Host 1 has no location for VM B. The VM hook replaces the packet with a neighbor solicitation that asks who has fdaa:1:0:2::7, and sends it on the private uplink. The data is lost.',
    'Host 2 has a proxy NDP entry for VM B, so Linux answers at once with host 2 uplink MAC.',
    'The uplink hook on host 1 maps the answering MAC to host 2 through peer_list and stores VM B at fdab::2 in remote_vms. The retry uses WireGuard.',
  ]
  d.save(`discovery-${stage}`, alts[stage - 1])
}

function moved(stage) {
  const d = new Diagram(1160, 470)
  d.group(20, 20, 340, 390, 'Host 1')
  d.group(410, 20, 340, 390, 'Host 2 · old')
  d.group(800, 20, 340, 390, 'Host 3 · new')
  d.box(60, 64, 260, 64, 'VM A', { kind: 'mesh' })
  d.box(60, 184, 260, 64, 'WireGuard hook')
  d.box(60, 304, 260, 64, 'uplink hook', { kind: 'under' })
  d.box(450, 64, 260, 64, 'VM B was here', { dashed: true, muted: true })
  d.box(450, 184, 260, 64, 'WireGuard hook')
  d.box(450, 304, 260, 64, 'uplink', { muted: true })
  d.box(840, 64, 260, 64, 'VM B', { kind: 'mesh' })
  d.box(840, 184, 260, 64, 'WireGuard hook', { muted: true })
  d.box(840, 304, 260, 64, 'uplink · proxy NDP', { kind: 'under' })
  d.arrow([[190, 128], [190, 182]], { text: 'VM hook wraps', state: on(stage === 1), lx: 175, ly: 155, anchor: 'end' })
  d.arrow([[320, 204], [448, 204]], { n: 1, text: 'to fdab::2', state: on(stage === 1), lx: 385, ly: 168 })
  d.arrow([[450, 232], [322, 232]], { n: 2, text: 'NOT_HERE', state: on(stage === 2), lx: 385, ly: 270 })
  d.arrow([[190, 370], [190, 440], [970, 440], [970, 370]], { n: 3, text: 'who has B? · host 3 answers', both: true, state: on(stage === 3) })
  if (stage === 1) d.note(190, 390, 'B → fdab::2 (stale)')
  if (stage === 2) {
    d.note(190, 390, 'sender matches: delete B')
    d.note(580, 150, 'B not in local_vms')
  }
  if (stage === 3) d.note(190, 390, 'B → fdab::3', { color: ACCENT })
  const alts = [
    'VM B moved from host 2 to host 3. Host 1 missed the announcement and still tunnels to host 2 at fdab::2.',
    'VM B is not in host 2 local_vms, so host 2 replies NOT_HERE. Host 1 checks that the reply came from the stored host and deletes the entry.',
    'Host 1 sends a new lookup on the uplink. Host 3 answers, and host 1 stores VM B at fdab::3.',
  ]
  d.save(`moved-${stage}`, alts[stage - 1])
}

function gateway(stage) {
  const inbound = stage === 1
  const d = new Diagram(1160, 440)
  d.box(20, 70, 170, 64, 'client', { kind: 'gw' })
  d.box(20, 180, 170, 64, 'provider router')
  d.group(230, 20, 400, 370, 'Host 2')
  d.box(250, 64, 360, 64, 'IPv6 router VM · fdaa:1::56', { kind: 'gw', size: 18 })
  d.box(250, 174, 170, 64, 'public hook')
  d.box(440, 174, 170, 64, 'VM hook')
  d.box(440, 284, 170, 64, 'WireGuard hook')
  d.group(760, 20, 380, 370, 'Host 1')
  d.box(780, 64, 340, 64, 'VM V · fdaa:1:0:abcd::5', { kind: 'mesh', size: 18 })
  d.box(780, 174, 160, 64, 'WireGuard hook', { size: 17 })
  d.box(960, 174, 160, 64, 'VM hook')

  const i = inbound ? 'active' : 'hidden'
  d.arrow([[105, 134], [105, 178]], { n: 1, text: 'to public address', state: i, lx: 120, ly: 157, anchor: 'start' })
  d.arrow([[190, 206], [248, 206]], { n: 2, text: 'host 2 MAC', state: i, lx: 220, ly: 264 })
  d.arrow([[335, 174], [335, 130]], { n: 3, text: 'Linux route', state: i, lx: 350, ly: 151, anchor: 'start' })
  d.arrow([[525, 128], [525, 172]], { n: 4, text: 'dst → mesh', state: i, lx: 540, ly: 151, anchor: 'start' })
  d.arrow([[610, 206], [778, 206]], { n: 5, text: 'tunnel · 41', state: i })
  d.arrow([[860, 174], [860, 130]], { n: 6, text: 'route back? yes', state: i, lx: 875, ly: 151, anchor: 'start' })

  const r = inbound ? 'hidden' : 'active'
  d.arrow([[1040, 128], [1040, 172]], { n: 1, text: 'reply to client', state: r, lx: 1025, ly: 151, anchor: 'end' })
  d.arrow([[1040, 238], [1040, 316], [612, 316]], { n: 2, text: 'tunnel 254 + gateway address', state: r })
  d.arrow([[440, 316], [425, 316], [425, 130]], { n: 3, text: 'to the named gateway', state: r, lx: 425, ly: 262 })
  d.arrow([[250, 96], [192, 96]], { n: 4, text: 'src → public', state: r, lx: 160, ly: 157 })

  d.note(950, 290, 'V route: 2000::/3 via fdaa:1::56')
  if (inbound) d.note(430, 372, 'owned_prefixes: 2001:db8:1:2:3::/80')
  d.save(`gateway-${stage}`, inbound
    ? 'A public client sends to a public address. The provider router sends it to host 2, which owns the prefix. Linux routes it to the IPv6 router VM, which changes the destination to the mesh address of VM V and keeps the client source. The VM hook tunnels it to host 1, whose WireGuard hook checks that VM V has a gateway route back to the client.'
    : 'VM V replies to the client. The VM hook on host 1 finds the router in gateway_routes and sends a tunnel with next header 254 and the gateway address. Host 2 delivers it to the named gateway, and the router changes the source to the public address.')
}

function prefix(stage) {
  const d = new Diagram(1160, 480)
  d.box(20, 180, 170, 64, 'provider router')
  d.group(230, 20, 380, 380, 'Host 2 · old')
  d.box(250, 180, 340, 64, 'public hook', { kind: 'gw' })
  d.group(660, 20, 480, 380, 'Host 3 · new')
  d.box(680, 64, 440, 64, 'IPv6 router VM', { kind: 'gw' })
  d.box(680, 180, 200, 64, 'WireGuard hook')
  d.box(920, 180, 200, 64, 'public hook', { kind: 'gw' })

  const first = stage === 1 ? 'active' : 'muted'
  d.arrow([[190, 212], [248, 212]], { n: 1, text: 'cached MAC', state: first, lx: 220, ly: 160 })
  d.arrow([[590, 212], [678, 212]], { n: 2, text: 'tunnel', state: first, lx: 635, ly: 160 })
  d.arrow([[880, 212], [918, 212]], { n: 3, text: 'becomes an NA', state: first, lx: 900, ly: 272 })
  d.arrow([[1020, 244], [1020, 430], [80, 430], [80, 246]], { n: 4, text: 'unsolicited NA, override: host 3 MAC', state: first })

  const next = stage === 2 ? 'active' : 'hidden'
  d.arrow([[130, 244], [130, 455], [1070, 455], [1070, 246]], { n: 1, text: 'direct to host 3', state: next })
  d.arrow([[1020, 180], [1020, 130]], { n: 2, text: 'Linux route', state: next, lx: 1005, ly: 155, anchor: 'end' })

  d.note(420, 320, 'moved_prefixes: /80 for 5 min')
  d.note(900, 330, 'owned_prefixes: /80')
  d.save(`prefix-${stage}`, stage === 1
    ? 'The router moved from host 2 to host 3. The provider still sends to host 2, whose public hook finds the prefix in moved_prefixes and tunnels the packet to host 3. Host 3 turns it into an unsolicited neighbor advertisement with the override flag, and the provider learns host 3 MAC.'
    : 'The provider now sends the public address straight to host 3, and Linux routes it to the router VM.')
}

layers()
envelope()
host()
for (const stage of [1, 2, 3]) { known(stage); discovery(stage); moved(stage) }
for (const stage of [1, 2]) { gateway(stage); prefix(stage) }
