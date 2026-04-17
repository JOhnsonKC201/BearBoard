import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiFetch } from '../api/client'

const CAT_STYLES = {
  events: 'bg-gold-pale text-[#8B6914]',
  academic: 'bg-[#D1E3F5] text-navy',
  recruiters: 'bg-[#E6D8F0] text-purple',
  social: 'bg-[#D0EDE9] text-[#0F5E54]',
  general: 'bg-[#E5E3DE] text-[#5A5A5A]',
  anonymous: 'bg-[#1A1A1A] text-white',
}

function formatRelative(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function PostDetail() {
  const { id } = useParams()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [commentBody, setCommentBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [commentError, setCommentError] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    apiFetch(`/api/posts/${id}`)
      .then((data) => setPost(data))
      .catch((err) => setError(err.message || 'Failed to load post'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const submitComment = async (e) => {
    e.preventDefault()
    setCommentError(null)
    if (!commentBody.trim()) return
    setSubmitting(true)
    try {
      await apiFetch(`/api/posts/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: commentBody.trim() }),
      })
      setCommentBody('')
      load()
    } catch (err) {
      setCommentError(err.status === 401 ? 'Log in to comment' : (err.message || 'Failed to post comment'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-offwhite flex items-center justify-center">
        <p className="text-gray font-archivo">Loading post…</p>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-offwhite flex items-center justify-center flex-col gap-2">
        <p className="text-gray font-archivo">{error || 'Post not found'}</p>
        <Link to="/" className="text-gold font-archivo font-extrabold text-[0.75rem] uppercase tracking-wide">
          Back to feed
        </Link>
      </div>
    )
  }

  const categoryKey = (post.category || 'general').toLowerCase()
  const catClass = CAT_STYLES[categoryKey] || CAT_STYLES.general
  const isAnonymous = categoryKey === 'anonymous'
  const score = (post.upvotes ?? 0) - (post.downvotes ?? 0)
  const authorName = isAnonymous ? 'Anonymous' : (post.author?.name || 'Unknown')

  return (
    <div className="min-h-screen bg-offwhite">
      <div className="max-w-[700px] mx-auto px-6 py-6">
        <Link to="/" className="text-gray text-[0.75rem] font-archivo font-bold uppercase tracking-wide hover:text-ink">
          &larr; Back to feed
        </Link>

        <article className="bg-card border border-lightgray border-l-[3px] border-l-gold mt-3 px-5 py-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <strong className="text-[0.9rem] font-semibold block leading-tight">{authorName}</strong>
              <small className="text-[0.7rem] text-gray">{formatRelative(post.created_at)}</small>
            </div>
            <span className={`font-archivo text-[0.6rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-sm ${catClass}`}>
              {post.category}
            </span>
          </div>
          <h1 className="font-archivo font-black text-[1.4rem] tracking-tight leading-tight mb-3">{post.title}</h1>
          <div className="text-[0.92rem] text-ink leading-relaxed whitespace-pre-wrap mb-4">{post.body}</div>
          <div className="flex items-center gap-4 pt-3 border-t border-[#EAE7E0] text-[0.78rem] text-gray">
            <span><b className="text-ink">{score}</b> votes</span>
            <span><b className="text-ink">{(post.comments || []).length}</b> comments</span>
          </div>
        </article>

        <section className="mt-6">
          <h2 className="font-archivo font-extrabold text-[0.75rem] uppercase tracking-widest text-gray mb-3">Comments</h2>

          <form onSubmit={submitComment} className="bg-card border border-lightgray p-3 mb-4">
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              disabled={submitting}
              rows={3}
              className="w-full border border-lightgray bg-white px-3 py-2 text-[0.88rem] font-franklin resize-y focus:border-navy focus:outline-none mb-2"
              placeholder="Add a comment…"
            />
            {commentError && (
              <div className="text-[0.75rem] text-[#8B1A1A] mb-2 font-archivo font-bold">{commentError}</div>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !commentBody.trim()}
                className="bg-gold text-navy border-none py-2 px-4 font-archivo text-[0.7rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#E5A92E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Posting…' : 'Post Comment'}
              </button>
            </div>
          </form>

          {(post.comments || []).length === 0 ? (
            <p className="text-gray text-[0.85rem]">No comments yet.</p>
          ) : (
            post.comments.map((c) => (
              <div key={c.id} className="bg-card border border-lightgray px-4 py-3 mb-2">
                <div className="flex items-center justify-between mb-1">
                  <strong className="text-[0.82rem] font-semibold">{c.author?.name || 'Unknown'}</strong>
                  <span className="text-[0.7rem] text-gray">{formatRelative(c.created_at)}</span>
                </div>
                <div className="text-[0.88rem] text-ink leading-relaxed whitespace-pre-wrap">{c.body}</div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  )
}

export default PostDetail
