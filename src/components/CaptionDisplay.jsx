import { colorForSpeaker } from '../utils/speakerColors'

export default function CaptionDisplay({ segments, currentTime, colorMap }) {
  const active = segments.filter(
    (seg) => currentTime >= seg.start && currentTime <= seg.end
  )

  return (
    <div style={styles.box}>
      {active.length === 0 ? (
        <span style={styles.silence}>···</span>
      ) : (
        active.map((seg, i) => (
          <Caption
            key={`${seg.start}-${seg.speaker}`}
            seg={seg}
            currentTime={currentTime}
            color={colorForSpeaker(colorMap, seg.speaker)}
          />
        ))
      )}
    </div>
  )
}

function Caption({ seg, currentTime, color }) {
  const words = seg.text.split(/\s+/)
  const duration = seg.end - seg.start
  const progress = duration > 0 ? (currentTime - seg.start) / duration : 1
  // always show at least 1 word the moment the segment becomes active
  const visibleCount = Math.max(1, Math.ceil(progress * words.length))

  return (
    <div style={styles.caption}>
      <span style={{ ...styles.speaker, color }}>{seg.speaker}</span>
      <p style={styles.text}>
        {words.map((word, i) => (
          <span
            key={i}
            style={{
              opacity: i < visibleCount ? 1 : 0,
              transition: i < visibleCount ? 'opacity 0.15s ease' : 'none',
            }}
          >
            {word}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </p>
    </div>
  )
}

const styles = {
  box: {
    width: '100%',
    maxWidth: 640,
    minHeight: 96,
    background: '#111118',
    border: '1px solid #222230',
    borderRadius: 10,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 14,
  },
  silence: {
    color: '#333',
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
  },
  caption: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  speaker: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  text: {
    fontSize: 17,
    color: '#e8e8ed',
    lineHeight: 1.5,
    margin: 0,
  },
}
