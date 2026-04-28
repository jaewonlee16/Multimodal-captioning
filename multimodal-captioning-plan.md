# Multimodal Speaker Captioning — Hackathon Demo Plan

## Concept

A web app that takes a **recorded video** with multiple speakers and produces **speaker-attributed captions** by sending the video directly to **Gemini 2.0 Flash** (multimodal video input). The model handles speaker identification, transcription, and timestamp alignment in a single API call.

Inspired by smart glasses that could caption your world in real time.

---

## Architecture Overview

```
┌─────────────────────────────────────┐
│          Uploaded Video File         │
└──────────────────┬──────────────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │  Gemini File API    │
        │  (video upload)     │
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │  Gemini 2.0 Flash   │
        │  (video analysis)   │
        │                     │
        │  sees frames +      │
        │  hears audio        │
        │  simultaneously     │
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │  JSON Transcript    │
        │                     │
        │  00:03 → Alice: ... │
        │  00:07 → Bob: ...   │
        │  00:12 → Both: ...  │
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │   Caption Display   │
        │   (React UI)        │
        └─────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React (single JSX artifact) | Fast to build, easy to demo |
| Video analysis | **Gemini 2.0 Flash** (video input) | Handles audio + vision in one call, cheap, fast |
| File upload | Gemini File API | Supports large videos up to ~1 hour |
| State management | React `useState` / `useRef` | Simple, no Redux needed |

---

## Phase 1 — Video Upload

**Goal:** Upload the video to Gemini's File API and get a file URI back.

**Steps:**
1. User uploads a `.mp4` / `.webm` video via file input
2. Frontend sends the file to Gemini File API (`POST https://generativelanguage.googleapis.com/upload/v1beta/files`)
3. API returns a `file.uri` used in the next step
4. Show upload progress to the user

**Key consideration:** Files uploaded via the File API are available for 48 hours. For videos under ~20MB, inline base64 also works and skips the upload step.

---

## Phase 2 — Video Analysis (Single API Call)

**Goal:** Send the uploaded video to Gemini and get a full speaker-attributed, timestamped transcript.

**Prompt sent to Gemini:**
```
Watch this video and return a speaker-attributed transcript.

For each speech segment, identify who is speaking by their position
(e.g. "left person", "right person", "center person") or by name
if visible (name tags, introductions, etc.).

Respond ONLY with a JSON array:
[
  {
    "start": 3.0,
    "end": 6.5,
    "speaker": "left person",
    "text": "Welcome everyone, I'm glad you could join us."
  },
  ...
]

If two people speak simultaneously, include both as separate entries
with overlapping timestamps.
```

**Why this works:**
- Gemini correlates lip movement, voice, and visual identity simultaneously
- No separate frame extraction or audio pipeline needed
- No timeline alignment step — the model handles it natively

---

## Phase 3 — Caption Display UI

**Goal:** Show captions synced to video playback using the pre-computed transcript.

**UI Layout:**
```
┌─────────────────────────────────────┐
│                                     │
│         [ Video Player ]            │
│                                     │
├─────────────────────────────────────┤
│  Processing: ████████░░ 80%         │
├─────────────────────────────────────┤
│                                     │
│  Alice  "Welcome everyone, I'm      │
│          glad you could join..."    │
│                                     │
│  Bob    "Thanks for having us"      │
│                                     │
└─────────────────────────────────────┘
```

**Caption modes (toggle):**
- **Live mode** — captions appear as video plays, synced to timestamp
- **Full transcript** — scrollable log of everything said, speaker-colored

**Sync logic:**
```js
// On each video timeupdate event:
const active = transcript.filter(
  seg => currentTime >= seg.start && currentTime <= seg.end
)
setActiveCaptions(active)
```

---

## Demo Flow (Hackathon Presentation)

1. **Upload video** — drag & drop a pre-recorded conversation (2–3 people)
2. **Processing screen** — show progress bar while Gemini analyzes the video
3. **Playback** — video plays with live captions appearing below, synced to speech
4. **Reveal transcript** — show full speaker-attributed transcript
5. **The pitch** — *"Imagine this running on your glasses in real time"*

---

## Handling Edge Cases

| Scenario | Handling |
|---|---|
| Person looks away / mouth not visible | Gemini uses voice + context to maintain speaker label |
| Simultaneous speech | Two caption rows with overlapping timestamps |
| No face detected | Label as "Unknown Speaker" |
| Low confidence | Gemini may label as "unidentified speaker" |
| Silence | No caption displayed |

---

## Limitations to Acknowledge (Judges love honesty)

- **Batch, not streaming** — full video must upload before captions appear (pre-processed, then played back with synced captions)
- **File size** — Gemini File API supports large files but upload time adds latency
- **Real-time on glasses** would need edge inference (e.g., local Whisper + compact vision model)
- Works best with **front-facing, well-lit** video for reliable speaker identification

---

## Future / "What's Next" Slide

- Replace batch processing with **live streaming** to a local vision model for true real-time
- Add **face registration** — upload photos of speakers for named identification
- Run on **edge hardware** (e.g., Raspberry Pi + glasses cam) for true real-time
- **Translation mode** — caption in a different language than spoken
- **Emotion detection** — add tone indicators (excited, concerned)

---

## File Structure

```
multimodal-captions/
├── App.jsx                    # Main React component
├── components/
│   ├── VideoUploader.jsx      # Drag & drop upload + Gemini File API
│   ├── CaptionDisplay.jsx     # Live caption UI synced to video
│   └── Transcript.jsx         # Full transcript view
├── api/
│   └── gemini.js              # Gemini File API upload + video analysis
└── utils/
    └── captionSync.js         # Match transcript segments to video timestamp
```

---

## Timeline Estimate

| Task | Time |
|---|---|
| Video upload + Gemini File API integration | 1.5 hours |
| Gemini video analysis + prompt tuning | 1.5 hours |
| Caption display + video sync logic | 2 hours |
| UI / transcript view + speaker colors | 1.5 hours |
| Testing + polish | 1 hour |
| **Total** | **~7.5 hours** |
