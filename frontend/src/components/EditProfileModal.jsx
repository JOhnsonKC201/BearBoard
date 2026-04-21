import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api/client'

/* -----------------------------------------------------------------------
 * EditProfileModal — "File your dossier"
 *
 * Editorial-styled editor for the self-only profile fields. The banner
 * and avatar image pickers live on the Profile page itself (direct
 * manipulation: click the thing to upload it); this modal is just for
 * the text fields that benefit from a focused, distraction-free panel.
 *
 * Bio gets a live pull-quote preview on the right so the user can see
 * how their words will actually render on the page before saving.
 * --------------------------------------------------------------------- */

function EditProfileModal({ open, user, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [major, setMajor] = useState('')
  const [gradYear, setGradYear] = useState('')
  const [bio, setBio] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const nameRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setName(user?.name || '')
    setMajor(user?.major || '')
    setGradYear(user?.graduation_year ? String(user.graduation_year) : '')
    setBio(user?.bio || '')
    setError(null)
    setSubmitting(false)
  }, [open, user])

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

  const previewBio = bio.trim() || 'Write a line or two — what you study, what you post about, a line you want pinned above your door.'
  const previewIsPlaceholder = !bio.trim()
  const firstLetter = previewBio.charAt(0)
  const restOfBio = previewBio.slice(1)

  return (
    <div
      className="fixed inset-0 bg-navy/70 z-[200] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
    >
      <div className="bg-[#F7F1E3] w-full max-w-[880px] max-h-[92vh] overflow-hidden border border-navy shadow-[0_30px_80px_-20px_rgba(11,29,52,0.5)] flex flex-col">
        {/* Folio-style header */}
        <div className="flex items-center justify-between px-6 py-3 border-b-[3px] border-b-navy bg-navy text-white">
          <div>
            <div className="text-gold font-archivo font-extrabold text-[0.58rem] uppercase tracking-[0.28em]">
              BearBoard · Editorial desk
            </div>
            <h2
              id="edit-profile-title"
              className="font-editorial italic text-white mt-0.5"
              style={{ fontSize: '1.4rem', fontWeight: 500 }}
            >
              File your dossier
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center bg-transparent border-none text-white/70 hover:text-gold cursor-pointer text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-0">
            {/* Left: form fields */}
            <div className="px-6 py-5 space-y-5 border-r border-lightgray">
              <div className="text-[0.62rem] font-archivo font-extrabold uppercase tracking-[0.22em] text-navy/70 border-b border-navy/30 pb-2">
                The masthead
              </div>

              <Field label="Full name">
                <input
                  id="edit-name"
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  maxLength={100}
                  className="w-full border border-lightgray bg-white px-3.5 py-3 text-[0.95rem] font-franklin focus:border-navy min-h-[44px] outline-none transition-colors"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Major">
                  <input
                    id="edit-major"
                    type="text"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    disabled={submitting}
                    maxLength={100}
                    className="w-full border border-lightgray bg-white px-3.5 py-3 text-[0.95rem] font-franklin focus:border-navy min-h-[44px] outline-none transition-colors"
                    placeholder="Computer Science"
                  />
                </Field>
                <Field label="Grad year">
                  <input
                    id="edit-gradyear"
                    type="text"
                    inputMode="numeric"
                    value={gradYear}
                    onChange={(e) => setGradYear(e.target.value)}
                    disabled={submitting}
                    maxLength={4}
                    className="w-full border border-lightgray bg-white px-3.5 py-3 text-[0.95rem] font-franklin focus:border-navy min-h-[44px] outline-none transition-colors"
                    placeholder="2027"
                  />
                </Field>
              </div>

              <div className="text-[0.62rem] font-archivo font-extrabold uppercase tracking-[0.22em] text-navy/70 border-b border-navy/30 pb-2 pt-2">
                In your own words
              </div>

              <Field
                label="Bio"
                suffix={
                  <span className={`font-franklin tabular-nums text-[0.7rem] ${bio.length >= 450 ? 'text-danger' : 'text-gray/70'}`}>
                    {bio.length}/500
                  </span>
                }
              >
                <textarea
                  id="edit-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 500))}
                  disabled={submitting}
                  rows={7}
                  className="w-full border border-lightgray bg-white px-3.5 py-3 text-[0.94rem] font-franklin resize-y focus:border-navy leading-relaxed outline-none transition-colors"
                  placeholder="Three sentences, tops. What you study, what you're into, one thing you want people to know."
                />
                <div className="text-[0.7rem] text-gray mt-1.5 font-franklin italic">
                  Shows up as a pull quote above your writings. Keep it crisp — the serif loves short lines.
                </div>
              </Field>

              <div className="text-[0.62rem] font-archivo font-extrabold uppercase tracking-[0.22em] text-navy/70 border-b border-navy/30 pb-2 pt-2">
                Photos
              </div>
              <div className="bg-white border border-lightgray px-4 py-3 text-[0.85rem] font-franklin text-ink/80 leading-relaxed">
                <strong className="font-archivo uppercase tracking-wider text-[0.68rem] text-navy">Banner &amp; portrait</strong>
                <div className="mt-1.5 text-[0.82rem]">
                  Close this panel and click the banner or your photo directly to upload an image.
                  We save it locally until the image API ships.
                </div>
              </div>

              {error && (
                <div className="bg-danger-bg border border-danger-border text-danger px-3 py-2 text-[0.82rem] font-archivo font-bold" role="alert">
                  {error}
                </div>
              )}
            </div>

            {/* Right: live pull-quote preview */}
            <aside className="bg-[#F7F1E3] px-5 py-6 hidden md:flex md:flex-col">
              <div className="text-[0.62rem] font-archivo font-extrabold uppercase tracking-[0.22em] text-navy/70 border-b border-navy/30 pb-2 mb-5">
                Live pull quote
              </div>
              <figure className="relative px-3 py-6 flex-1">
                <span
                  aria-hidden
                  className="absolute left-0 -top-2 text-gold/85 leading-none select-none font-editorial"
                  style={{ fontSize: '4.5rem', fontStyle: 'italic', fontWeight: 700 }}
                >
                  “
                </span>
                <span
                  aria-hidden
                  className="absolute right-0 -bottom-4 text-gold/85 leading-none select-none font-editorial"
                  style={{ fontSize: '4.5rem', fontStyle: 'italic', fontWeight: 700 }}
                >
                  ”
                </span>
                <blockquote
                  className="font-editorial text-navy"
                  style={{ fontSize: '1.1rem', lineHeight: 1.45, fontStyle: previewIsPlaceholder ? 'italic' : 'normal', opacity: previewIsPlaceholder ? 0.5 : 1 }}
                >
                  <span
                    className="float-left mr-2 text-navy font-editorial"
                    style={{ fontSize: '3.2rem', lineHeight: 0.85, fontWeight: 600, marginTop: '0.15em', fontStyle: 'normal' }}
                  >
                    {firstLetter}
                  </span>
                  <span>{restOfBio}</span>
                </blockquote>
                <figcaption className="mt-5 pt-3 border-t border-navy/20 flex items-center gap-2 text-[0.62rem] font-archivo font-extrabold uppercase tracking-[0.22em] text-navy/60">
                  <span className="h-[1px] w-6 bg-navy/60" />
                  {name ? `— ${name}` : '— You'}
                </figcaption>
              </figure>
              <div className="text-[0.68rem] text-gray font-franklin italic mt-auto">
                Previewing the front page of your dossier.
              </div>
            </aside>

            {/* Footer (spans both cols) */}
            <div className="col-span-full flex items-center justify-end gap-2 px-6 py-4 border-t border-navy/20 bg-[#EFE8D7]">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="font-archivo font-extrabold text-[0.72rem] uppercase tracking-widest py-2.5 px-4 min-h-[42px] border border-navy/30 bg-transparent hover:bg-white cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-navy text-gold font-archivo font-extrabold text-[0.72rem] uppercase tracking-widest py-2.5 px-6 min-h-[42px] border-none cursor-pointer hover:bg-[#132d4a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving…' : 'Go to press'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/** Label row with optional right-aligned suffix (used for char counter). */
function Field({ label, suffix, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-navy/70">
          {label}
        </label>
        {suffix}
      </div>
      {children}
    </div>
  )
}

export default EditProfileModal
