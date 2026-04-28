# Face Registration — Implementation Plan

## Goal

Let users upload photos of known speakers and assign them names **before** video analysis. Gemini receives both the video and the face photos in a single `generateContent` call, so it can attribute speech to real names ("Alice") instead of positions ("left person").

---

## 1 — How Gemini Sees the Images

Gemini's multimodal API accepts images as **inline base64 data** via `inlineData` parts — no separate File API upload needed for small face photos.

The `generateContent` request body becomes:

```json
{
  "contents": [{
    "parts": [
      { "inlineData": { "mimeType": "image/jpeg", "data": "<base64>" } },
      { "text": "The person in the image above is Alice Johnson." },
      { "inlineData": { "mimeType": "image/jpeg", "data": "<base64>" } },
      { "text": "The person in the image above is Bob Smith." },
      { "fileData": { "mimeType": "video/mp4", "fileUri": "..." } },
      { "text": "<TRANSCRIPT_PROMPT>" }
    ]
  }]
}
```

Face image + name label pairs come **before** the video, so Gemini establishes the identities before watching the footage.

---

## 2 — Prompt Change

Prepend a preamble to `TRANSCRIPT_PROMPT` when registered faces are present:

```
The following speakers have been pre-identified. When you see one of them in the video,
use their exact name as the "speaker" value — do not use a positional label like
"left person" for them.

[image] → Alice Johnson
[image] → Bob Smith

If a person in the video does not match any registered face, fall back to a positional
label ("left person", "right person", "center person").
```

The `[image]` placeholders correspond to the `inlineData` parts immediately preceding each label line. The rest of `TRANSCRIPT_PROMPT` (rules for timestamps, one sentence per entry, etc.) remains unchanged.

---

## 3 — Data Flow

### 3a — Registered face object

```js
{
  name: 'Alice Johnson',   // user-entered
  dataUrl: 'data:image/jpeg;base64,...',  // from FileReader
  mimeType: 'image/jpeg',  // extracted from dataUrl
  base64: '...',           // raw base64 (stripped of data: prefix)
}
```

### 3b — State in App.jsx

```js
const [registeredFaces, setRegisteredFaces] = useState([])   // array of face objects
```

### 3c — analyzeVideo signature change

```js
analyzeVideo(fileUri, mimeType, registeredFaces = [])
```

When `registeredFaces` is non-empty, build alternating `inlineData` + `text` parts before the video `fileData` part.

---

## 4 — UI

### 4a — FaceRegistration panel

Shown **after** video upload, **before** (and alongside) the "Analyze speakers" button.

```
┌────────────────────────────────────────────────────────────┐
│  Known Speakers  (optional)                    [+ Add]     │
│                                                            │
│  [ 👤 Alice Johnson  ✕ ]  [ 👤 Bob Smith  ✕ ]             │
└────────────────────────────────────────────────────────────┘
```

Clicking **+ Add** opens an inline mini-form:

```
┌─────────────────────────────────┐
│  Name:  [________________]      │
│  Photo: [  Choose file  ]       │
│         (preview thumbnail)     │
│  [Cancel]            [Add]      │
└─────────────────────────────────┘
```

- Accepts JPEG, PNG, WebP
- Shows a 48×48 circular thumbnail preview after selection
- Name is required; photo is required
- Any number of speakers can be registered (0 = optional, analysis still works)

### 4b — Registered speaker chips

Each registered speaker appears as a small chip showing their thumbnail + name + an ✕ remove button.

### 4c — Analyze button behavior

"Analyze speakers" passes `registeredFaces` to `handleAnalyze`. No other UI change needed.

---

## 5 — Files Changed

| File | Change |
|---|---|
| `src/components/FaceRegistration.jsx` | **New** — panel + add form + chips |
| `src/api/gemini.js` | Update `analyzeVideo()` to accept `registeredFaces`; build `inlineData` parts + preamble |
| `src/App.jsx` | Add `registeredFaces` state; render `<FaceRegistration>`; pass to `handleAnalyze` |

`CaptionDisplay.jsx`, `CaptionBubble.jsx`, `Transcript.jsx`, `VideoWithCaptions.jsx` — **unchanged**.

---

## 6 — Known Constraints

- **Base64 payload size**: A typical face photo at 800×600 JPEG ≈ 80–200 KB base64. For 5 registered speakers that's ~1 MB added to the request body — well within limits.
- **Recognition accuracy**: Gemini is a language + vision model, not a dedicated face recognition system. Clear, well-lit, front-facing photos will work best. Profile shots or low-resolution photos may not match reliably.
- **Multiple photos per person**: Not in scope for now. One photo per registered speaker.
- **Re-analyze**: Registered faces persist in state across Re-analyze clicks (only cleared on "Upload another video").
