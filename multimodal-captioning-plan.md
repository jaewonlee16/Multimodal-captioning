# 🎥 Multimodal Speaker Captioning — Hackathon Demo Plan

## Concept

A web app that takes a **recorded video** with multiple speakers and produces **real-time, speaker-attributed captions** by combining:
- **Gemini 1.5 Flash** → identifies who is speaking from video frames (default vision API)
- **Web Speech API** → converts speech to text (default audio API)
- **Timeline alignment** → syncs speaker identity with transcript
- **Swappable API config** → switch vision/audio providers anytime via a config panel without changing code

Inspired by smart glasses that could caption your world in real time.

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│              Uploaded Video File             │
└────────────────────┬────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
  ┌───────────────┐    ┌─────────────────┐
  │  Frame        │    │  Audio          │
  │  Extractor    │    │  Extractor      │
  │  (Canvas API) │    │  (Web Audio API)│
  └───────┬───────┘    └────────┬────────┘
          │                     │
          ▼                     ▼
  ┌───────────────┐    ┌─────────────────┐
  │  Claude       │    │  Web Speech API │
  │  Vision API   │    │  (or Whisper)   │
  │               │    │                 │
  │ "Person on    │    │ "Hello everyone,│
  │  left speaking│    │  welcome to..." │
  │  at 00:03"    │    │  at 00:03       │
  └───────┬───────┘    └────────┬────────┘
          │                     │
          └──────────┬──────────┘
                     │
                     ▼
          ┌─────────────────────┐
          │   Timeline Merger   │
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
| Frame extraction | HTML5 Canvas API | Browser-native, no install |
| Audio transcription | **Web Speech API** *(default)* | Free, browser-native, no key needed |
| Vision AI | **Gemini 1.5 Flash** *(default)* | Generous free tier, fast, multimodal |
| API switching | Adapter pattern + config panel | Swap APIs without changing core logic |
| State management | React `useState` / `useRef` | Simple, no Redux needed |

### Supported APIs (swappable via config)

| Layer | Options |
|---|---|
| Vision | Gemini 1.5 Flash, Claude Vision, GPT-4o Vision |
| Audio | Web Speech API, AssemblyAI, Deepgram |

---

## Phase 1 — Video Ingestion & Frame Extraction

**Goal:** Load a video and extract frames at regular intervals.

**Steps:**
1. User uploads a `.mp4` / `.webm` video via file input
2. Video is loaded into a hidden `<video>` element
3. A `<canvas>` element captures frames every **1 second**
4. Each frame is converted to `base64` JPEG (compressed for API efficiency)
5. Frames are stored in an array: `[{ timestamp: 3.0, imageBase64: "..." }, ...]`

**Key consideration:** Compress frames to ~512×288px before sending to Claude to minimize token usage and latency.

---

## Phase 2 — Audio Transcription (Swappable)

**Goal:** Extract a timestamped transcript from the video's audio.

**Adapter pattern — each audio provider implements the same interface:**
```js
// All audio adapters implement this signature:
async function transcribe(audioSource, config, onResult) => {
  // calls onResult({ text, timestamp }) as results arrive
}

// Adapters:
// audioAdapters.webspeech(source, config, cb)   ← DEFAULT
// audioAdapters.assemblyai(source, config, cb)
// audioAdapters.deepgram(source, config, cb)
```

**Default: Web Speech API**
- Play video through the browser
- Pipe audio to `SpeechRecognition`
- Capture interim + final results with timestamps
- Free, no API key, English-optimized

**Option B — AssemblyAI:**
- Stream audio to AssemblyAI real-time endpoint
- Returns word-level timestamps + speaker diarization built-in
- Requires API key, free trial credits available

**Option C — Deepgram:**
- Similar to AssemblyAI, very low latency
- Speaker labels available on paid tier

---

## Phase 3 — Vision Speaker Identification (Swappable)

**Goal:** For each frame, identify who is speaking using a pluggable vision adapter.

**Adapter pattern — each vision provider implements the same interface:**
```js
// All vision adapters implement this signature:
async function identifySpeaker(base64Frame, config) => {
  return {
    speakers: ["left person"],   // who is speaking
    speakerCount: 2,             // total visible
    confidence: "high"           // high | medium | low
  }
}

// Adapters:
// visionAdapters.gemini(frame, config)   ← DEFAULT
// visionAdapters.claude(frame, config)
// visionAdapters.gpt4o(frame, config)
```

**Prompt sent to vision model (same across all adapters):**
```
You are analyzing a video frame for a captioning system.
Look at the people in this image and identify who appears to be speaking
(open mouth, animated face, gesturing while talking).

Respond ONLY with JSON:
{
  "speakers": ["left person", "right person"],  // who is speaking now
  "speakerCount": 2,                            // total people visible
  "confidence": "high"                          // high / medium / low
}

If you can identify people by name (name tags etc.), use their names.
Otherwise use: "left person", "right person", "center person".
```

