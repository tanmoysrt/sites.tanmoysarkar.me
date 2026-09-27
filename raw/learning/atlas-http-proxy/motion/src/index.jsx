import { Composition, registerRoot } from 'remotion'
import { FPS, Flow, timeline } from './Flow.jsx'
import flows from './flows.json'

function Root() {
  return flows.map((flow) => (
    <Composition key={flow.name} id={flow.name} component={Flow} fps={FPS} width={flow.width} height={flow.height + flow.stripHeight} durationInFrames={timeline(flow).durationInFrames} defaultProps={{ flow }} />
  ))
}

registerRoot(Root)
