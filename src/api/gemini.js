const API_KEY = import.meta.env.VITE_GEMINI_KEY

// All requests go through Vite's /gemini proxy → generativelanguage.googleapis.com
// to avoid CORS issues with the custom X-Goog-Upload-* headers.
const PROXY_BASE = '/gemini'
const GOOGLE_BASE = 'https://generativelanguage.googleapis.com'

/**
 * Upload a video file to Gemini File API.
 * Calls onProgress(0–1) during the XHR upload so the UI can show a progress bar.
 * Returns the file object: { name, uri, mimeType, state, ... }
 */
export async function uploadVideoToGemini(file, onProgress) {
  // Step 1: initiate resumable upload and get the upload URL
  const initRes = await fetch(
    `${PROXY_BASE}/upload/v1beta/files?uploadType=resumable&key=${API_KEY}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': file.size,
        'X-Goog-Upload-Header-Content-Type': file.type,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: file.name } }),
    }
  )

  if (!initRes.ok) {
    const text = await initRes.text()
    throw new Error(`File API init failed (${initRes.status}): ${text}`)
  }

  const rawUploadUrl = initRes.headers.get('X-Goog-Upload-URL')
  if (!rawUploadUrl) throw new Error('No upload URL returned by File API')
  // Rewrite the absolute Google URL to go through the same proxy
  const uploadUrl = rawUploadUrl.replace(GOOGLE_BASE, PROXY_BASE)

  // Step 2: stream the file bytes via XHR so we can track progress
  const fileUri = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', uploadUrl)
    xhr.setRequestHeader('X-Goog-Upload-Command', 'upload, finalize')
    xhr.setRequestHeader('X-Goog-Upload-Offset', '0')
    xhr.setRequestHeader('Content-Type', file.type)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded / e.total)
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          resolve(data.file)
        } catch {
          reject(new Error('Invalid JSON from File API upload'))
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
    xhr.send(file)
  })

  return fileUri
}

/**
 * Poll the File API until the file state is ACTIVE (processing done).
 * Resolves with the final file object.
 */
export async function waitForFileActive(fileName, onStatus) {
  const maxAttempts = 30
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${PROXY_BASE}/v1beta/${fileName}?key=${API_KEY}`
    )
    if (!res.ok) throw new Error(`File status check failed (${res.status})`)
    const data = await res.json()
    const state = data.state ?? data.file?.state

    if (onStatus) onStatus(state)

    if (state === 'ACTIVE') return data
    if (state === 'FAILED') throw new Error('Gemini file processing failed')

    await delay(2000)
  }
  throw new Error('Timed out waiting for file to become ACTIVE')
}

const TRANSCRIPT_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      start:   { type: 'NUMBER', description: 'Segment start time in seconds' },
      end:     { type: 'NUMBER', description: 'Segment end time in seconds' },
      speaker: { type: 'STRING', description: 'Speaker label (e.g. "left person", "Alice")' },
      text:    { type: 'STRING', description: 'Verbatim spoken text for this segment' },
      position: {
        type: 'OBJECT',
        description: 'Approximate center of the speaker\'s face/upper-body in the frame',
        properties: {
          x: { type: 'NUMBER', description: 'Horizontal position: 0.0 = left edge, 1.0 = right edge' },
          y: { type: 'NUMBER', description: 'Vertical position: 0.0 = top edge, 1.0 = bottom edge' },
        },
        required: ['x', 'y'],
      },
    },
    required: ['start', 'end', 'speaker', 'text', 'position'],
  },
}

const TRANSCRIPT_PROMPT = `\
Watch this video carefully and produce a speaker-attributed transcript.

Rules:
- Each entry must contain exactly ONE sentence. Split at natural sentence boundaries (period, \
question mark, exclamation mark). Never put two sentences in a single entry.
- Identify who is speaking by their screen position ("left person", "right person", "center person") \
or by name if visible (name tag, on-screen text, or self-introduction).
- Record the start and end time in seconds (decimals allowed) for that single sentence.
- Transcribe the spoken text verbatim.
- Estimate the speaker's face/upper-body center as normalized (x, y) coordinates: \
x=0.0 is the left edge, x=1.0 is the right edge; y=0.0 is the top edge, y=1.0 is the bottom edge.
- If two people speak simultaneously, emit two separate entries with overlapping timestamps.
- Omit silent segments entirely.

Return the result as a JSON array matching the provided schema.`

/**
 * Send an already-uploaded Gemini file for speaker-attributed transcription.
 * registeredFaces: optional array of { name, mimeType, base64 } for named identification.
 * Returns a parsed array of { start, end, speaker, text, position } segments.
 */
export async function analyzeVideo(fileUri, mimeType, registeredFaces = []) {
  const model = 'gemini-3.1-pro-preview'

  const parts = []

  // Prepend face identity pairs so Gemini learns names before watching the video
  if (registeredFaces.length > 0) {
    const preamble =
      'The following speakers have been pre-identified. When you see one of them in the video, ' +
      'use their exact name as the "speaker" value — do not use a positional label like ' +
      '"left person" for them. If a person in the video does not match any registered face, ' +
      'fall back to a positional label ("left person", "right person", "center person").'
    parts.push({ text: preamble })

    for (const face of registeredFaces) {
      parts.push({ inlineData: { mimeType: face.mimeType, data: face.base64 } })
      parts.push({ text: `The person in the image above is ${face.name}.` })
    }
  }

  parts.push({ fileData: { mimeType, fileUri } })
  parts.push({ text: TRANSCRIPT_PROMPT })

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: TRANSCRIPT_SCHEMA,
    },
  }

  const res = await fetch(
    `${PROXY_BASE}/v1beta/models/${model}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini analysis failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!raw) throw new Error('Empty response from Gemini')

  return JSON.parse(raw)
}

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

/**
 * Translate transcript segment texts into the target language.
 * Sends only the text content (no video) and merges results back into full segments.
 * Returns a new array of segments with translated .text fields.
 */
export async function translateTranscript(segments, targetLanguage) {
  const model = 'gemini-3.1-pro-preview'

  const inputSegments = segments.map((seg, i) => ({ index: i, text: seg.text }))

  const prompt = `You are a professional subtitler. Translate each caption segment below into ${targetLanguage}.

Rules:
- Translate naturally and conversationally — match the register of the original.
- Keep the same number of segments; do not merge or split entries.
- Return a JSON array where each element has:
    "index": the zero-based position of the segment (integer)
    "text":  the translated text (string)
- Translate ONLY the "text" field. Do not alter speaker names, timestamps, or positions.
- If the text is already in ${targetLanguage}, return it unchanged.

Segments (JSON):
${JSON.stringify(inputSegments)}`

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: TRANSLATION_SCHEMA,
    },
  }

  const res = await fetch(
    `${PROXY_BASE}/v1beta/models/${model}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini translation failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!raw) throw new Error('Empty response from Gemini translation')

  const translated = JSON.parse(raw)

  return segments.map((seg, i) => {
    const match = translated.find((t) => t.index === i)
    return { ...seg, originalText: seg.text, text: match ? match.text : seg.text }
  })
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
