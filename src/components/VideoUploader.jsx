import { useState, useRef } from 'react'
import { uploadVideoToGemini, waitForFileActive } from '../api/gemini'

const ACCEPTED = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']

export default function VideoUploader({ onUploadComplete }) {
  const [dragOver, setDragOver] = useState(false)
  const [status, setStatus] = useState('idle') // idle | uploading | processing | done | error
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileInfo, setFileInfo] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef()

  async function handleFile(file) {
    if (!ACCEPTED.includes(file.type)) {
      setErrorMsg(`Unsupported format: ${file.type}. Use MP4, WebM, or MOV.`)
      setStatus('error')
      return
    }

    setErrorMsg('')
    setStatus('uploading')
    setUploadProgress(0)
    setFileInfo({ name: file.name, size: formatBytes(file.size) })

    try {
      const uploadedFile = await uploadVideoToGemini(file, (p) => setUploadProgress(p))

      setStatus('processing')
      const activeFile = await waitForFileActive(uploadedFile.name, (state) => {
        console.log('File state:', state)
      })

      setStatus('done')
      onUploadComplete({
        localFile: file,
        geminiFile: activeFile,
        localUrl: URL.createObjectURL(file),
      })
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onInputChange(e) {
    const file = e.target.files[0]
    if (file) handleFile(file)
  }

  const isActive = status === 'uploading' || status === 'processing'

  return (
    <div style={styles.wrapper}>
      <div
        style={{
          ...styles.dropzone,
          ...(dragOver ? styles.dropzoneOver : {}),
          ...(isActive ? styles.dropzoneDisabled : {}),
        }}
        onClick={() => !isActive && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); if (!isActive) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={isActive ? undefined : onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          style={{ display: 'none' }}
          onChange={onInputChange}
          disabled={isActive}
        />

        {status === 'idle' && (
          <IdleView />
        )}

        {status === 'uploading' && (
          <UploadingView name={fileInfo?.name} size={fileInfo?.size} progress={uploadProgress} />
        )}

        {status === 'processing' && (
          <ProcessingView name={fileInfo?.name} />
        )}

        {status === 'done' && (
          <DoneView name={fileInfo?.name} />
        )}

        {status === 'error' && (
          <ErrorView message={errorMsg} onRetry={() => setStatus('idle')} />
        )}
      </div>
    </div>
  )
}

function IdleView() {
  return (
    <div style={styles.centered}>
      <div style={styles.icon}>🎬</div>
      <p style={styles.heading}>Drop a video here</p>
      <p style={styles.sub}>or click to browse · MP4, WebM, MOV</p>
    </div>
  )
}

function UploadingView({ name, size, progress }) {
  const pct = Math.round(progress * 100)
  return (
    <div style={styles.centered}>
      <p style={styles.heading}>Uploading…</p>
      <p style={styles.sub}>{name} · {size}</p>
      <ProgressBar value={progress} label={`${pct}%`} color="#4f8ef7" />
    </div>
  )
}

function ProcessingView({ name }) {
  return (
    <div style={styles.centered}>
      <div style={styles.spinner} />
      <p style={styles.heading}>Processing video</p>
      <p style={styles.sub}>{name} · Gemini is indexing the file…</p>
    </div>
  )
}

function DoneView({ name }) {
  return (
    <div style={styles.centered}>
      <div style={{ ...styles.icon, color: '#34c759' }}>✓</div>
      <p style={styles.heading}>Upload complete</p>
      <p style={styles.sub}>{name}</p>
    </div>
  )
}

function ErrorView({ message, onRetry }) {
  return (
    <div style={styles.centered}>
      <div style={{ ...styles.icon, color: '#ff453a' }}>✕</div>
      <p style={{ ...styles.heading, color: '#ff453a' }}>Upload failed</p>
      <p style={styles.sub}>{message}</p>
      <button style={styles.retryBtn} onClick={(e) => { e.stopPropagation(); onRetry() }}>
        Try again
      </button>
    </div>
  )
}

function ProgressBar({ value, label, color }) {
  return (
    <div style={styles.barOuter}>
      <div style={{ ...styles.barInner, width: `${Math.round(value * 100)}%`, background: color }} />
      <span style={styles.barLabel}>{label}</span>
    </div>
  )
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const styles = {
  wrapper: {
    display: 'flex',
    justifyContent: 'center',
    padding: '48px 16px',
  },
  dropzone: {
    width: '100%',
    maxWidth: 560,
    minHeight: 260,
    border: '2px dashed #3a3a4a',
    borderRadius: 16,
    background: '#1a1a24',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
  },
  dropzoneOver: {
    borderColor: '#4f8ef7',
    background: '#1c2340',
  },
  dropzoneDisabled: {
    cursor: 'default',
    opacity: 0.85,
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: 32,
    width: '100%',
  },
  icon: {
    fontSize: 48,
    lineHeight: 1,
  },
  heading: {
    fontSize: 18,
    fontWeight: 600,
    color: '#e8e8ed',
  },
  sub: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  barOuter: {
    position: 'relative',
    width: '100%',
    maxWidth: 360,
    height: 8,
    background: '#2a2a3a',
    borderRadius: 4,
    overflow: 'visible',
    marginTop: 8,
  },
  barInner: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.2s',
  },
  barLabel: {
    position: 'absolute',
    right: 0,
    top: 14,
    fontSize: 12,
    color: '#888',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #2a2a3a',
    borderTop: '3px solid #4f8ef7',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  retryBtn: {
    marginTop: 8,
    padding: '8px 20px',
    background: '#4f8ef7',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer',
  },
}
