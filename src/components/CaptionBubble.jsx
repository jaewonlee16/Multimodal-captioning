export default function CaptionBubble({ seg, currentTime, color }) {
  const words = seg.text.split(/\s+/)
  const duration = seg.end - seg.start
  const progress = duration > 0 ? (currentTime - seg.start) / duration : 1
  const visibleCount = Math.max(1, Math.ceil(progress * words.length))

  const x = seg.position?.x ?? 0.5
  const y = seg.position?.y ?? 0.5

  // Flip bubble below the face when speaker is in the top quarter of the frame
  const flipBelow = y < 0.25

  // X-axis anchor: near left → don't translate left; near right → don't translate right
  let translateX = '-50%'
  if (x < 0.15) translateX = '-8px'
  else if (x > 0.85) translateX = 'calc(-100% + 8px)'

  // Triangle horizontal position mirrors the anchor offset
  let triangleLeft = '50%'
  if (x < 0.15) triangleLeft = '12px'
  else if (x > 0.85) triangleLeft = 'calc(100% - 20px)'

  return (
    <div
      style={{
        position: 'absolute',
        left: `${Math.max(0, Math.min(1, x)) * 100}%`,
        top: `${Math.max(0, Math.min(1, y)) * 100}%`,
        transform: `translate(${translateX}, ${flipBelow ? '10%' : '-110%'})`,
        maxWidth: 220,
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      {/* Bubble body */}
      <div
        style={{
          background: 'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(4px)',
          borderRadius: 8,
          borderTop: `2px solid ${color}`,
          padding: '6px 10px 8px',
        }}
      >
        <div
          style={{
            color,
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 4,
          }}
        >
          {seg.speaker}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#fff', lineHeight: 1.45 }}>
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

      {/* Triangle pointer toward speaker's face */}
      <div
        style={{
          position: 'absolute',
          [flipBelow ? 'top' : 'bottom']: -6,
          left: triangleLeft,
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          ...(flipBelow
            ? { borderBottom: '6px solid rgba(0,0,0,0.82)' }
            : { borderTop: '6px solid rgba(0,0,0,0.82)' }),
        }}
      />
    </div>
  )
}
