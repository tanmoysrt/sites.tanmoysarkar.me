import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion'

export const FPS = 30
const FADE = 8
const ACCENT = '#e8590c'

const pathLength = (path) => path.slice(1).reduce((sum, point, i) => sum + Math.hypot(point[0] - path[i][0], point[1] - path[i][1]), 0)

// Each step shows its Excalidraw image. The message then moves along each new arrow of the step, one after another.
export function timeline(flow) {
  const seconds = (value) => Math.round(value * FPS)
  const steps = []
  const moves = []
  let time = 0
  for (const step of flow.steps) {
    const start = time
    time += seconds(0.5)
    for (const arrow of step.arrows) {
      const duration = seconds(Math.min(1.8, Math.max(0.7, pathLength(arrow.path) / 280)))
      moves.push({ ...arrow, start: time, end: time + duration })
      time += duration + seconds(0.25)
    }
    time += seconds(1.2)
    steps.push({ start, end: time })
  }
  return { steps, moves, durationInFrames: time + seconds(1.5) }
}

function pointAt(path, progress) {
  let remaining = progress * pathLength(path)
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1]
    const [x1, y1] = path[i]
    const length = Math.hypot(x1 - x0, y1 - y0)
    if (remaining <= length) return [x0 + ((x1 - x0) * remaining) / length, y0 + ((y1 - y0) * remaining) / length]
    remaining -= length
  }
  return path[path.length - 1]
}

const fadeIn = (frame, start) => (start === 0 ? 1 : interpolate(frame, [start, start + FADE], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))

export function Flow({ flow }) {
  const frame = useCurrentFrame()
  const { steps, moves } = timeline(flow)
  const strips = moves.filter((move, i) => i === 0 || move.strip !== moves[i - 1].strip)
  const move = moves.find((candidate) => frame >= candidate.start && frame <= candidate.end)
  const progress = move ? interpolate(frame, [move.start, move.end], [0, 1], { easing: Easing.inOut(Easing.quad) }) : 0
  const [x, y] = move ? pointAt(move.path, progress) : [0, 0]

  return (
    <AbsoluteFill style={{ backgroundColor: '#ffffff' }}>
      {steps.map((step, i) => (
        <Img key={i} src={staticFile(`${flow.name}/step-${i + 1}.svg`)} style={{ position: 'absolute', left: 0, top: 0, width: flow.width, height: flow.height, opacity: frame >= step.start ? fadeIn(frame, step.start) : 0 }} />
      ))}
      <div style={{ position: 'absolute', left: 20, right: 20, top: flow.height + 2, borderTop: '1.5px dashed #dee2e6' }} />
      {strips.map((strip, i) => (
        <Img key={strip.strip} src={staticFile(`${flow.name}/strip-${strip.strip}.svg`)} style={{ position: 'absolute', left: 0, top: flow.height, width: flow.width, height: flow.stripHeight, opacity: (i === 0 || frame >= strip.start) && (!strips[i + 1] || frame < strips[i + 1].start) ? fadeIn(frame, i === 0 ? 0 : strip.start) : 0 }} />
      ))}
      {move && (
        <div style={{ position: 'absolute', left: x - 13, top: y - 9, width: 26, height: 18, borderRadius: 5, border: `2.5px solid ${ACCENT}`, background: '#ffffff', boxShadow: '0 0 0 3px #ffffff' }} />
      )}
    </AbsoluteFill>
  )
}