**Default: Gemini 1.5 Flash**
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash`
- Free tier: generous daily quota, no billing required for hackathon scale
- Accepts base64 image inline in the request body

**Optimization for speed:**
- Sample a frame every **2 seconds** (configurable)
- Cache speaker identity between frames (same face = same label)
- Compress frames to ~512×288px before sending

---

## Phase 4 — Timeline Alignment

**Goal:** Merge transcript + speaker identity into a unified caption track.

**Algorithm:**
```
for each transcript_segment (text, start_time, end_time):
    find frame closest to start_time
    speaker = frame.identifiedSpeaker
    
    captions.push({
        time: start_time,
        speaker: speaker,
        text: transcript_segment.text,
        color: speakerColorMap[speaker]
    })
```

**Handling simultaneous speech:**
- If Claude identifies **2+ speakers** in a frame during speech → split caption into two rows
- Label both: `Alice: [transcript A]` and `Bob: [transcript B]`
- Use overlap detection: if two transcript segments overlap in time, flag as simultaneous

---

## Phase 5 — Caption Display UI

**Goal:** Show captions in real time as video plays.

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
│  🟦 Alice  "Welcome everyone, I'm   │
│             glad you could join..."  │
│                                     │
│  🟧 Bob    "Thanks for having us"   │
│                                     │
└─────────────────────────────────────┘
```

**Caption modes (toggle):**
- **Live mode** — captions appear as video plays, synced to timestamp
- **Full transcript** — scrollable log of everything said, speaker-colored

---

## Demo Flow (Hackathon Presentation)

1. **Upload video** — drag & drop a pre-recorded conversation (2–3 people)
2. **Processing screen** — show progress bar as frames are analyzed
3. **Playback** — video plays with live captions appearing below
4. **Reveal transcript** — show full speaker-attributed transcript
5. **The pitch** — *"Imagine this running on your glasses in real time"*

---

## Handling Edge Cases

| Scenario | Handling |
|---|---|
| Person looks away / mouth not visible | Carry forward last known speaker |
| Simultaneous speech | Show two caption rows simultaneously |
| No face detected | Label as "Unknown Speaker" |
| Low confidence from vision API | Show caption without speaker label |
| Silence | No caption displayed |

---

## Limitations to Acknowledge (Judges love honesty)

- **Web Speech API** doesn't give perfect timestamps — slight sync drift possible
- **True speaker diarization** from audio alone is not implemented (vision-based only)
- **Real-time on glasses** would need edge inference (e.g., local Whisper + compact vision model)
- Works best with **front-facing, well-lit** video for mouth detection

---

## Future / "What's Next" Slide

- Replace Web Speech API with **Whisper** for multilingual support
- Add **face registration** — upload photos of speakers for named identification
- Run on **edge hardware** (e.g., Raspberry Pi + glasses cam) for true real-time
- **Translation mode** — caption in a different language than spoken
- **Emotion detection** — add tone indicators (😄 excited, 😟 concerned)

---

## File Structure

```
multimodal-captions/
├── App.jsx                    # Main React component + config panel
├── components/
│   ├── VideoUploader.jsx      # Drag & drop upload
│   ├── FrameExtractor.jsx     # Canvas-based frame capture
│   ├── CaptionDisplay.jsx     # Live caption UI
│   ├── Transcript.jsx         # Full transcript view
│   └── ConfigPanel.jsx        # API switcher UI
├── adapters/
│   ├── vision/
│   │   ├── index.js           # Adapter router
│   │   ├── gemini.js          # Gemini 1.5 Flash (DEFAULT)
│   │   ├── claude.js          # Claude Vision
│   │   └── gpt4o.js           # GPT-4o Vision
│   └── audio/
│       ├── index.js           # Adapter router
│       ├── webspeech.js       # Web Speech API (DEFAULT)
│       ├── assemblyai.js      # AssemblyAI
│       └── deepgram.js        # Deepgram
└── utils/
    ├── frameExtract.js        # Canvas frame sampling
    └── timelineAlign.js       # Merge frames + transcript
```

---

## Timeline Estimate

| Task | Time |
|---|---|
| Video upload + frame extraction | 1 hour |
| Web Speech API integration | 1 hour |
| Gemini Vision API integration | 1.5 hours |
| Adapter pattern + config panel UI | 1 hour |
| Timeline alignment logic | 1.5 hours |
| UI / caption display | 2 hours |
| Testing + polish | 1 hour |
| **Total** | **~9 hours** |

