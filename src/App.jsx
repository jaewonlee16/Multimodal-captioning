import { useState, useRef, useMemo } from 'react'
import VideoUploader from './components/VideoUploader'
import CaptionDisplay from './components/CaptionDisplay'
import Transcript from './components/Transcript'
import { analyzeVideo } from './api/gemini'
import { buildColorMap } from './utils/speakerColors'

export default function App() {
  const [uploadResult, setUploadResult] = useState(null)
  const [transcript, setTranscript] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [mode, setMode] = useState('live') // 'live' | 'transcript'
  const videoRef = useRef()

  const colorMap = useMemo(
    () => (transcript ? buildColorMap(transcript) : new Map()),
    [transcript]
  )

  async function handleAnalyze() {
    setAnalyzing(true)
    setAnalyzeError('')
    try {
      const segments = await analyzeVideo(
        uploadResult.geminiFile.uri,
        uploadResult.geminiFile.mimeType,
      )
      setTranscript(segments)
      setMode('live')
    } catch (err) {
      console.error(err)
      setAnalyzeError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  function handleReset() {
    setUploadResult(null)
    setTranscript(null)
    setAnalyzeError('')
    setAnalyzing(false)
    setCurrentTime(0)
    setMode('live')
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
          <video
            ref={videoRef}
            src={uploadResult.localUrl}
            controls
            style={styles.video}
            onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
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
              <ModeToggle mode={mode} onChange={setMode} onReanalyze={() => { setTranscript(null); setAnalyzeError('') }} />

              {mode === 'live' ? (
                <CaptionDisplay
                  segments={transcript}
                  currentTime={currentTime}
                  colorMap={colorMap}
                />
              ) : (
                <Transcript
                  segments={transcript}
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
        <button
          style={{ ...styles.tab, ...(mode === 'live' ? styles.tabActive : {}) }}
          onClick={() => onChange('live')}
        >
          Live Captions
        </button>
        <button
          style={{ ...styles.tab, ...(mode === 'transcript' ? styles.tabActive : {}) }}
          onClick={() => onChange('transcript')}
        >
          Full Transcript
        </button>
      </div>
      <button style={styles.reanalyzeBtn} onClick={onReanalyze}>
        Re-analyze
      </button>
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
  video: {
    width: '100%',
    maxWidth: 640,
    borderRadius: 12,
    background: '#000',
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
}
