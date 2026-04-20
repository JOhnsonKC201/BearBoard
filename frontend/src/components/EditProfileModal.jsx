import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api/client'

// Self-only profile editor. Opens as a centered sheet with Esc-to-close,
// autofocus on the first field, and body-scroll lock. PUTs the diff to
// /api/users/:id and returns the fresh user via onSaved so the parent
// can re-render without a full refetch.

function EditProfileModal({ open, user, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [major, setMajor] = useState('')
  const [gradYear, setGradYear] = useState('')
  const [bio, setBio] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const nameRef = useRef(null)

  // Seed the form whenever the modal opens with the currently-loaded user.
  useEffect(() => {
    if (!open) return
    setName(user?.name || '')
    setMajor(user?.major || '')
    setGradYear(user?.graduation_year ? String(user.graduation_year) : '')
    setBio(user?.bio || '')
    setError(null)
    setSubmitting(false)
  }, [open, user])

  // Esc-to-close + scroll lock + autofocus.
  useEffect(() => {
    if (!open) return
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
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name is required')
      return
    }
    let year = null
    if (gradYear.trim()) {
      const n = parseInt(gradYear, 10)
      if (Number.isNaN(n) || n < 2024 || n > 2030) {
        setError('Graduation year must be between 2024 and 2030')
        return
      }
      year = n
    }
    setSubmitting(true)
    setError(null)
    try {
      const updated = await apiFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: trimmedName,
          major: major.trim(),
          graduation_year: year,
          bio: bio.trim(),
        }),
      })
      onSaved?.(updated)
      onClose()
    } catch (err) {
      setError(err?.message || 'Failed to save profile')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-navy/60 z-[200] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
    >
      <div className="bg-card w-full max-w-[480px] max-h-[92vh] overflow-y-auto border border-lightgray">
        <div className="flex items-center justify-between px-5 py-4 border-b border-divider bg-offwhite">
          <h2 id="edit-profile-title" className="font-archivo font-black text-[1.05rem] tracking-tight">
            Edit profile
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
            <label htmlFor="edit-name" className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">
              Full name
            </label>
            <input
              id="edit-name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              maxLength={100}
              className="w-full border border-lightgray bg-white px-3.5 py-3 text-[0.95rem] sm:text-[0.88rem] font-franklin focus:border-navy min-h-[44px]"
            />
          </div>

          <div>
            <label htmlFor="edit-bio" className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">
              Bio <span className="text-gray/60 normal-case tracking-normal font-franklin">({bio.length}/500)</span>
            </label>
            <textarea
              id="edit-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 500))}
              disabled={submitting}
              rows={4}
              className="w-full border border-lightgray bg-white px-3.5 py-2.5 text-[0.92rem] font-franklin resize-y focus:border-navy"
              placeholder="A few sentences about you - major, interests, favorite spot on campus."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-major" className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">
                Major
              </label>
              <input
                id="edit-major"
                type="text"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                disabled={submitting}
                maxLength={100}
                className="w-full border border-lightgray bg-white px-3.5 py-3 text-[0.95rem] sm:text-[0.88rem] font-franklin focus:border-navy min-h-[44px]"
                placeholder="Computer Science"
              />
            </div>
            <div>
              <label htmlFor="edit-gradyear" className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">
                Grad year
              </label>
              <input
                id="edit-gradyear"
                type="text"
                inputMode="numeric"
                value={gradYear}
                onChange={(e) => setGradYear(e.target.value)}
                disabled={submitting}
                maxLength={4}
                className="w-full border border-lightgray bg-white px-3.5 py-3 text-[0.95rem] sm:text-[0.88rem] font-franklin focus:border-navy min-h-[44px]"
                placeholder="2026"
              />
            </div>
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
              className="flex-1 bg-navy text-white font-archivo font-extrabold text-[0.78rem] uppercase tracking-wide py-3 min-h-[44px] border-none cursor-pointer hover:bg-[#132d4a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditProfileModal
