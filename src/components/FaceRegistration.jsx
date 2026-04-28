import { useState, useRef } from 'react'

export default function FaceRegistration({ faces, onChange }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [preview, setPreview] = useState(null) // dataUrl for thumbnail
  const [faceData, setFaceData] = useState(null) // { mimeType, base64 }
  const fileInputRef = useRef()

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      // dataUrl = "data:<mimeType>;base64,<data>"
      const [meta, base64] = dataUrl.split(',')
      const mimeType = meta.replace('data:', '').replace(';base64', '')
      setPreview(dataUrl)
      setFaceData({ mimeType, base64 })
    }
    reader.readAsDataURL(file)
  }

  function handleAdd() {
    if (!name.trim() || !faceData) return
    onChange([...faces, { name: name.trim(), ...faceData, preview }])
    resetForm()
  }

  function handleRemove(index) {
    onChange(faces.filter((_, i) => i !== index))
  }

  function resetForm() {
    setAdding(false)
    setName('')
    setPreview(null)
    setFaceData(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.label}>Known Speakers <span style={styles.optional}>(optional)</span></span>
        {!adding && (
          <button style={styles.addBtn} onClick={() => setAdding(true)}>+ Add</button>
        )}
      </div>

      {faces.length > 0 && (
        <div style={styles.chips}>
          {faces.map((face, i) => (
            <div key={i} style={styles.chip}>
              <img src={face.preview} alt={face.name} style={styles.chipThumb} />
              <span style={styles.chipName}>{face.name}</span>
              <button style={styles.removeBtn} onClick={() => handleRemove(i)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div style={styles.form}>
          <input
            style={styles.nameInput}
            type="text"
            placeholder="Speaker name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <label style={styles.photoLabel}>
            {preview ? (
              <img src={preview} alt="preview" style={styles.previewThumb} />
            ) : (
              <span style={styles.photoPlaceholder}>Choose photo</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </label>
          <div style={styles.formActions}>
            <button style={styles.cancelBtn} onClick={resetForm}>Cancel</button>
            <button
              style={{ ...styles.confirmBtn, ...((!name.trim() || !faceData) ? styles.confirmBtnDisabled : {}) }}
              onClick={handleAdd}
              disabled={!name.trim() || !faceData}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    maxWidth: 640,
    background: '#111118',
    border: '1px solid #1e1e2e',
    borderRadius: 10,
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  },
  optional: {
    fontSize: 11,
    fontWeight: 400,
    color: '#444',
    textTransform: 'none',
    letterSpacing: 0,
  },
  addBtn: {
    padding: '4px 12px',
    background: 'transparent',
    color: '#4f8ef7',
    border: '1px solid #1e3a6a',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#1a1a2e',
    border: '1px solid #2a2a3e',
    borderRadius: 20,
    padding: '4px 10px 4px 4px',
  },
  chipThumb: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
  },
  chipName: {
    fontSize: 13,
    color: '#c8c8d8',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#444',
    fontSize: 11,
    cursor: 'pointer',
    padding: '0 0 0 4px',
    lineHeight: 1,
  },
  form: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  nameInput: {
    flex: 1,
    minWidth: 140,
    padding: '7px 10px',
    background: '#1a1a2e',
    border: '1px solid #2a2a3e',
    borderRadius: 6,
    color: '#e8e8ed',
    fontSize: 13,
    outline: 'none',
  },
  photoLabel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: '1px dashed #333',
    cursor: 'pointer',
    overflow: 'hidden',
    flexShrink: 0,
    background: '#1a1a2e',
  },
  photoPlaceholder: {
    fontSize: 10,
    color: '#444',
    textAlign: 'center',
    lineHeight: 1.3,
    padding: 4,
  },
  previewThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  formActions: {
    display: 'flex',
    gap: 6,
    marginLeft: 'auto',
  },
  cancelBtn: {
    padding: '6px 14px',
    background: 'transparent',
    color: '#555',
    border: '1px solid #2a2a3a',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: '6px 16px',
    background: '#4f8ef7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmBtnDisabled: {
    background: '#1e3a5a',
    color: '#3a5a8a',
    cursor: 'not-allowed',
  },
}
