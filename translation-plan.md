# Translation Mode — Implementation Plan

## Goal

After the speaker transcript is generated, let the user translate all captions into English or Korean with one click. Translation is done via a second Gemini call — **text-only**, no video re-upload needed.

---

## 1 — New Gemini API Function

Add `translateTranscript(segments, targetLanguage)` to `src/api/gemini.js`.

### Input
The existing array of transcript segments (only the `text` field of each is translated; `start`, `end`, `speaker`, and `position` are preserved verbatim).

### Model
`gemini-3.1-pro-preview` — text-only `generateContent`, no file attachment.

### Schema (response)

```js
const TRANSLATION_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      index: { type: 'NUMBER', description: 'Zero-based index of the original segment' },
      text:  { type: 'STRING', description: 'Translated text for this segment' },
    },
    required: ['index', 'text'],
  },
}
```

Returning only `index` + `text` keeps the payload small. The caller merges translated texts back into the full segment objects.

### Prompt

```
You are a professional subtitler. Translate each caption segment below into {LANGUAGE}.

Rules:
- Translate naturally and conversationally — match the register of the original.
- Keep the same number of segments; do not merge or split entries.
- Return a JSON array where each element has:
    "index": the zero-based position of the segment (integer)
    "text":  the translated text (string)
- Translate ONLY the "text" field. Do not alter speaker names, timestamps, or positions.
- If the text is already in {LANGUAGE}, return it unchanged.

Segments (JSON):
{SEGMENTS_JSON}
```

`{LANGUAGE}` = `"English"` or `"Korean"`. `{SEGMENTS_JSON}` is the JSON array of `{ index, text }` pairs extracted from the transcript.

---

## 2 — State Changes in App.jsx

| New state | Type | Purpose |
|---|---|---|
| `targetLang` | `'en' \| 'ko'` | Currently selected target language |
| `translatedTranscript` | `Array \| null` | Segments with translated `.text`; `null` = not yet translated |
| `translating` | `boolean` | Spinner while Gemini translates |
| `translateError` | `string` | Error message if translation fails |

Active transcript used for display:

```js
const displayTranscript = translatedTranscript ?? transcript
```

When `transcript` is cleared (Re-analyze), also clear `translatedTranscript`.

---

## 3 — UI Changes

### 3a — Language + Translate bar (appears below ModeToggle after transcript is ready)

```
┌──────────────────────────────────────────────────────────────┐
│  Translate to:  [ English ]  [ 한국어 ]       [ Translate ]  │
│                                    (spinner when translating) │
└──────────────────────────────────────────────────────────────┘
```

- Two language buttons act as a radio group (one active at a time).
- "Translate" button triggers the API call.
- If a translation already exists and the user changes language, clicking Translate replaces it.
- A small badge on the active mode toggle reads **(translated)** when `translatedTranscript` is set.

### 3b — Display integration

All three existing modes (Live Captions, On Video, Full Transcript) pass `displayTranscript` instead of `transcript`. No structural changes to `CaptionDisplay`, `CaptionBubble`, or `Transcript`.

---

## 4 — Files Changed

| File | Change |
|---|---|
| `src/api/gemini.js` | Add `translateTranscript(segments, targetLanguage)` |
| `src/App.jsx` | Add `targetLang`, `translatedTranscript`, `translating`, `translateError` state; `TranslationBar` component; pass `displayTranscript` everywhere |

`CaptionDisplay.jsx`, `Transcript.jsx`, `VideoWithCaptions.jsx`, `CaptionBubble.jsx` — **unchanged**.

---

## 5 — Example Flow

1. User uploads video → Gemini produces transcript in original language (e.g. Korean).
2. User selects **English** → clicks **Translate**.
3. App sends `[{ index: 0, text: "안녕하세요." }, ...]` to Gemini with prompt asking for English.
4. Gemini returns `[{ index: 0, text: "Hello." }, ...]`.
5. App merges: `translatedTranscript = transcript.map((seg, i) => ({ ...seg, text: translated[i].text }))`.
6. All three caption modes now show English text.
7. User clicks **한국어** → **Translate** → re-runs with Korean target.

---

## 6 — Known Constraints

- **Rate limits**: The translation call sends all segment texts in a single request — typically < 2 000 tokens for a 10-minute video. Well within Gemini's context window.
- **Translation quality**: Gemini may paraphrase slightly. For an exact word-by-word match, a dedicated translation API would be more reliable, but Gemini is sufficient for demo purposes.
- **Original language detection**: Not explicitly needed — Gemini handles it automatically. If the source and target are the same, segments are returned unchanged per the prompt rules.
