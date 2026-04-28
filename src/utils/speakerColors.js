const COLORS = [
  '#4f8ef7', // blue
  '#ff9f0a', // orange
  '#30d158', // green
  '#bf5af2', // purple
  '#ff6b6b', // red
  '#64d2ff', // cyan
  '#ffd60a', // yellow
]

export function buildColorMap(segments) {
  const map = new Map()
  let i = 0
  for (const seg of segments) {
    const key = seg.speaker.toLowerCase().trim()
    if (!map.has(key)) map.set(key, COLORS[i++ % COLORS.length])
  }
  return map
}

export function colorForSpeaker(colorMap, speaker) {
  return colorMap.get(speaker.toLowerCase().trim()) ?? '#888'
}
