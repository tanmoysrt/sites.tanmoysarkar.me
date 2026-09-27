// Renders each flow to ../assets/<name>.mp4 and its last frame to ../assets/<name>.png for reduced motion.
// Run ../diagrams/render.mjs first: it writes public/ and src/flows.json.
import { bundle } from '@remotion/bundler'
import { getCompositions, renderMedia, renderStill } from '@remotion/renderer'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ASSETS = join(HERE, '../assets')
const only = process.argv.slice(2)

const serveUrl = await bundle({ entryPoint: join(HERE, 'src/index.jsx'), publicDir: join(HERE, 'public') })
const compositions = (await getCompositions(serveUrl)).filter((composition) => !only.length || only.includes(composition.id))
for (const composition of compositions) {
  await renderMedia({ composition, serveUrl, codec: 'h264', crf: 20, scale: 2, outputLocation: join(ASSETS, `${composition.id}.mp4`) })
  await renderStill({ composition, serveUrl, frame: composition.durationInFrames - 1, scale: 2, output: join(ASSETS, `${composition.id}.png`) })
  console.log(`rendered ${composition.id}: ${(composition.durationInFrames / composition.fps).toFixed(1)} s`)
}
