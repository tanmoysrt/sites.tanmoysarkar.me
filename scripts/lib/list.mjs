import { formatDate, SECTIONS } from './page.mjs'

const SITE = 'sites.tanmoysarkar.me'
const INTRO = 'Reports, plans and guides made with AI, kept here to read and share.'

// The home page (active = 'all') and each section page: one list, newest first.
export function listPage(entries, active) {
  const shown = active === 'all' ? entries : entries.filter((e) => e.section === active)
  const name = active === 'all' ? SITE : `${SECTIONS[active]} · ${SITE}`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<meta name="description" content="${INTRO}">
<link rel="stylesheet" href="/kit/page.css">
</head>
<body>
<main class="home">
<h1><a href="/">${SITE}</a></h1>
<p class="lead">${INTRO}</p>
<div class="bar">${tabs(entries, active)}<input class="search" type="search" placeholder="Search" aria-label="Search pages"></div>
<div id="list">${rows(shown, active === 'all')}</div>
<p class="empty" hidden>No page matches.</p>
<p class="foot">Static pages. <a href="/llms.txt">Instructions for agents</a>.</p>
</main>
<script>${SEARCH}</script>
</body>
</html>
`
}

function tabs(entries, active) {
  const count = (s) => (s === 'all' ? entries.length : entries.filter((e) => e.section === s).length)
  const items = [['all', 'All', '/'], ...Object.entries(SECTIONS).map(([s, label]) => [s, label, `/${s}/`])]
  return `<nav class="tabs" aria-label="Sections">${items
    .map(([s, label, href]) => `<a href="${href}"${s === active ? ' aria-current="page"' : ''}>${label}<i>${count(s)}</i></a>`)
    .join('')}</nav>`
}

function rows(entries, showSection) {
  let month = ''
  let out = ''
  for (const e of entries) {
    const m = new Date(`${e.updated}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    if (m !== month) { out += `<p class="month">${m}</p>`; month = m }
    const date = formatDate(e.updated).replace(/ \d{4}$/, '')
    const section = showSection ? `<span class="s">${SECTIONS[e.section]} · </span>` : ''
    const desc = e.description ? `<span class="d">${e.description}</span>` : ''
    const q = `${e.title} ${e.description}`.toLowerCase().replace(/"/g, '')
    out += `<a class="entry" href="/${e.section}/${e.slug}/" data-q="${q}"><span class="t">${e.title}</span>${desc}<span class="r">${section}${date}</span></a>`
  }
  return out
}

// Filters the list as you type and hides months with no match.
const SEARCH = `(()=>{const i=document.querySelector('.search'),l=document.getElementById('list'),e=document.querySelector('.empty');i.addEventListener('input',()=>{const q=i.value.trim().toLowerCase();let any=false,head=null,seen=false;for(const n of l.children){if(n.classList.contains('month')){if(head)head.hidden=!seen;head=n;seen=false;continue}const ok=n.dataset.q.includes(q);n.hidden=!ok;if(ok){seen=true;any=true}}if(head)head.hidden=!seen;e.hidden=any})})()`
