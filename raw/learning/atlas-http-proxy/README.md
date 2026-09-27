# HTTP proxy deck

`slides.md` is the Marp source. The diagrams are Excalidraw scenes in `diagrams/scenes/`. Open a `.excalidraw` file at [excalidraw.com](https://excalidraw.com) to edit it.

A scene with `customData.from` and `customData.to` on its elements is a flow. Each step shows the elements visible at that step. The new elements of a step get the orange accent. An arrow with `customData.frame` carries the header strip that the flow shows under the diagram. Remotion in `motion/` plays the steps as a video, and moves a message along the new arrows of each step. With reduced motion, the slide shows the last frame as a still image.

To render after a change, run from the repository root:

```sh
(cd raw/learning/atlas-http-proxy/diagrams && npm install && node render.mjs)
(cd raw/learning/atlas-http-proxy/motion && npm install && node render.mjs)
npm run build:deck -- learning atlas-http-proxy
```

`diagrams/render.mjs` uses Chromium at `/usr/bin/chromium-browser`, or at `CHROME_PATH`. It writes static SVG files to `assets/`, and flow steps to `motion/public/`. `motion/render.mjs` writes `assets/<flow>.mp4` and `assets/<flow>.png`. Remotion downloads its own headless Chrome on the first run. To render only some flows, name them: `node render.mjs health partial`.
