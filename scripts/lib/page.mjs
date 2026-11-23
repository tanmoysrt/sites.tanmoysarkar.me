import { renderDiagram } from './diagram.mjs'

export const SECTIONS = { plans: 'Plans', research: 'Research', learning: 'Learning', demos: 'Demos' }
const KIND = { plans: 'Plan', research: 'Research', learning: 'Guide', demos: 'Demo' }
const WORDS_PER_MINUTE = 220

// Builds a page that uses the kit: diagrams, scrollable tables, heading ids,
// the meta line, the contents list, and the top bar.
export function buildKitPage(html, entry) {
  let out = renderDiagrams(html)
  out = wrapTables(out)
  out = addHeadingIds(out)
  out = addMeta(out, entry)
  return addFrame(out, entry, headings(out))
}

export function formatDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function renderDiagrams(html) {
  let n = 0
  return html.replace(/<script type="text\/mermaid"([^>]*)>([\s\S]*?)<\/script>/g, (_, attrs, source) => {
    n += 1
    return renderDiagram(source, { label: attr(attrs, 'data-label'), caption: attr(attrs, 'data-caption'), id: `d${n}` })
  })
}

function wrapTables(html) {
  return html.replace(/(<div class="table">\s*)?<table[\s\S]*?<\/table>/g, (table, wrapped) => (wrapped ? table : `<div class="table">${table}</div>`))
}

function addHeadingIds(html) {
  const used = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]))
  return html.replace(/<h([23])(?![^>]*\bid=)([^>]*)>([\s\S]*?)<\/h\1>/g, (_, level, attrs, inner) => {
    let id = slugify(text(inner)) || `section-${used.size + 1}`
    while (used.has(id)) id += '-2'
    used.add(id)
    return `<h${level} id="${id}"${attrs}>${inner}</h${level}>`
  })
}

function addMeta(html, entry) {
  if (html.includes('class="meta"')) return html
  const parts = [KIND[entry.section], formatDate(entry.added)]
  if (entry.updated !== entry.added) parts.push(`Updated ${formatDate(entry.updated)}`)
  parts.push(`${Math.max(1, Math.round(wordCount(html) / WORDS_PER_MINUTE))} min read`)
  return html.replace(/(<p class="lead"[^>]*>[\s\S]*?<\/p>)/, `$1\n<p class="meta">${parts.join(' · ')}</p>`)
}

function addFrame(html, entry, list) {
  const top = `<nav class="top"><a href="/">sites.tanmoysarkar.me</a><span>/</span><a href="/${entry.section}/">${SECTIONS[entry.section]}</a></nav>`
  let out = html
  if (list.length >= 3) {
    const items = list.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join('')
    const firstH2 = out.search(/<h2[\s>]/)
    out = `${out.slice(0, firstH2)}<details class="contents"><summary>Contents</summary><ol>${items}</ol></details>\n${out.slice(firstH2)}`
  }
  const toc = list.length >= 3 ? `<nav class="toc" aria-label="On this page">${list.map(([id, label]) => `<a href="#${id}">${label}</a>`).join('')}</nav>${TOC_SCRIPT}` : ''
  return out.replace(/<article([^>]*)>/, `${top}\n<div class="layout"><article$1>`).replace(/<\/article>/, `</article>${toc}</div>`)
}

// Marks the section in view. Without JavaScript the list still works.
const TOC_SCRIPT = `<script>(()=>{const l=[...document.querySelectorAll('.toc a')],h=l.map(a=>document.getElementById(a.hash.slice(1)));const f=()=>{let i=0;h.forEach((e,j)=>{if(e&&e.getBoundingClientRect().top<120)i=j});l.forEach((a,j)=>a.classList.toggle('on',j===i))};addEventListener('scroll',f,{passive:true});f()})()</script>`

function headings(html) {
  const body = html.replace(/<footer[\s\S]*?<\/footer>/g, '').replace(/<details class="contents">[\s\S]*?<\/details>/, '')
  return [...body.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => [m[1], text(m[2])])
}

function wordCount(html) {
  const body = html.replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, '')
  return text(body).split(/\s+/).filter(Boolean).length
}

function attr(attrs, name) {
  const m = attrs.match(new RegExp(`${name}="([^"]*)"`))
  return m ? m[1] : ''
}

function text(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}

function slugify(value) {
  return value.toLowerCase().replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}
