// Builds the site into one folder: copies the files, builds the pages that use
// the kit, checks every page, and writes the home and section lists.
// Usage: node scripts/site.mjs [out]   (default: _site)
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { checkPage, isKitPage } from './lib/check.mjs'
import { listPage } from './lib/list.mjs'
import { buildKitPage, SECTIONS } from './lib/page.mjs'

const root = resolve(import.meta.dirname, '..')
const COPY = ['kit', 'skills', 'styles.css', '404.html', 'robots.txt', 'llms.txt', 'CNAME', '.nojekyll', 'install-skills.sh']

main()

function main() {
  const out = resolve(root, process.argv[2] || '_site')
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  for (const name of [...COPY, ...Object.keys(SECTIONS)]) if (existsSync(join(root, name))) cpSync(join(root, name), join(out, name), { recursive: true })

  const entries = listEntries()
  const failed = buildPages(entries, out)
  writeLists(entries, out)
  if (failed) process.exit(1)
  console.log(`Built ${entries.length} pages into ${relative(root, out) || '.'}`)
}

function buildPages(entries, out) {
  let failed = false
  for (const entry of entries) {
    for (const file of htmlFiles(join(root, entry.section, entry.slug))) {
      const rel = relative(root, file)
      const html = readFileSync(file, 'utf8')
      const { errors, warnings } = checkPage(html, rel)
      for (const w of warnings) console.warn(`warn  ${rel}: ${w}`)
      for (const e of errors) console.error(`error ${rel}: ${e}`)
      if (errors.length) { failed = true; continue }
      if (!isKitPage(html)) continue
      try {
        writeFileSync(join(out, rel), buildKitPage(html, entry))
      } catch (error) {
        console.error(`error ${rel}: ${error.message}`)
        failed = true
      }
    }
  }
  return failed
}

function writeLists(entries, out) {
  const sorted = [...entries].sort((a, b) => b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title))
  writeFileSync(join(out, 'index.html'), listPage(sorted, 'all'))
  for (const section of Object.keys(SECTIONS)) writeFileSync(join(out, section, 'index.html'), listPage(sorted, section))
}

function listEntries() {
  const entries = []
  for (const section of Object.keys(SECTIONS)) {
    for (const slug of readdirSync(join(root, section)).sort()) {
      const file = join(root, section, slug, 'index.html')
      if (!statSync(join(root, section, slug)).isDirectory()) continue
      if (!existsSync(file)) { console.warn(`warn  ${section}/${slug}: no index.html, so the page is not listed`); continue }
      const html = readFileSync(file, 'utf8')
      const [added, updated] = gitDates(file)
      entries.push({ section, slug, title: title(html), description: meta(html, 'description'), added, updated })
    }
  }
  return entries
}

function gitDates(file) {
  const today = new Date().toISOString().slice(0, 10)
  try {
    const dates = execFileSync('git', ['log', '--follow', '--format=%as', '--', file], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
    return dates.length ? [dates.at(-1), dates[0]] : [today, today]
  } catch {
    return [today, today]
  }
}

function htmlFiles(dir) {
  return readdirSync(dir, { recursive: true }).map((f) => join(dir, f)).filter((f) => f.endsWith('.html'))
}

function title(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? m[1].replace(/\s+/g, ' ').replace(/ · sites\.tanmoysarkar\.me$/, '').trim() : ''
}

function meta(html, name) {
  const m = html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`, 'i'))
  return m ? m[1] : ''
}
