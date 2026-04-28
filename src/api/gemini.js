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
      start:   { type: 'NUMBER',  description: 'Segment start time in seconds' },
      end:     { type: 'NUMBER',  description: 'Segment end time in seconds' },
      speaker: { type: 'STRING',  description: 'Speaker label (e.g. "left person", "Alice")' },
      text:    { type: 'STRING',  description: 'Verbatim spoken text for this segment' },
    },
    required: ['start', 'end', 'speaker', 'text'],
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
- If two people speak simultaneously, emit two separate entries with overlapping timestamps.
- Omit silent segments entirely.

Return the result as a JSON array matching the provided schema.`

/**
 * Send an already-uploaded Gemini file for speaker-attributed transcription.
 * Returns a parsed array of { start, end, speaker, text } segments.
 */
export async function analyzeVideo(fileUri, mimeType) {
  const model = 'gemini-3.1-pro-preview'

  const body = {
    contents: [
      {
        parts: [
          { fileData: { mimeType, fileUri } },
          { text: TRANSCRIPT_PROMPT },
        ],
      },
    ],
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

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
