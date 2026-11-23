#!/usr/bin/env node
// Renders a Mermaid file to an SVG with the colors of sites.tanmoysarkar.me.
// Usage: node render.mjs chart.mmd [out.svg]
// The colors are a copy of the diagram part of kit/page.css. Keep them in step.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const STYLE = `
svg.pele { background: var(--pele-bg);
  --bg:#fff; --text:#1c1d1f; --muted:#646a72; --faint:#9a9fa6; --line-strong:#d3d6db; --soft:#f6f7f8; --soft-2:#edeff2;
  --accent:#2b5fd9; --warn:#a35d00; --bad:#c0352b;
  --s1:#4f7be8; --s2:#e8894f; --s3:#3fa66b; --s4:#d65a5a; --s5:#8a6fd6; --s6:#2fa3a3; --s7:#c99a1e; --s8:#8c9097; }
@media (prefers-color-scheme: dark) { svg.pele {
  --bg:#111214; --text:#e7e8ea; --muted:#9ba1a9; --faint:#6d737b; --line-strong:#363a40; --soft:#191b1e; --soft-2:#212428;
  --accent:#86aaff; --warn:#f0ad54; --bad:#ff8b80;
  --s1:#7c9ef0; --s2:#f0a271; --s3:#62c18a; --s4:#e88080; --s5:#a891e6; --s6:#4fc2c2; --s7:#e0b84a; --s8:#a4a8ae; } }
svg.pele { --pele-bg:var(--soft); --pele-fg:var(--text); --pele-muted:var(--muted); --pele-line:var(--faint);
  --pele-surface:var(--bg); --pele-surface-alt:var(--soft-2); --pele-border:var(--line-strong); --pele-accent:var(--accent);
  --pele-critical:var(--bad); --pele-error:var(--bad); --pele-font:system-ui,sans-serif; --pele-radius:8px;
  --pele-series-1:var(--s1); --pele-series-2:var(--s2); --pele-series-3:var(--s3); --pele-series-4:var(--s4);
  --pele-series-5:var(--s5); --pele-series-6:var(--s6); --pele-series-7:var(--s7); --pele-series-8:var(--s8); }
.blue{--c:var(--s1)} .orange{--c:var(--s2)} .teal{--c:var(--s6)} .purple{--c:var(--s5)} .yellow{--c:var(--s7)} .tan{--c:#a0826d} .pink{--c:#d16ba5} .gray{--c:var(--s8)}
.pele :is(.blue,.orange,.purple,.yellow,.teal,.tan,.pink,.gray) > rect { fill: color-mix(in srgb, var(--c) 14%, var(--pele-surface)) !important; stroke: color-mix(in srgb, var(--c) 45%, var(--pele-border)) !important; }
.pele .hl > :is(rect,polygon,circle,ellipse,path) { stroke: var(--pele-accent) !important; stroke-width: 1.5px !important; }
.pele .bugPath > rect { stroke: var(--accent) !important; stroke-width: 2px !important; }
.pele .repeats > rect { stroke: var(--s5) !important; stroke-width: 2px !important; stroke-dasharray: 5 3; }
.pele .mayBreak > rect { fill: color-mix(in srgb, var(--warn) 14%, var(--pele-surface)) !important; stroke: var(--warn) !important; stroke-width: 2px !important; }
.pele .mayBreak text { fill: var(--warn) !important; }
.pele .breaks > rect { fill: color-mix(in srgb, var(--bad) 13%, var(--pele-surface)) !important; stroke: var(--bad) !important; stroke-width: 2px !important; }
.pele .breaks text { fill: var(--bad) !important; font-weight: 600; }
.pele .pele-state-start circle { fill: var(--pele-fg); stroke: none; }
`

const PELE = '1.13.0'
const CACHE = join(homedir(), '.cache', 'tanmoy-state-chart')

const [input, output = input.replace(/\.\w+$/, '') + '.svg'] = process.argv.slice(2)
if (!input) {
  console.error('Usage: node render.mjs chart.mmd [out.svg]')
  process.exit(2)
}
const { render } = await loadPele()
const result = render(readFileSync(input, 'utf8').trim(), { idPrefix: 'c-', fontSize: 14, fontFamily: 'system-ui, sans-serif', limit: 1_000_000, outputLimit: 8_000_000, maxEdges: 10_000 })
writeFileSync(output, result.svg.replace(/(<svg[^>]*>)/, `$1<style>${STYLE}</style>`))
console.log(`Wrote ${output} (${Math.round(result.width)}x${Math.round(result.height)})`)

async function loadPele() {
  const entry = join(CACHE, 'node_modules', 'pele', 'dist', 'pele.js')
  if (!existsSync(entry)) {
    console.error(`Installing pele@${PELE} into ${CACHE}`)
    execFileSync('npm', ['install', '--prefix', CACHE, '--no-save', '--silent', `pele@${PELE}`], { stdio: 'inherit' })
  }
  return import(pathToFileURL(entry).href)
}
