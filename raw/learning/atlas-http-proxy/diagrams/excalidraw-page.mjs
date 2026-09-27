// Opens a headless Chromium page that runs the Excalidraw library, so scenes render exactly as Excalidraw draws them.
import { build } from 'esbuild'
import http from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUILD = join(HERE, '.build')
export const EXCALIDRAW_DIST = join(HERE, 'node_modules/@excalidraw/excalidraw/dist/prod')
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.woff2': 'font/woff2', '.css': 'text/css', '.wasm': 'application/wasm' }
const CHROME = process.env.CHROME_PATH || '/usr/bin/chromium-browser'

export async function openExcalidraw() {
  mkdirSync(BUILD, { recursive: true })
  await build({
    entryPoints: [join(HERE, 'browser.js')],
    bundle: true,
    format: 'esm',
    outfile: join(BUILD, 'bundle.js'),
    define: { 'process.env.NODE_ENV': '"production"', 'process.env.IS_PREACT': '"false"' },
    logLevel: 'error',
  })
  writeFileSync(join(BUILD, 'index.html'), "<!doctype html><meta charset=\"utf-8\"><script>window.EXCALIDRAW_ASSET_PATH = '/excalidraw/'</script><script type=\"module\" src=\"bundle.js\"></script>")

  // Excalidraw fetches and subsets its fonts at export time, and fetch() does not work from file:// pages.
  const server = http.createServer((request, response) => {
    const path = decodeURIComponent(request.url.split('?')[0])
    const file = path.startsWith('/excalidraw/') ? join(EXCALIDRAW_DIST, path.slice('/excalidraw/'.length)) : join(BUILD, path)
    if (!resolve(file).startsWith(HERE) || !existsSync(file)) { response.writeHead(404).end(); return }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(readFileSync(file))
  }).listen(0, '127.0.0.1')
  await new Promise((done) => server.once('listening', done))

  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  page.on('pageerror', (error) => console.error('page error:', error.message))
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`)
  await page.waitForFunction('window.renderScene && window.convertScene')
  if (!(await page.evaluate(() => window.fontsReady))) throw new Error('Excalidraw fonts did not load')
  return { page, close: async () => { await browser.close(); server.close() } }
}
