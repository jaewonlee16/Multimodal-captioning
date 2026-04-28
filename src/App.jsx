import { useState, useRef, useMemo } from 'react'
import VideoUploader from './components/VideoUploader'
import VideoWithCaptions from './components/VideoWithCaptions'
import CaptionDisplay from './components/CaptionDisplay'
import Transcript from './components/Transcript'
import { analyzeVideo, translateTranscript } from './api/gemini'
import { buildColorMap } from './utils/speakerColors'

export default function App() {
  const [uploadResult, setUploadResult] = useState(null)
  const [transcript, setTranscript] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [mode, setMode] = useState('live') // 'live' | 'onvideo' | 'transcript'
  const [targetLang, setTargetLang] = useState('English')
  const [translatedTranscript, setTranslatedTranscript] = useState(null)
  const [translating, setTranslating] = useState(false)
  const [translateError, setTranslateError] = useState('')
  const videoRef = useRef()

  const colorMap = useMemo(
    () => (transcript ? buildColorMap(transcript) : new Map()),
    [transcript]
  )

  const displayTranscript = translatedTranscript ?? transcript

  async function handleAnalyze() {
    setAnalyzing(true)
    setAnalyzeError('')
    try {
      const segments = await analyzeVideo(
        uploadResult.geminiFile.uri,
        uploadResult.geminiFile.mimeType,
      )
      setTranscript(segments)
      setTranslatedTranscript(null)
      setMode('live')
    } catch (err) {
      console.error(err)
      setAnalyzeError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleTranslate() {
    setTranslating(true)
    setTranslateError('')
    try {
      const translated = await translateTranscript(transcript, targetLang)
      setTranslatedTranscript(translated)
    } catch (err) {
      console.error(err)
      setTranslateError(err.message)
    } finally {
      setTranslating(false)
    }
  }

  function handleReset() {
    setUploadResult(null)
    setTranscript(null)
    setAnalyzeError('')
    setAnalyzing(false)
    setCurrentTime(0)
    setMode('live')
    setTranslatedTranscript(null)
    setTranslateError('')
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.title}>Speaker Captions</h1>
        <p style={styles.subtitle}>Upload a video · Gemini identifies who said what</p>
      </header>

      {!uploadResult ? (
        <VideoUploader onUploadComplete={setUploadResult} />
      ) : (
        <div style={styles.main}>
          <VideoWithCaptions
            src={uploadResult.localUrl}
            videoRef={videoRef}
            onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
            segments={displayTranscript}
            currentTime={currentTime}
            colorMap={colorMap}
            showOverlay={mode === 'onvideo' && !!displayTranscript}
          />

          {!transcript && !analyzing && (
            <div style={styles.analyzeRow}>
              <button style={styles.analyzeBtn} onClick={handleAnalyze}>
                Analyze speakers
              </button>
              {analyzeError && <p style={styles.errorText}>{analyzeError}</p>}
            </div>
          )}

          {analyzing && (
            <div style={styles.analyzingRow}>
              <div style={styles.spinner} />
              <span style={styles.analyzingText}>
                Gemini is watching the video and identifying speakers…
              </span>
            </div>
          )}

          {transcript && (
            <>
              <ModeToggle mode={mode} onChange={setMode} onReanalyze={() => { setTranscript(null); setTranslatedTranscript(null); setAnalyzeError('') }} />

              <TranslationBar
                targetLang={targetLang}
                onLangChange={(lang) => { setTargetLang(lang); setTranslatedTranscript(null) }}
                onTranslate={handleTranslate}
                translating={translating}
                translated={!!translatedTranscript}
                error={translateError}
              />

              {mode === 'live' && (
                <CaptionDisplay
                  segments={displayTranscript}
                  currentTime={currentTime}
                  colorMap={colorMap}
                />
              )}
              {mode === 'transcript' && (
                <Transcript
                  segments={displayTranscript}
                  currentTime={currentTime}
                  colorMap={colorMap}
                />
              )}
            </>
          )}

          <button style={styles.resetBtn} onClick={handleReset}>
            Upload another video
          </button>
        </div>
      )}
    </div>
  )
}

function ModeToggle({ mode, onChange, onReanalyze }) {
  return (
    <div style={styles.toggleRow}>
      <div style={styles.toggle}>
        {[
          { key: 'live',       label: 'Live Captions' },
          { key: 'onvideo',    label: 'On Video' },
          { key: 'transcript', label: 'Full Transcript' },
        ].map(({ key, label }) => (
          <button
            key={key}
            style={{ ...styles.tab, ...(mode === key ? styles.tabActive : {}) }}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <button style={styles.reanalyzeBtn} onClick={onReanalyze}>
        Re-analyze
      </button>
    </div>
  )
}

function TranslationBar({ targetLang, onLangChange, onTranslate, translating, translated, error }) {
  const langs = [
    { key: 'English', label: 'English' },
    { key: 'Korean',  label: '한국어' },
  ]

  return (
    <div style={styles.translationBar}>
      <div style={styles.translationInner}>
        <span style={styles.translateLabel}>Translate to:</span>
        <div style={styles.langGroup}>
          {langs.map(({ key, label }) => (
            <button
              key={key}
              style={{ ...styles.langBtn, ...(targetLang === key ? styles.langBtnActive : {}) }}
              onClick={() => onLangChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          style={{ ...styles.translateBtn, ...(translating ? styles.translateBtnDisabled : {}) }}
          onClick={onTranslate}
          disabled={translating}
        >
          {translating
            ? <><span style={styles.miniSpinner} /> Translating…</>
            : translated ? 'Re-translate' : 'Translate'}
        </button>
        {translated && !translating && (
          <span style={styles.translatedBadge}>translated</span>
        )}
      </div>
      {error && <p style={styles.translateError}>{error}</p>}
    </div>
  )
}

const styles = {
  app: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '0 16px 64px',
  },
  header: {
    textAlign: 'center',
    padding: '48px 0 8px',
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    letterSpacing: '-0.5px',
    color: '#e8e8ed',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: '#888',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    padding: '32px 0',
  },
  analyzeRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  analyzeBtn: {
    padding: '12px 32px',
    background: '#4f8ef7',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '-0.2px',
  },
  errorText: {
    fontSize: 13,
    color: '#ff453a',
    textAlign: 'center',
    maxWidth: 480,
  },
  analyzingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  analyzingText: {
    fontSize: 14,
    color: '#888',
  },
  spinner: {
    width: 20,
    height: 20,
    border: '2px solid #2a2a3a',
    borderTop: '2px solid #4f8ef7',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 640,
  },
  toggle: {
    display: 'flex',
    background: '#1a1a24',
    borderRadius: 8,
    padding: 3,
    gap: 2,
  },
  reanalyzeBtn: {
    marginLeft: 'auto',
    padding: '7px 14px',
    background: 'transparent',
    color: '#555',
    border: '1px solid #2a2a3a',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
  },
  tab: {
    padding: '7px 20px',
    background: 'transparent',
    color: '#666',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  tabActive: {
    background: '#2a2a3a',
    color: '#e8e8ed',
  },
  resetBtn: {
    padding: '8px 20px',
    background: 'transparent',
    color: '#444',
    border: '1px solid #222',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer',
    marginTop: 12,
  },
  translationBar: {
    width: '100%',
    maxWidth: 640,
  },
  translationInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#111118',
    border: '1px solid #1e1e2e',
    borderRadius: 8,
    padding: '8px 12px',
  },
  translateLabel: {
    fontSize: 12,
    color: '#555',
    flexShrink: 0,
  },
  langGroup: {
    display: 'flex',
    gap: 4,
  },
  langBtn: {
    padding: '5px 12px',
    background: 'transparent',
    color: '#555',
    border: '1px solid #2a2a3a',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  langBtnActive: {
    background: '#2a2a3a',
    color: '#e8e8ed',
    borderColor: '#3a3a4a',
  },
  translateBtn: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 14px',
    background: '#4f8ef7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  translateBtnDisabled: {
    background: '#2a3a5a',
    color: '#4a6a9a',
    cursor: 'not-allowed',
  },
  miniSpinner: {
    display: 'inline-block',
    width: 10,
    height: 10,
    border: '1.5px solid #4a6a9a',
    borderTop: '1.5px solid #aac4f7',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  translatedBadge: {
    fontSize: 11,
    color: '#4a9a6a',
    border: '1px solid #1a3a2a',
    borderRadius: 4,
    padding: '2px 6px',
    flexShrink: 0,
  },
  translateError: {
    margin: '6px 0 0',
    fontSize: 12,
    color: '#ff453a',
  },
}
