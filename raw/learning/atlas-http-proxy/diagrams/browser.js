import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Excalidraw, convertToExcalidrawElements, exportToSvg } from '@excalidraw/excalidraw'

// The editor loads the fonts of its scene into document.fonts. Text measurement needs them before any scene is built.
const SAMPLE = 'The quick brown fox 0123456789 → · ✓'
const host = document.createElement('div')
host.style.cssText = 'position:fixed;inset:0;width:800px;height:600px'
document.body.append(host)
createRoot(host).render(createElement(Excalidraw, {
  initialData: { elements: convertToExcalidrawElements([5, 8].map((fontFamily, i) => ({ type: 'text', x: 0, y: i * 40, text: SAMPLE, fontSize: 20, fontFamily }))) },
}))

window.fontsReady = (async () => {
  for (let i = 0; i < 100 && !(document.fonts.check('20px Excalifont') && document.fonts.check('20px "Comic Shanns"')); i++) {
    await new Promise((done) => setTimeout(done, 100))
  }
  await document.fonts.load(`20px Excalifont`, SAMPLE)
  await document.fonts.load(`20px "Comic Shanns"`, SAMPLE)
  host.remove()
  return document.fonts.check('20px Excalifont') && document.fonts.check('20px "Comic Shanns"')
})()

window.convertScene = (skeleton) => convertToExcalidrawElements(skeleton, { regenerateIds: false })

window.renderScene = async (elements) => {
  const svg = await exportToSvg({
    elements,
    appState: { exportBackground: true, viewBackgroundColor: '#ffffff', exportEmbedScene: false },
    files: {},
    exportPadding: 0,
  })
  return svg.outerHTML
}
