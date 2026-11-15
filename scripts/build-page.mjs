import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from 'pele'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const section = process.argv[2]
const slug = process.argv[3]

if (!['research', 'learning', 'plans', 'demos'].includes(section) ||
    !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('Usage: npm run build:page -- <research|learning|plans|demos> <lowercase-kebab-case-slug>')
  process.exit(1)
}

const sourceDir = resolve(root, 'raw', section, slug)
const source = resolve(sourceDir, 'index.html')
const output = resolve(root, section, slug)

if (!existsSync(source)) {
  console.error(`Missing page source: ${source}`)
  process.exit(1)
}

// Each <script type="text/mermaid" data-label="..."> block becomes an inline SVG.
// The page sets the --pele-* CSS variables, so one SVG follows light and dark themes.
// --diagram-width lets the page keep a wide diagram readable on a phone, for example with min-width.
const diagram = /<script type="text\/mermaid"(?: data-label="([^"]*)")?>([\s\S]*?)<\/script>/g
let count = 0

const html = readFileSync(source, 'utf8').replace(diagram, (block, label, text) => {
  count += 1
  if (!label) throw new Error(`Diagram ${count} has no data-label for its alternative text`)

  let svg, width
  try {
    ({ svg, width } = render(text.trim(), { idPrefix: `d${count}-`, fontSize: 14 }))
  } catch (error) {
    throw new Error(`Diagram ${count} (${label.slice(0, 60)}...): ${error.message}`)
  }
  return `<div class="diagram" role="img" aria-label="${label}" style="--diagram-width: ${Math.ceil(width)}px">${svg}</div>`
})

mkdirSync(output, { recursive: true })
cpSync(sourceDir, output, {
  recursive: true,
  filter: (path) => !path.endsWith('README.md'),
})
writeFileSync(resolve(output, 'index.html'), html)
console.log(`Rendered ${count} diagrams into ${section}/${slug}/index.html`)

const listings = spawnSync('python3', ['.github/scripts/update_listings.py'], {
  cwd: root,
  stdio: 'inherit',
})

process.exit(listings.status || 0)
