import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api/client'

/**
 * EditPostModal — lets the author edit title, body, and image URL on an
 * existing post. Category edits are intentionally not offered because
 * the backend refuses them (keeps filters + notifications coherent).
 *
 * Sent via PUT /api/posts/{id} which returns the updated post; the
 * parent receives the fresh record via onSaved(updated).
 */
const TITLE_MAX = 200
const BODY_MAX = 10_000

function EditPostModal({ post, onClose, onSaved }) {
  const [title, setTitle] = useState(post.title || '')
  const [body, setBody] = useState(post.body || '')
  const [imageUrl, setImageUrl] = useState(post.image_url || '')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState(null)
  const titleRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => titleRef.current?.focus(), 50)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      clearTimeout(t)
    }
  }, [onClose])

  const submit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (!title.trim()) { setErr('Title is required'); return }
    if (!body.trim()) { setErr('Body is required'); return }
    setSubmitting(true); setErr(null)
    try {
      const updated = await apiFetch(`/api/posts/${post.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          image_url: imageUrl.trim(),
        }),
      })
      onSaved?.(updated)
    } catch (e2) {
      setErr(e2?.message || 'Edit failed')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-navy/60 z-[200] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-post-title"
    >
      <div className="bg-card w-full max-w-[560px] max-h-[92vh] overflow-y-auto border border-lightgray">
        <header className="flex items-center justify-between px-5 py-4 border-b border-divider bg-offwhite sticky top-0 z-[1]">
          <h2 id="edit-post-title" className="font-archivo font-black text-[1.05rem] tracking-tight">
            Edit post
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center bg-transparent border-none text-gray hover:text-ink cursor-pointer text-xl leading-none"
          >
            &times;
          </button>
        </header>
        <form onSubmit={submit} className="px-5 py-5 space-y-4">
          <div>
            <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">
              Title <span className="font-franklin normal-case tracking-normal text-[0.7rem] text-gray/70 tabular-nums">({title.length}/{TITLE_MAX})</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
              disabled={submitting}
              className="w-full border border-lightgray bg-white px-3.5 py-2.5 text-[0.94rem] font-franklin focus:border-navy focus:ring-2 focus:ring-navy/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">
              Body <span className="font-franklin normal-case tracking-normal text-[0.7rem] text-gray/70 tabular-nums">({body.length}/{BODY_MAX})</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
              disabled={submitting}
              rows={7}
              className="w-full border border-lightgray bg-white px-3.5 py-2.5 text-[0.92rem] font-franklin resize-y focus:border-navy focus:ring-2 focus:ring-navy/20 outline-none transition-colors leading-relaxed"
            />
          </div>
          <div>
            <label className="block font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">
              Image URL <span className="font-franklin normal-case tracking-normal text-[0.7rem] text-gray/70 italic">(optional — clear to remove)</span>
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value.slice(0, 500))}
              disabled={submitting}
              placeholder="https://..."
              className="w-full border border-lightgray bg-white px-3.5 py-2.5 text-[0.88rem] font-franklin focus:border-navy focus:ring-2 focus:ring-navy/20 outline-none transition-colors"
            />
          </div>
          <div className="text-[0.74rem] text-gray italic bg-offwhite border-l-[3px] border-navy px-3 py-2">
            Category / flair cannot be changed after posting. If the flair is wrong, delete and repost.
          </div>
          {err && (
            <div className="bg-danger-bg border border-danger-border text-danger px-3 py-2 text-[0.82rem] font-archivo font-bold" role="alert">
              {err}
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="font-archivo font-extrabold text-[0.74rem] uppercase tracking-wide py-2.5 px-4 min-h-[42px] border border-lightgray bg-white hover:bg-offwhite cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-navy text-gold font-archivo font-extrabold text-[0.74rem] uppercase tracking-wide py-2.5 min-h-[42px] border-none cursor-pointer hover:bg-[#132d4a] transition-colors disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditPostModal
