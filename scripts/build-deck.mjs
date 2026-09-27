import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
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

const sourceDir = resolve(root, 'raw', section, slug)
const source = resolve(sourceDir, 'slides.md')
const output = resolve(root, section, slug)
const assets = resolve(sourceDir, 'assets')

if (!existsSync(source)) {
  console.error(`Missing deck source: ${source}`)
  process.exit(1)
}

const version = spawnSync('marp', ['--version'], { encoding: 'utf8' })
if (version.error || version.status !== 0) {
  console.error('Marp CLI is required. Install it with: npm install -g @marp-team/marp-cli')
  process.exit(1)
}

mkdirSync(output, { recursive: true })

const build = spawnSync('marp', [
  source,
  '--output', resolve(output, 'index.html'),
  '--template', 'bespoke',
], { cwd: root, stdio: 'inherit' })

if (build.status !== 0) process.exit(build.status || 1)

const outputAssets = resolve(output, 'assets')
rmSync(outputAssets, { recursive: true, force: true })
if (existsSync(assets)) cpSync(assets, outputAssets, { recursive: true })

const listings = spawnSync('python3', ['.github/scripts/update_listings.py'], {
  cwd: root,
  stdio: 'inherit',
})

process.exit(listings.status || 0)
