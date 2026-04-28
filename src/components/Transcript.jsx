import { useEffect, useRef } from 'react'
import { colorForSpeaker } from '../utils/speakerColors'

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(1).padStart(4, '0')
  return `${m}:${s}`
}

export default function Transcript({ segments, currentTime = null, colorMap }) {
  const activeRef = useRef(null)

  const activeIndex = currentTime === null
    ? -1
    : segments.findIndex((seg) => currentTime >= seg.start && currentTime <= seg.end)

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeIndex])

  if (!segments?.length) return null

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Full Transcript</h2>
      <div style={styles.list}>
        {segments.map((seg, i) => {
          const color = colorForSpeaker(colorMap, seg.speaker)
          const isActive = i === activeIndex

          return (
            <div
              key={i}
              ref={isActive ? activeRef : null}
              style={{
                ...styles.segment,
                ...(isActive ? styles.segmentActive : {}),
              }}
            >
              <div style={styles.meta}>
                <span style={{ ...styles.speaker, color }}>{seg.speaker}</span>
                <span style={styles.time}>
                  {fmtTime(seg.start)} – {fmtTime(seg.end)}
                </span>
              </div>
              <p style={styles.text}>{seg.text}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    maxWidth: 640,
  },
  heading: {
    fontSize: 13,
    fontWeight: 600,
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 12,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    maxHeight: 420,
    overflowY: 'auto',
    borderRadius: 8,
    paddingRight: 4,
  },
  segment: {
    padding: '10px 14px',
    borderRadius: 8,
    background: '#1a1a24',
    borderLeft: '3px solid transparent',
    transition: 'background 0.15s, border-color 0.15s',
    cursor: 'default',
  },
  segmentActive: {
    background: '#1e2038',
    borderLeftColor: '#4f8ef7',
  },
  meta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  speaker: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  time: {
    fontSize: 11,
    color: '#555',
    fontFamily: 'monospace',
  },
  text: {
    fontSize: 14,
    color: '#d0d0da',
    lineHeight: 1.5,
    margin: 0,
  },
}
