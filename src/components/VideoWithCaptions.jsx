import CaptionBubble from './CaptionBubble'
import { colorForSpeaker } from '../utils/speakerColors'

export default function VideoWithCaptions({
  src,
  videoRef,
  onTimeUpdate,
  segments,
  currentTime,
  colorMap,
  showOverlay,
}) {
  const active =
    showOverlay && segments
      ? segments.filter(
          (seg) => currentTime >= seg.start && currentTime <= seg.end
        )
      : []

  return (
    <div style={styles.wrapper}>
      <video
        ref={videoRef}
        src={src}
        controls
        style={styles.video}
        onTimeUpdate={onTimeUpdate}
      />

      {showOverlay && (
        <div style={styles.overlay}>
          {active.map((seg) => (
            <CaptionBubble
              key={`${seg.start}-${seg.speaker}`}
              seg={seg}
              currentTime={currentTime}
              color={colorForSpeaker(colorMap, seg.speaker)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  wrapper: {
    position: 'relative',
    width: '100%',
    maxWidth: 640,
    borderRadius: 12,
    overflow: 'hidden',
    background: '#000',
  },
  video: {
    display: 'block',
    width: '100%',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  },
}
