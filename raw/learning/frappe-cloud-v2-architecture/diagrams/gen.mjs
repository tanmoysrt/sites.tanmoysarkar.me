// Generates the sketch-style SVG diagrams for the Frappe Cloud v2 architecture deck.
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
  user: { fill: '#ffffff', stroke: '#495057' },
  central: { fill: '#e7f1fb', stroke: '#1c6fb8' },
  control: { fill: '#fff9db', stroke: '#a37f00' },
  service: { fill: '#fbe9f0', stroke: '#b4235a' },
  host: { fill: '#f1f3f5', stroke: '#495057' },
  vm: { fill: '#e6f4f1', stroke: MESH },
  external: { fill: '#f8efe6', stroke: '#92400e' },
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

  box(id, x, y, w, h, text, { kind = 'user', dashed = false, muted = false, active = false, size = 18, bold = false } = {}) {
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

function overview() {
  const d = new Diagram(1200, 640)
  d.group(20, 14, 1160, 124, 'Global · one for all regions')
  d.group(20, 168, 1160, 232, 'Region · one for each location')
  d.group(20, 430, 1160, 196, 'Metal hosts · many in each region')
  d.box('browser', 60, 50, 190, 64, 'Customer\nbrowser', { kind: 'user' })
  d.box('central', 500, 46, 220, 72, 'Central', { kind: 'central', bold: true, size: 22 })
  d.box('atlas', 50, 214, 220, 72, 'Atlas app\nregional control', { kind: 'control', bold: true })
  d.box('cargo', 330, 214, 200, 72, 'Cargo\nstorage · images', { kind: 'control', bold: true })
  d.box('proxy', 590, 214, 180, 72, 'HTTP proxy\ncluster', { kind: 'service' })
  d.box('gateway', 800, 214, 170, 72, 'WireGuard\ngateway', { kind: 'service' })
  d.box('router', 995, 214, 160, 72, 'IPv6\nrouter', { kind: 'service' })
  d.note(872, 345, 'Cargo, proxy, gateway and router run in service VMs on Metal hosts')
  d.group(40, 466, 400, 140, 'Host A')
  d.group(760, 466, 400, 140, 'Host B')
  d.box('metalA', 60, 506, 170, 66, 'Metal\n(metald)', { kind: 'host' })
  d.box('vmA', 250, 506, 170, 66, 'VM\nPilot · site', { kind: 'vm' })
  d.box('metalB', 780, 506, 170, 66, 'Metal\n(metald)', { kind: 'host' })
  d.box('vmB', 970, 506, 170, 66, 'VM\nPilot · site', { kind: 'vm' })
  d.link('browser', 'r', 'central', 'l', { text: 'dashboard' })
  d.link('central', 'b', 'atlas', 't', { at: 0.1, bt: 0.6, text: 'tenant API ↓ · state webhooks ↑', lx: 330, ly: 153 })
  d.link('atlas', 't', 'central', 'b', { at: 0.8, bt: 0.2, dashed: true })
  d.link('central', 'b', 'cargo', 't', { at: 0.5, bt: 0.8, text: 'buckets', lx: 560, ly: 153 })
  d.link('central', 'b', 'proxy', 't', { at: 0.85, text: 'site routes', lx: 700, ly: 153 })
  d.link('cargo', 'l', 'atlas', 'r', { text: 'machines', ly: 236 })
  d.link('atlas', 'b', 'metalA', 't', { at: 0.4, bt: 0.5 })
  d.link('atlas', 'b', 'metalB', 't', { at: 0.8, bt: 0.3, text: 'mutual TLS · VM changes · host sync every 10 s', lx: 520, ly: 415 })
  d.arrow([[440, 590], [760, 590]], { both: true, color: MESH, text: 'WG Mesh · WireGuard tunnel', ly: 590 })
  d.save('overview', 'Three layers. Global: the customer browser calls Central. Region: Central calls Atlas, Cargo and the HTTP proxy cluster; Atlas sends state webhooks back to Central; Cargo asks Atlas for machines. The WireGuard gateway and IPv6 router are also regional services. Hosts: Atlas calls Metal on each host over mutual TLS, and WG Mesh joins the hosts with WireGuard tunnels. VMs run Pilot and the site.')
}

function central() {
  const d = new Diagram(1200, 500)
  d.box('browser', 30, 200, 170, 80, 'Customer\nbrowser', { kind: 'user' })
  d.box('central', 280, 170, 200, 140, 'Central', { kind: 'central', bold: true, size: 24 })
  d.box('atlas', 870, 20, 300, 80, 'Atlas app (each region)', { kind: 'control', bold: true })
  d.box('cargo', 870, 140, 300, 80, 'Cargo (each region)', { kind: 'control', bold: true })
  d.box('proxy', 870, 260, 300, 80, 'HTTP proxy cluster', { kind: 'service', bold: true })
  d.box('pilot', 870, 380, 300, 80, 'Pilot (in each VM)', { kind: 'vm', bold: true })
  d.link('browser', 'r', 'central', 'l', { text: 'dashboard\nAPI', ly: 240 })
  d.link('central', 'r', 'atlas', 'l', { at: 0.1, bt: 0.3, text: 'VMs · images · IPs · snapshots · console', lx: 660, ly: 58 })
  d.link('atlas', 'l', 'central', 'r', { at: 0.75, bt: 0.25, dashed: true, text: 'VM state webhook (signed)', lx: 660, ly: 128 })
  d.link('central', 'r', 'cargo', 'l', { at: 0.4, bt: 0.35, text: 'create bucket · rotate keys', lx: 690, ly: 192 })
  d.link('cargo', 'l', 'central', 'r', { at: 0.75, bt: 0.52, dashed: true, text: 'cluster usable (webhook)', lx: 700, ly: 238 })
  d.link('central', 'r', 'proxy', 'l', { at: 0.68, text: 'site and domain routes', lx: 680, ly: 286 })
  d.link('central', 'r', 'pilot', 'l', { at: 0.85, bt: 0.3, text: 'login · rename · admin domain', lx: 650, ly: 345 })
  d.link('pilot', 'l', 'central', 'b', { at: 0.75, bt: 0.5, via: [[380, 440]], dashed: true, text: 'enroll · heartbeat · domains', lx: 640, ly: 440 })
  d.note(380, 345, 'solid: Central calls\ndashed: Central receives', { size: 15 })
  d.save('central', 'Central in the middle. The customer browser calls Central. Central calls Atlas in each region for VMs, images, IPs, snapshots and console, and Atlas sends signed VM state webhooks back. Central calls Cargo to create buckets and rotate keys, and Cargo sends a webhook when a cluster is usable. Central writes site and domain routes to the HTTP proxy cluster. Central calls Pilot for login, rename and admin domain, and Pilot enrolls, sends heartbeats and registers domains with Central.')
}

function region() {
  const d = new Diagram(1200, 520)
  d.box('central', 410, 16, 260, 64, 'Central', { kind: 'central', bold: true })
  d.box('cargo', 30, 200, 220, 80, 'Cargo', { kind: 'control', bold: true })
  d.box('atlas', 410, 190, 260, 100, 'Atlas app\nregional decisions', { kind: 'control', bold: true, size: 20 })
  d.box('datum', 30, 410, 220, 70, 'Datum\nmetrics · logs', { kind: 'external' })
  d.box('metal', 410, 410, 260, 70, 'Metal on every host', { kind: 'host', bold: true })
  d.box('providers', 900, 16, 270, 64, 'Server providers\ncloud · bare metal', { kind: 'external', size: 16 })
  d.box('dns', 900, 116, 270, 64, 'DNS · ACME certificates', { kind: 'external', size: 16 })
  d.box('storage', 900, 216, 270, 64, 'Object storage\nimage artifacts', { kind: 'external', size: 16 })
  d.box('services', 900, 316, 270, 64, 'Service VMs\nproxy · gateway · router · Cargo', { kind: 'service', size: 16 })
  d.link('central', 'b', 'atlas', 't', { text: 'tenant API', ly: 135 })
  d.link('cargo', 'r', 'atlas', 'l', { text: 'tenant API\n(tenant 0)', ly: 240 })
  d.link('atlas', 'b', 'metal', 't', { text: 'mutual TLS\nVM changes · host sync every 10 s', ly: 350 })
  d.link('atlas', 'r', 'providers', 'l', { at: 0.15, text: 'order hosts', lx: 790, ly: 105 })
  d.link('atlas', 'r', 'dns', 'l', { at: 0.35, text: 'records · certs', lx: 790, ly: 170 })
  d.link('atlas', 'r', 'storage', 'l', { at: 0.6, text: 'images', lx: 790, ly: 249 })
  d.link('atlas', 'r', 'services', 'l', { at: 0.85, text: 'SSH: install · config', lx: 790, ly: 320 })
  d.link('atlas', 'b', 'datum', 'r', { at: 0.15, bt: 0.3, text: 'metrics', lx: 320, ly: 370 })
  d.link('metal', 'l', 'datum', 'r', { bt: 0.7, ly: 460 })
  d.save('region', 'Atlas in the middle of a region. Central and Cargo call the Atlas tenant API. Atlas calls Metal on every host over mutual TLS for VM changes and a host sync every 10 seconds. Atlas orders hosts from server providers, writes DNS records and certificates, keeps image artifacts in object storage, and installs and configures service VMs over SSH. Atlas and Metal push metrics to Datum.')
}

function host() {
  const d = new Diagram(1200, 560)
  d.box('atlas', 470, 14, 260, 60, 'Atlas app', { kind: 'control', bold: true })
  d.group(30, 110, 480, 330, 'Host A')
  d.group(690, 110, 480, 330, 'Host B')
  d.box('vmA1', 50, 170, 190, 70, 'VM 1\nFirecracker', { kind: 'vm' })
  d.box('vmA2', 50, 300, 190, 70, 'VM 2\nFirecracker', { kind: 'vm' })
  d.box('metaldA', 300, 160, 190, 56, 'metald', { kind: 'host', bold: true })
  d.box('wgA', 300, 255, 190, 56, 'wg0 + eBPF', { kind: 'vm' })
  d.box('zfsA', 300, 350, 190, 56, 'ZFS pool', { kind: 'host' })
  d.box('metaldB', 710, 160, 190, 56, 'metald', { kind: 'host', bold: true })
  d.box('wgB', 710, 255, 190, 56, 'wg0 + eBPF', { kind: 'vm' })
  d.box('zfsB', 710, 350, 190, 56, 'ZFS pool', { kind: 'host' })
  d.box('vmB1', 960, 170, 190, 70, 'VM 3\nFirecracker', { kind: 'vm' })
  d.box('vmB2', 960, 300, 190, 70, 'VM 4\nFirecracker', { kind: 'vm' })
  d.box('objects', 470, 476, 260, 60, 'Object storage', { kind: 'external' })
  d.link('atlas', 'b', 'metaldA', 't', { at: 0.3, text: 'mutual TLS', lx: 400, ly: 92 })
  d.link('atlas', 'b', 'metaldB', 't', { at: 0.7, text: 'mutual TLS', lx: 800, ly: 92 })
  d.link('metaldA', 'l', 'vmA1', 'r', { text: 'start', ly: 175 })
  d.link('vmA2', 'r', 'wgA', 'l', { at: 0.3, color: MESH, text: 'veth', ly: 300 })
  d.link('metaldB', 'r', 'vmB1', 'l', { text: 'start', ly: 175 })
  d.link('vmB2', 'l', 'wgB', 'r', { at: 0.3, color: MESH, text: 'veth', ly: 300 })
  d.arrow([d.port('metaldA', 'r'), d.port('metaldB', 'l')], { both: true, text: 'migration\ncontrol + disk stream', ly: 188 })
  d.arrow([d.port('wgA', 'r'), d.port('wgB', 'l')], { both: true, color: MESH, text: 'WireGuard\ntunnel', ly: 283 })
  d.link('objects', 't', 'zfsA', 'b', { at: 0.2, text: 'images in\nsnapshots out', lx: 400, ly: 450 })
  d.link('objects', 't', 'zfsB', 'b', { at: 0.8 })
  d.save('host', 'Two Metal hosts. Atlas calls metald on each host over mutual TLS. metald starts Firecracker VMs and keeps their disks in a ZFS pool. VMs connect through a veth link to wg0 with eBPF programs. The two hosts share a WireGuard tunnel, and the two metald daemons talk directly for migration. Object storage sends images to the ZFS pools and receives snapshots.')
}

const CREATE_ACTORS = [
  { id: 'user', label: 'Customer', kind: 'user' },
  { id: 'central', label: 'Central', kind: 'central' },
  { id: 'atlas', label: 'Atlas', kind: 'control' },
  { id: 'metal', label: 'Metal', kind: 'host' },
  { id: 'vm', label: 'VM · Pilot', kind: 'vm' },
  { id: 'proxy', label: 'HTTP proxy', kind: 'service' },
]
const CREATE_MESSAGES = [
  { from: 'user', to: 'central', text: 'create server' },
  { from: 'central', to: 'central', text: 'check plan · save action · queue job' },
  { from: 'central', to: 'atlas', text: 'POST /virtual-machines' },
  { from: 'atlas', to: 'atlas', text: 'choose host · save draft' },
  { from: 'atlas', to: 'metal', text: 'PUT VM' },
  { from: 'metal', to: 'atlas', text: '202: saved to disk', reply: true },
  { from: 'atlas', to: 'central', text: 'VM id', reply: true },
  { from: 'metal', to: 'vm', text: 'ZFS clone · boot' },
  { from: 'atlas', to: 'metal', text: 'host sync (every 10 s)' },
  { from: 'metal', to: 'atlas', text: 'VM is running', reply: true },
  { from: 'atlas', to: 'central', text: 'state webhook' },
  { from: 'vm', to: 'central', text: 'Pilot enrolls' },
  { from: 'central', to: 'proxy', text: 'site route' },
]
const CREATE_STEPS = [[0, 1, 2], [3, 4, 5, 6], [7], [8, 9, 10], [11, 12]]

function createFlow() {
  const alt = 'Sequence of a server create: the customer asks Central; Central checks the plan and calls Atlas; Atlas saves a draft and calls Metal, which saves the request and replies 202; Metal clones the disk and boots the VM; host sync reports the VM as running and Atlas sends a state webhook to Central; Pilot in the VM enrolls with Central, and Central writes the site route to the HTTP proxy.'
  CREATE_STEPS.forEach((active, i) => {
    sequence(`create-${i + 1}`, alt, CREATE_ACTORS, CREATE_MESSAGES, { active, upTo: Math.max(...active) + 1 })
  })
}

function cargoFlow() {
  sequence('cargo-setup', 'Sequence of a Cargo storage setup: Cargo asks Atlas for a machine as tenant 0; Atlas calls Metal; Cargo polls Atlas until the machine runs and has a mesh address; Cargo installs Garage over SSH through the mesh and joins it to the layout through the Garage admin API; Cargo writes the S3 routes to the HTTP proxy; Cargo tells Central with a webhook that the cluster is usable.', [
    { id: 'cargo', label: 'Cargo', kind: 'control' },
    { id: 'atlas', label: 'Atlas', kind: 'control' },
    { id: 'metal', label: 'Metal', kind: 'host' },
    { id: 'garage', label: 'Garage VM', kind: 'vm' },
    { id: 'proxy', label: 'HTTP proxy', kind: 'service' },
    { id: 'central', label: 'Central', kind: 'central' },
  ], [
    { from: 'cargo', to: 'atlas', text: 'create machine (tenant 0)' },
    { from: 'atlas', to: 'metal', text: 'PUT VM' },
    { from: 'cargo', to: 'atlas', text: 'poll: running + mesh address' },
    { from: 'cargo', to: 'garage', text: 'SSH over WG Mesh: install' },
    { from: 'cargo', to: 'garage', text: 'Garage admin API: join layout' },
    { from: 'cargo', to: 'proxy', text: 'S3 routes' },
    { from: 'cargo', to: 'central', text: 'webhook: cluster usable' },
  ], { rowH: 46 })
}

function webRequest() {
  const d = new Diagram(1200, 330)
  d.box('browser', 30, 160, 180, 80, 'Browser', { kind: 'user', bold: true })
  d.box('dns', 250, 14, 230, 64, 'DNS\nregion wildcard', { kind: 'external' })
  d.box('proxy', 360, 150, 250, 100, 'Proxy VM\nTLS · route map', { kind: 'service', bold: true })
  d.group(800, 110, 380, 190, 'Metal host')
  d.box('vm', 840, 155, 300, 90, 'Site VM\nPilot · bench', { kind: 'vm', bold: true })
  d.link('browser', 't', 'dns', 'l', { at: 0.4, via: [[102, 46]], text: '1. which node?', lx: 120, ly: 110, anchor: 'start' })
  d.link('browser', 'r', 'proxy', 'l', { text: '2. HTTPS', ly: 182 })
  d.link('proxy', 'r', 'vm', 'l', { color: MESH, text: '3. HTTP to mesh address\nover WG Mesh', ly: 175 })
  d.note(420, 300, 'Atlas writes DNS · Central writes the site route · WG Mesh finds the host')
  d.save('web-request', 'A web request: the browser asks DNS which proxy node to use, sends HTTPS to the proxy VM, and the proxy VM reads its route map and sends HTTP to the site VM mesh address over WG Mesh.')
}

function vpnAndIpv6() {
  const d = new Diagram(1200, 400)
  d.box('device', 30, 50, 220, 80, 'Customer device\nWireGuard client', { kind: 'user' })
  d.box('gateway', 390, 50, 250, 80, 'WireGuard gateway VM\npublic IPv4', { kind: 'service', bold: true })
  d.box('client', 30, 250, 220, 80, 'Internet client\npublic IPv6', { kind: 'user' })
  d.box('router', 390, 250, 250, 80, 'IPv6 router VM\nstateless translation', { kind: 'service', bold: true })
  d.group(800, 100, 380, 190, 'Metal host')
  d.box('vm', 840, 150, 300, 90, 'Tenant VM\nmesh address', { kind: 'vm', bold: true })
  d.link('device', 'r', 'gateway', 'l', { text: 'WireGuard', ly: 74 })
  d.link('client', 'r', 'router', 'l', { text: 'public IPv6', ly: 274 })
  d.link('gateway', 'r', 'vm', 'l', { bt: 0.3, color: MESH, text: 'WG Mesh', lx: 720, ly: 120 })
  d.link('router', 'r', 'vm', 'l', { bt: 0.7, color: MESH, text: 'WG Mesh', lx: 720, ly: 260 })
  d.save('vpn-ipv6', 'Two more entry paths. A customer device connects with WireGuard to a gateway VM with public IPv4, and the gateway forwards packets over WG Mesh to the tenant VM. An internet client sends public IPv6 to the IPv6 router VM, which translates the address and forwards over WG Mesh to the tenant VM.')
}

function bucket() {
  const d = new Diagram(1200, 450)
  d.box('central', 30, 50, 220, 80, 'Central', { kind: 'central', bold: true })
  d.box('cargo', 390, 50, 220, 80, 'Cargo', { kind: 'control', bold: true })
  d.box('bench', 30, 300, 220, 80, 'Site VM\nbench as S3 client', { kind: 'vm' })
  d.box('proxy', 390, 300, 220, 80, 'Proxy VM\nS3 route', { kind: 'service' })
  d.group(720, 20, 460, 410, 'Garage cluster · VMs that Cargo built')
  d.box('gw', 760, 70, 380, 80, 'Garage gateway node\nS3 API · admin API', { kind: 'vm', bold: true })
  d.box('s1', 760, 320, 115, 70, 'storage 1', { kind: 'vm', size: 16 })
  d.box('s2', 892, 320, 115, 70, 'storage 2', { kind: 'vm', size: 16 })
  d.box('s3', 1025, 320, 115, 70, 'storage 3', { kind: 'vm', size: 16 })
  d.link('central', 'r', 'cargo', 'l', { at: 0.3, bt: 0.3, text: 'create bucket · keys', ly: 48 })
  d.link('cargo', 'l', 'central', 'r', { at: 0.72, bt: 0.72, dashed: true, text: 'cluster usable', ly: 120 })
  d.link('cargo', 'r', 'gw', 'l', { color: MESH, text: 'admin API\nover WG Mesh', ly: 110 })
  d.link('bench', 'r', 'proxy', 'l', { text: 'S3 over HTTPS', ly: 322 })
  d.link('proxy', 'r', 'gw', 'b', { bt: 0.1, via: [[690, 340], [690, 210], [798, 210]], color: MESH, text: 'over WG Mesh', lx: 650, ly: 250 })
  d.link('gw', 'b', 's1', 't', { at: 0.4, bt: 0.6 })
  d.link('gw', 'b', 's2', 't', { at: 0.5, text: 'copies of each object', ly: 245 })
  d.link('gw', 'b', 's3', 't', { at: 0.6, bt: 0.4 })
  d.save('bucket', 'Buckets. Central asks Cargo to create a bucket and keys; Cargo reports when the cluster is usable. Cargo calls the Garage admin API on the gateway node over WG Mesh. A bench in a site VM sends S3 over HTTPS to the proxy VM, which forwards over WG Mesh to the Garage gateway node; the gateway stores copies of each object on the storage nodes.')
}

overview()
central()
region()
host()
createFlow()
cargoFlow()
webRequest()
vpnAndIpv6()
bucket()
