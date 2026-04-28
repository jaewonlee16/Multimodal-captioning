import CaptionBubble from './CaptionBubble'
import { colorForSpeaker } from '../utils/speakerColors'

// Padding around the video that gives caption bubbles room to overflow
// without being clipped. Vertical is generous because translated bubbles
// are taller (they show both translated + original text).
const PAD_V = 80
const PAD_H = 24

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
    // Outer: overflow visible so bubbles can spill into the padding zone
    <div style={styles.outer}>
      {/* Inner: applies the visual video styling (border-radius, black bg) */}
      <div style={styles.videoWrap}>
        <video
          ref={videoRef}
          src={src}
          controls
          style={styles.video}
          onTimeUpdate={onTimeUpdate}
        />
      </div>

      {/* Overlay inset matches videoWrap exactly so (x,y) coords still map to the video */}
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
  outer: {
    position: 'relative',
    width: '100%',
    maxWidth: 640,
    paddingTop: PAD_V,
    paddingBottom: PAD_V,
    paddingLeft: PAD_H,
    paddingRight: PAD_H,
    // overflow is visible by default — bubbles can extend into the padding
  },
  videoWrap: {
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
    top: PAD_V,
    bottom: PAD_V,
    left: PAD_H,
    right: PAD_H,
    pointerEvents: 'none',
  },
}
