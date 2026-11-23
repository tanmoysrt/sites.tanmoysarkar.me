// Checks pages before you push. Usage: node scripts/check.mjs [file ...]
// With no file, it checks every page. It exits with 1 when a page has an error.
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { checkPage } from './lib/check.mjs'
import { SECTIONS } from './lib/page.mjs'

const root = resolve(import.meta.dirname, '..')
const files = process.argv.slice(2).length ? process.argv.slice(2).map((f) => resolve(f)) : allPages()
let errors = 0
for (const file of files) {
  const rel = relative(root, file)
  const result = checkPage(readFileSync(file, 'utf8'), rel)
  for (const w of result.warnings) console.warn(`warn  ${rel}: ${w}`)
  for (const e of result.errors) console.error(`error ${rel}: ${e}`)
  errors += result.errors.length
}
console.log(errors ? `${errors} errors` : `${files.length} pages OK`)
process.exit(errors ? 1 : 0)

function allPages() {
  return Object.keys(SECTIONS).flatMap((s) => readdirSync(join(root, s), { recursive: true }).filter((f) => f.endsWith('.html') && f !== 'index.html').map((f) => join(root, s, f)))
}
