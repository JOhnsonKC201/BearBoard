import { useEffect, useRef, useState } from 'react'

function CreateGroupModal({ open, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const nameRef = useRef(null)

  // Reset form + Esc-to-close + body-scroll lock. Same treatment
  // NewPostModal got after the a11y audit.
  useEffect(() => {
    if (!open) {
      setName('')
      setCourseCode('')
      setDescription('')
      setError(null)
      setSubmitting(false)
      return
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => nameRef.current?.focus(), 60)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      clearTimeout(t)
    }
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed.length < 2) {
      setError('Name must be at least 2 characters')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onCreate({
        name: trimmed,
        course_code: courseCode.trim() || null,
        description: description.trim() || null,
      })
    } catch (err) {
      setError(err?.message || 'Failed to create group')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-navy/60 z-[200] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-group-title"
    >
      <div className="bg-card w-full max-w-[440px] max-h-[90vh] overflow-y-auto border border-lightgray">
        <div className="flex items-center justify-between px-5 py-4 border-b border-divider bg-offwhite">
          <h2 id="create-group-title" className="font-archivo font-black text-[1rem] tracking-tight">
            Create a study group
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center bg-transparent border-none text-gray hover:text-ink cursor-pointer text-xl"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          <div>
            <label htmlFor="group-name" className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">
              Group name
            </label>
            <input
              id="group-name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              maxLength={100}
              className="w-full border border-lightgray bg-white px-3.5 py-3 text-[0.95rem] sm:text-[0.88rem] font-franklin focus:border-navy min-h-[44px]"
              placeholder="Networking Gang, Calc Crew..."
            />
          </div>

          <div>
            <label htmlFor="group-course" className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">
              Course code <span className="text-gray/60">(optional)</span>
            </label>
            <input
              id="group-course"
              type="text"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              disabled={submitting}
              maxLength={20}
              className="w-full border border-lightgray bg-white px-3.5 py-3 text-[0.95rem] sm:text-[0.88rem] font-franklin focus:border-navy min-h-[44px]"
              placeholder="COSC 350"
            />
          </div>

          <div>
            <label htmlFor="group-desc" className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">
              Description <span className="text-gray/60">(optional)</span>
            </label>
            <textarea
              id="group-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={3}
              maxLength={500}
              className="w-full border border-lightgray bg-white px-3.5 py-2.5 text-[0.9rem] font-franklin resize-y focus:border-navy"
              placeholder="When and where you meet, topics covered..."
            />
          </div>

          {error && (
            <div className="bg-danger-bg border border-danger-border text-danger px-3 py-2 text-[0.82rem] font-archivo font-bold" role="alert">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="font-archivo font-extrabold text-[0.78rem] uppercase tracking-wide py-3 px-4 min-h-[44px] border border-lightgray bg-white hover:bg-offwhite cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-gold text-navy font-archivo font-extrabold text-[0.78rem] uppercase tracking-wide py-3 min-h-[44px] border-none cursor-pointer hover:bg-[#E5A92E] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateGroupModal
