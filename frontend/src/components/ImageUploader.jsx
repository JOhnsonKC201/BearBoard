import { useRef, useState } from 'react'

// Cloudinary unsigned upload — the browser POSTs the file directly to
// Cloudinary's API, so our backend never touches the bytes. Configure with:
//   VITE_CLOUDINARY_CLOUD_NAME=<your-cloud-name>
//   VITE_CLOUDINARY_UPLOAD_PRESET=<unsigned-preset-name>
// When either is missing we fall back to the old "paste a URL" UX so the
// composer keeps working in environments (local dev, CI) without Cloudinary.
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const CLOUDINARY_ENABLED = Boolean(CLOUD_NAME && UPLOAD_PRESET)

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
// `image/*` on the file-input's accept attribute (rather than enumerated MIME
// types) is what makes iOS Safari + Android Chrome cleanly offer "Take Photo"
// + "Photo Library" + "Browse Files" in the native picker. The MIME validation
// against ACCEPTED_TYPES still runs after pickup so HEIC / TIFF / video can't
// sneak through.
const ACCEPT_ATTR = 'image/*'
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB — matches Cloudinary free-tier friendly

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    form.append('upload_preset', UPLOAD_PRESET)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText || '{}')
        if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) resolve(res.secure_url)
        else reject(new Error(res?.error?.message || `Upload failed (${xhr.status})`))
      } catch {
        reject(new Error('Upload response could not be parsed'))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(form)
  })
}

function ImageUploader({ value, onChange, disabled }) {
  const fileInputRef = useRef(null)
  // Separate input wired to capture="environment" so mobile users get
  // straight to the camera viewfinder when they tap "Take photo." Desktop
  // browsers ignore `capture`, so this safely no-ops there.
  const cameraInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const commitUrlDraft = () => {
    const v = urlDraft.trim()
    if (!v) return
    onChange(v)
    setUrlDraft('')
  }

  const pickFile = () => {
    if (disabled || uploading) return
    setError(null)
    fileInputRef.current?.click()
  }

  const takePhoto = () => {
    if (disabled || uploading) return
    setError(null)
    cameraInputRef.current?.click()
  }

  const ingestFile = async (file) => {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Use a JPG, PNG, WEBP, or GIF')
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`Image is ${humanSize(file.size)} — max is 10 MB`)
      return
    }
    setUploading(true)
    setProgress(0)
    setError(null)
    try {
      const url = await uploadToCloudinary(file, setProgress)
      onChange(url)
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file after removal
    await ingestFile(file)
  }

  // Drag-and-drop handlers. We block the default browser behavior (which
  // would otherwise navigate to the dropped image) and surface a visual
  // hover state via `dragOver`. Multi-file drops take only the first file
  // since posts carry a single image.
  const onDragOver = (e) => {
    if (disabled || uploading) return
    e.preventDefault()
    e.stopPropagation()
    if (!dragOver) setDragOver(true)
  }
  const onDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }
  const onDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (disabled || uploading) return
    const file = e.dataTransfer?.files?.[0]
    await ingestFile(file)
  }

  const clear = () => {
    if (disabled || uploading) return
    onChange('')
    setError(null)
  }

  return (
    <div>
      {value ? (
        <div className="border border-lightgray bg-offwhite overflow-hidden relative">
          <img
            src={value}
            alt="Upload preview"
            className="w-full max-h-[220px] object-contain bg-black/5"
            onError={() => setError('Could not load that image')}
          />
          <div className="flex items-center gap-2 px-2.5 py-2 border-t border-lightgray bg-white">
            <span className="text-[0.7rem] font-archivo uppercase tracking-wider text-gray truncate flex-1">
              Image attached
            </span>
            <button
              type="button"
              onClick={clear}
              disabled={disabled || uploading}
              className="font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider py-1.5 px-2.5 bg-transparent border border-lightgray text-gray hover:text-danger hover:border-danger cursor-pointer transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : CLOUDINARY_ENABLED ? (
        <div>
          <button
            type="button"
            onClick={pickFile}
            onDragOver={onDragOver}
            onDragEnter={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            disabled={disabled || uploading}
            className={`w-full border border-dashed px-4 py-5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex flex-col items-center gap-1 ${
              dragOver
                ? 'border-navy bg-gold-pale/40 ring-2 ring-navy/20'
                : 'border-lightgray bg-offwhite hover:border-navy hover:bg-white'
            }`}
          >
            <span className="font-archivo font-extrabold text-[0.78rem] text-ink">
              {uploading
                ? `Uploading… ${progress}%`
                : dragOver
                ? 'Drop to upload'
                : 'Click or drag an image here'}
            </span>
            <span className="text-[0.68rem] text-gray font-franklin">
              JPG, PNG, WEBP, or GIF · up to 10 MB
            </span>
            {uploading && (
              <div className="w-full h-1 bg-lightgray mt-2 overflow-hidden">
                <div
                  className="h-full bg-navy transition-[width] duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </button>
          {/* Mobile-first secondary action — opens the camera viewfinder
              directly on phones via the dedicated capture-attribute input.
              On desktop the click no-ops (no camera attached), so we hide
              the button on screens where it'd just confuse. */}
          <button
            type="button"
            onClick={takePhoto}
            disabled={disabled || uploading}
            className="sm:hidden mt-2 w-full bg-card border border-navy text-navy py-2.5 px-3 font-archivo text-[0.72rem] font-extrabold uppercase tracking-wider cursor-pointer hover:bg-navy hover:text-gold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Take a photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTR}
            onChange={onFile}
            className="hidden"
            disabled={disabled || uploading}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept={ACCEPT_ATTR}
            capture="environment"
            onChange={onFile}
            className="hidden"
            disabled={disabled || uploading}
          />
          <button
            type="button"
            onClick={() => setShowUrlInput((v) => !v)}
            disabled={disabled || uploading}
            className="mt-2 font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray hover:text-navy bg-transparent border-none cursor-pointer px-0"
          >
            {showUrlInput ? 'Hide URL field' : 'Or paste a URL →'}
          </button>
          {showUrlInput && (
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onBlur={commitUrlDraft}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitUrlDraft() } }}
              disabled={disabled || uploading}
              placeholder="https://... (press Enter to attach)"
              className="mt-1.5 w-full border border-lightgray bg-white px-3 py-2 text-[0.88rem] font-franklin focus:border-navy focus:outline-none"
            />
          )}
        </div>
      ) : (
        <input
          type="url"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="https://... (paste a direct image link)"
          className="w-full border border-lightgray bg-white px-3 py-2 text-[0.9rem] font-franklin focus:border-navy focus:outline-none"
        />
      )}
      {error && (
        <div className="mt-1.5 text-[0.74rem] text-danger font-archivo font-bold" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}

export default ImageUploader
