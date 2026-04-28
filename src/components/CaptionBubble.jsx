export default function CaptionBubble({ seg, currentTime, color, facePreview = null }) {
  const words = seg.text.split(/\s+/)
  const duration = seg.end - seg.start
  const progress = duration > 0 ? (currentTime - seg.start) / duration : 1
  const visibleCount = Math.max(1, Math.ceil(progress * words.length))

  const x = seg.position?.x ?? 0.5
  const y = seg.position?.y ?? 0.5

  // Clamp face position so the bubble stays on-screen
  const clampedX = Math.max(0.15, Math.min(0.85, x))
  const flipBelow = y < 0.25

  // Offset bubble diagonally away from the face so it doesn't cover it.
  // translateX is relative to the bubble's own width (-50% = centered on face).
  // Left speakers  → bubble shifts left  → triangle on bubble's right  → points right-down at face
  // Right speakers → bubble shifts right → triangle on bubble's left   → points left-down at face
  // Center         → bubble centered     → triangle at bottom-center   → points straight down
  let translateX, triangleLeft
  if (x < 0.38) {
    translateX = '-72%'   // shift bubble left of face
    triangleLeft = '76%'  // triangle near right edge of bubble
  } else if (x > 0.62) {
    translateX = '-28%'   // shift bubble right of face
    triangleLeft = '24%'  // triangle near left edge of bubble
  } else {
    translateX = '-50%'   // centered above face
    triangleLeft = '50%'
  }

  // Generous vertical clearance so the bubble clears the head
  const translateY = flipBelow ? '20%' : '-140%'

  return (
    <div
      style={{
        position: 'absolute',
        left: `${clampedX * 100}%`,
        top: `${y * 100}%`,
        transform: `translate(${translateX}, ${translateY})`,
        maxWidth: 210,
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
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 4,
          }}
        >
          {facePreview && (
            <img
              src={facePreview}
              alt={seg.speaker}
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                objectFit: 'cover',
                border: `1px solid ${color}`,
                flexShrink: 0,
              }}
            />
          )}
          <span
            style={{
              color,
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            {seg.speaker}
          </span>
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
        {seg.originalText && (() => {
          const origWords = seg.originalText.split(/\s+/)
          return (
            <p style={{ margin: '4px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.38)', lineHeight: 1.4 }}>
              {origWords.map((word, i) => (
                <span
                  key={i}
                  style={{
                    opacity: i < visibleCount ? 1 : 0,
                    transition: i < visibleCount ? 'opacity 0.15s ease' : 'none',
                  }}
                >
                  {word}
                  {i < origWords.length - 1 ? ' ' : ''}
                </span>
              ))}
            </p>
          )
        })()}
      </div>

      {/* Triangle pointer aimed back at the speaker's face */}
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
