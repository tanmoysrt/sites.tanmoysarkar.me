import { defineMermaidSetup } from '@slidev/types'

export default defineMermaidSetup(() => ({
  theme: 'base',
  themeVariables: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    primaryColor: '#eef4ff',
    primaryBorderColor: '#0057ff',
    primaryTextColor: '#0b2557',
    lineColor: '#5b6678',
    secondaryColor: '#f5f8fc',
    tertiaryColor: '#ffffff',
    clusterBkg: '#f5f8fc',
    clusterBorder: '#e3e8f0',
    actorBkg: '#eef4ff',
    actorBorder: '#0057ff',
    actorTextColor: '#0b2557',
    signalColor: '#0f1a2e',
    signalTextColor: '#0f1a2e',
    noteBkgColor: '#f5f8fc',
    noteBorderColor: '#e3e8f0',
    noteTextColor: '#0f1a2e',
    edgeLabelBackground: '#ffffff',
  },
}))
