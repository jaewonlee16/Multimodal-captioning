# Speaker Captions

A browser-based app that uploads a video to the Gemini File API, uses **Gemini 3.1 Pro** to produce a speaker-attributed transcript, and displays synced captions in three modes — live bar, on-video overlays, and a full scrollable transcript. Supports face registration for named speaker identification and real-time caption translation.

## Features

- **Video upload** — drag-and-drop or file picker; resumable XHR upload with a progress bar. Accepted formats: MP4, WebM, MOV, MKV.
- **Speaker analysis** — Gemini watches the video and returns a structured JSON transcript: one sentence per entry, with start/end timestamps, speaker label, verbatim text, and the speaker's normalized (x, y) position in the frame.
- **Three caption modes** toggled from a tab bar:
  - **Live Captions** — a panel below the video reveals words one-by-one as they are spoken.
  - **On Video** — semi-transparent speech bubbles anchored near each speaker's face, with a triangle pointer aimed at them. Bubbles shift diagonally so they don't cover the face.
  - **Full Transcript** — a scrollable list of all segments; the active segment is highlighted and auto-scrolled into view.
- **Translation** — a translation bar lets you pick English or Korean and calls Gemini (text-only, no re-upload) to translate all captions. Translated text is shown large; the original text appears below it in a smaller, dimmer style. Switching language clears the previous translation.
- **Face registration** — before analyzing, optionally upload a photo for each known speaker and enter their name. Gemini receives the photos as inline images alongside the video and uses the exact registered name as the speaker label. The registered thumbnail appears in the on-video bubble next to the speaker's name.

## Tech Stack

| Layer | Choice |
|---|---|
| UI framework | React 18 + Vite 6 |
| API | Gemini 3.1 Pro Preview (`gemini-3.1-pro-preview`) |
| Structured output | `responseMimeType: application/json` + `responseSchema` |
| CORS bypass | Vite dev proxy `/gemini` → `generativelanguage.googleapis.com` |
| Styling | Inline styles (no CSS framework) |

## Project Structure

```
src/
  api/
    gemini.js           Gemini File API upload, polling, video analysis, translation
  components/
    VideoUploader.jsx   Drag-drop uploader with progress and status states
    VideoWithCaptions.jsx  Video player + absolute overlay for on-video bubbles
    CaptionBubble.jsx   Single positioned speech bubble with word-by-word reveal
    CaptionDisplay.jsx  Live caption bar below the video
    Transcript.jsx      Full scrollable transcript with active-segment highlight
    FaceRegistration.jsx  Face photo upload panel and speaker chip list
  utils/
    speakerColors.js    Assigns a consistent color to each speaker
  App.jsx               Main state machine and layout
```

## Setup

1. **Install dependencies**

```bash
npm install
```

2. **Add your Gemini API key**

Create `.env.local` in the project root:

```
VITE_GEMINI_KEY=your_api_key_here
```

Get a key at [Google AI Studio](https://aistudio.google.com/app/apikey).

3. **Start the dev server**

```bash
npm run dev
```

The Vite dev server runs on `http://localhost:5173` and proxies all `/gemini/*` requests to `generativelanguage.googleapis.com` to avoid CORS issues.

## How It Works

### Video upload
Upload uses the Gemini File API's two-step resumable upload protocol. First a `POST` initiates the session and returns an upload URL; then an XHR streams the raw bytes with progress tracking. After upload, the app polls the file status every 2 seconds until the state becomes `ACTIVE`.

### Speaker analysis
A single `generateContent` call sends the uploaded video file and a transcript prompt. Gemini returns a JSON array enforced by `responseSchema`:

```json
[
  {
    "start": 1.2,
    "end": 3.8,
    "speaker": "Speaker 1",
    "text": "Welcome everyone.",
    "position": { "x": 0.22, "y": 0.38 }
  }
]
```

### Face registration
When faces are registered, the request prepends alternating `inlineData` (base64 image) and `text` (name label) parts before the video, so Gemini establishes identities before watching the footage.

### On-video bubble placement
Each bubble is placed using the (x, y) position returned by Gemini. Left-of-center speakers shift the bubble left (triangle points right-toward-face); right-of-center speakers shift it right (triangle points left-toward-face). The video wrapper has 80 px vertical padding (overflow visible) so bubbles near the top or bottom of the frame are never clipped.

### Translation
The translation call sends only `[{ index, text }]` pairs — no video. Gemini returns translated `{ index, text }` pairs which are merged back into the full segment array. The original text is preserved as `originalText` on each segment so all three caption modes can display both languages simultaneously.
