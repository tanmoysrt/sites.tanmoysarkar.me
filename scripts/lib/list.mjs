import { SECTIONS } from './page.mjs'

const SITE = 'sites.tanmoysarkar.me'
const INTRO = 'Reports, guides, plans, and demos made with AI, kept here to read and share.'

// The home page (active = 'all') and each section page: the date and title of
// each page, newest first, grouped by month.
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
<header>
<h1><a href="/">${SITE}</a></h1>
<p>${INTRO}</p>
${sections(entries, active)}
</header>
<div class="index">${rows(shown)}</div>
<p class="foot">For agents: <a href="/llms.txt">llms.txt</a></p>
</main>
</body>
</html>
`
}

// Plain links with counts. The link of the open section goes back home.
function sections(entries, active) {
  const links = Object.entries(SECTIONS).map(([s, label]) => {
    const count = entries.filter((e) => e.section === s).length
    const on = s === active
    return `<a href="${on ? '/' : `/${s}/`}"${on ? ' aria-current="page"' : ''}>${label}<i>${count}</i></a>`
  })
  return `<nav class="sections" aria-label="Sections">${links.join('')}</nav>`
}

function rows(entries) {
  let month = ''
  let out = ''
  for (const e of entries) {
    const date = new Date(`${e.updated}T00:00:00Z`)
    const m = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    if (m !== month) {
      out += `<h2>${m}</h2>`
      month = m
    }
    const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    out += `<a href="/${e.section}/${e.slug}/"><time datetime="${e.updated}">${day}</time><span>${e.title}</span></a>`
  }
  return out
}
