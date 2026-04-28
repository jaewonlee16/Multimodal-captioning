# On-Video Speaker Captions — Implementation Plan

## Goal

Display caption bubbles directly on the video frame, anchored next to each speaker, instead of in a separate panel below.

---

## 1 — Gemini JSON Schema Change

Add a `position` field to every segment: normalized (x, y) coordinates (0–1) of the speaker's approximate face/torso center in the frame.

```json
{
  "start": 3.0,
  "end": 4.2,
  "speaker": "left person",
  "text": "Welcome everyone.",
  "position": { "x": 0.18, "y": 0.35 }
}
```

`x = 0` is the left edge, `x = 1` is the right edge.  
`y = 0` is the top, `y = 1` is the bottom.

Schema diff:
```js
position: {
  type: 'OBJECT',
  properties: {
    x: { type: 'NUMBER', description: 'Horizontal center of speaker (0 = left, 1 = right)' },
    y: { type: 'NUMBER', description: 'Vertical center of speaker (0 = top, 1 = bottom)' },
  },
  required: ['x', 'y'],
}
```

---

## 2 — Gemini Prompt Change

Add one instruction to the existing rules:

> For each entry, also estimate the speaker's face/upper-body center as normalized (x, y) coordinates in the video frame (0.0–1.0 range). x=0 is left edge, x=1 is right edge; y=0 is top, y=1 is bottom.

Gemini already identifies speakers visually, so it can approximate their position in the same pass. No extra API call needed.

---

## 3 — UI Changes

### 3a — Video + Overlay Container

Wrap the `<video>` in a `position: relative` container. Add a `position: absolute; inset: 0` overlay div on top of it.

```
┌──────────────────────────────────────┐
│  video (position: relative)          │
│  ┌────────────────────────────────┐  │
│  │ overlay (position: absolute)   │  │
│  │                                │  │
│  │  [Alice bubble]                │  │
│  │                   [Bob bubble] │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 3b — Bubble Positioning

For each active segment, place a caption bubble using:

```js
// Convert normalized coords → CSS % on the overlay
left: `${position.x * 100}%`
top:  `${position.y * 100}%`
transform: 'translate(-50%, -110%)'   // center horizontally, sit above the face
```

The `translate(-50%, -110%)` puts the bubble centered above the speaker's head.

### 3c — Edge Clamping

Bubbles near the edges would overflow. Clamp with:
- `x < 0.25` → pin bubble to the left, flip anchor to left edge  
- `x > 0.75` → pin bubble to the right, flip anchor to right edge  
- `y < 0.2`  → flip to below the face instead of above

### 3d — Bubble Style

```
┌─────────────────────────┐
│ ALICE                   │  ← speaker name in their color
│ "Welcome everyone."     │  ← word-by-word reveal (existing logic)
└──────┬──────────────────┘
       ▼  (small triangle pointing down at face)
```

Dark semi-transparent background (`rgba(0,0,0,0.75)`) with a colored top border per speaker. Small CSS triangle (`::after` pseudo-element) pointing toward the face.

### 3e — Mode Toggle Update

Keep the existing toggle. Add a third option: **"On Video"** (the new mode).

```
[ Live Captions ]  [ On Video ]  [ Full Transcript ]       Re-analyze
```

**On Video** mode renders no caption panel below — captions appear only as overlays on the video.

---

## 4 — New / Changed Files

| File | Change |
|---|---|
| `src/api/gemini.js` | Add `position` to `TRANSCRIPT_SCHEMA`; update prompt |
| `src/components/VideoWithCaptions.jsx` | **New** — video element + absolute overlay with positioned bubbles |
| `src/components/CaptionBubble.jsx` | **New** — single bubble with edge clamping + word-by-word text |
| `src/App.jsx` | Wire `mode === 'onvideo'` to `VideoWithCaptions`; update `ModeToggle` |

`CaptionDisplay.jsx` and `Transcript.jsx` stay unchanged.

---

## 5 — Known Constraints

- **Gemini position is per-segment, not per-frame.** Speakers who move during a segment will have one fixed bubble location. This is acceptable for typical interview/conversation footage.
- **Video letterboxing.** If the `<video>` element letterboxes (black bars top/bottom or sides), the overlay div covers the full element including the bars — normalized coords from Gemini map to the actual picture, not the element box. This needs an adjustment using `videoWidth`/`videoHeight` vs displayed size via `getBoundingClientRect`.
- **Pointer events.** The overlay must have `pointer-events: none` so video controls remain clickable.
