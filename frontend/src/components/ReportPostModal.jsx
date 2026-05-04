import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'

/**
 * ReportPostModal — reason picker + optional note for filing a report
 * against a post. Lives outside PostAuthorMenu so it can render full-screen
 * on mobile without the kebab clipping it.
 *
 * Calls POST /api/posts/{post_id}/report. The server treats duplicate
 * reports from the same user as idempotent (returns 201 with
 * `duplicate: true`), so we render the same success state either way and
 * let the user move on without learning whether they had filed before.
 */

const REASONS = [
  { value: 'spam', label: 'Spam', body: 'Repetitive, off-topic, or commercial promotion.' },
  { value: 'harassment', label: 'Harassment', body: 'Targeting a person — bullying, threats, or stalking.' },
  { value: 'hate', label: 'Hate', body: 'Slurs or attacks based on identity.' },
  { value: 'misinformation', label: 'Misinformation', body: 'False or misleading claims about facts/events.' },
  { value: 'inappropriate', label: 'Inappropriate', body: 'Sexual, graphic, or otherwise unsafe for the campus feed.' },
  { value: 'other', label: 'Other', body: 'Something else — leave a note below so mods know.' },
]

function ReportPostModal({ post, open, onClose, onReported }) {
  const [reason, setReason] = useState('spam')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Reset every time the modal opens so a previous draft doesn't carry over.
  useEffect(() => {
    if (!open) return
    setReason('spam')
    setNote('')
    setError(null)
    setSuccess(false)
    setSubmitting(false)
  }, [open])

  // Esc to close.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await apiFetch(`/api/posts/${post.id}/report`, {
        method: 'POST',
        body: JSON.stringify({
          reason,
          note: note.trim() || undefined,
        }),
      })
      setSuccess(true)
      onReported?.(post.id)
    } catch (err) {
      // 429 = rate-limited; 400 = self-report; surface both verbatim.
      setError(err?.message || 'Could not file that report. Try again in a moment.')
    } finally {
      setSubmitting(false)
    }
  }

  const otherSelected = reason === 'other'

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] bg-navy/60 flex items-start justify-center pt-16 sm:pt-20 px-4"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-md border-t-[3px] border-gold shadow-[0_24px_60px_-20px_rgba(11,29,52,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 border-b border-lightgray flex items-center justify-between">
          <div>
            <div className="font-archivo text-[0.6rem] font-extrabold uppercase tracking-[0.22em] text-gray">
              Report a post
            </div>
            <h3 className="font-editorial italic font-black text-navy text-[1.1rem] leading-tight mt-1">
              Help keep the feed safe
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center text-gray/70 hover:text-navy hover:bg-offwhite rounded bg-transparent border-0 cursor-pointer text-lg leading-none"
          >
            ×
          </button>
        </div>

        {success ? (
          <div className="px-6 py-8 text-center">
            <div className="font-editorial italic font-black text-gold text-[2.6rem] leading-none mb-2">
              ✓
            </div>
            <p className="font-archivo font-extrabold text-navy text-[0.95rem] mb-1">
              Report received
            </p>
            <p className="text-[0.84rem] text-gray font-franklin leading-relaxed mb-4">
              A moderator will look at it shortly. Thanks for helping keep BearBoard safe.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="bg-navy text-white border-none py-2.5 px-5 font-archivo text-[0.7rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#13284a] transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="px-5 py-4">
            <p className="text-[0.78rem] text-gray font-franklin mb-3 leading-relaxed">
              Reporting{' '}
              <span className="font-archivo font-extrabold text-ink">
                "{(post?.title || 'this post').slice(0, 60)}{(post?.title || '').length > 60 ? '…' : ''}"
              </span>
              . Reports go straight to our moderation team.
            </p>

            <fieldset className="space-y-1.5 mb-3">
              <legend className="font-archivo text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-gray mb-2">
                Reason
              </legend>
              {REASONS.map((r) => {
                const active = reason === r.value
                return (
                  <label
                    key={r.value}
                    className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                      active
                        ? 'border-navy bg-gold-pale/50'
                        : 'border-lightgray bg-card hover:border-navy/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={r.value}
                      checked={active}
                      onChange={() => setReason(r.value)}
                      disabled={submitting}
                      className="mt-1 accent-navy"
                    />
                    <span className="min-w-0">
                      <span className="block font-archivo font-extrabold text-[0.78rem] uppercase tracking-wider text-navy">
                        {r.label}
                      </span>
                      <span className="block text-[0.78rem] text-ink/75 font-franklin mt-0.5 leading-snug">
                        {r.body}
                      </span>
                    </span>
                  </label>
                )
              })}
            </fieldset>

            <label className="block">
              <span className="font-archivo text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-gray block mb-1.5">
                Note {otherSelected ? '' : '(optional)'}
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={submitting}
                rows={3}
                maxLength={2000}
                placeholder={otherSelected ? 'Tell us what\'s wrong with this post…' : 'Add context if it helps the mods…'}
                className="w-full border border-lightgray bg-white px-3 py-2 text-[0.88rem] font-franklin focus:border-navy focus:outline-none resize-y min-h-[64px]"
              />
            </label>

            {error && (
              <div className="mt-3 text-[0.78rem] text-danger font-archivo font-bold" role="alert">
                {error}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="bg-transparent border border-lightgray text-gray hover:text-ink hover:border-gray py-2 px-4 font-archivo text-[0.7rem] font-extrabold uppercase tracking-wide cursor-pointer disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-danger text-white border-none py-2 px-5 font-archivo text-[0.7rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#6a1313] transition-colors disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'File report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default ReportPostModal
