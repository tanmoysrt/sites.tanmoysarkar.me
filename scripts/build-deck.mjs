import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const section = process.argv[2]
const slug = process.argv[3]

if (!['research', 'learning', 'plans'].includes(section) ||
    !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('Usage: npm run build:deck -- <research|learning|plans> <lowercase-kebab-case-slug>')
  process.exit(1)
}

const source = resolve(root, 'decks', section, slug, 'slides.md')
const output = resolve(root, section, slug)
const slidev = resolve(root, 'node_modules', '.bin', 'slidev')

if (!existsSync(source)) {
  console.error(`Missing deck source: ${source}`)
  process.exit(1)
}

if (!existsSync(slidev)) {
  console.error('Slidev is not installed. Run npm ci first.')
  process.exit(1)
}

const build = spawnSync(slidev, [
  'build', source,
  '--base', `/${section}/${slug}/`,
  '--out', output,
  '--without-notes',
], { cwd: root, stdio: 'inherit' })

if (build.status !== 0) process.exit(build.status || 1)

const listings = spawnSync('python3', ['.github/scripts/update_listings.py'], {
  cwd: root,
  stdio: 'inherit',
})

process.exit(listings.status || 0)
