import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { PostDetailSkeleton } from '../components/Skeletons'
import { formatRelativeTime as formatRelative } from '../utils/format'
import { catClassFor } from '../utils/avatar'
import PostAuthorMenu from '../components/PostAuthorMenu'

function PostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
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
    return <PostDetailSkeleton />
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
  const catClass = catClassFor(post.category)
  const isAnonymous = categoryKey === 'anonymous'
  const score = (post.upvotes ?? 0) - (post.downvotes ?? 0)
  const authorName = isAnonymous ? 'Anonymous' : (post.author?.name || 'Unknown')

  return (
    <div className="min-h-screen bg-offwhite">
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-5 sm:py-6">
        <Link to="/" className="text-gray text-[0.75rem] font-archivo font-bold uppercase tracking-wide hover:text-ink inline-flex items-center gap-1 min-h-[44px]">
          &larr; Back to feed
        </Link>

        <article className="bg-card border border-lightgray border-l-[3px] border-l-gold mt-2 px-4 sm:px-5 py-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <strong className="text-[0.9rem] font-semibold block leading-tight truncate">{authorName}</strong>
              <small className="text-[0.7rem] text-gray">{formatRelative(post.created_at)}</small>
            </div>
            <span className={`font-archivo text-[0.6rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-sm shrink-0 ${catClass}`}>
              {post.category}
            </span>
            <PostAuthorMenu
              post={post}
              onUpdated={(updated) => setPost((prev) => ({ ...prev, ...updated }))}
              onDeleted={() => navigate('/')}
            />
          </div>
          <h1 className="font-archivo font-black text-[1.35rem] sm:text-[1.5rem] tracking-tight leading-tight mb-3">{post.title}</h1>
          <div className="text-[0.92rem] text-ink leading-relaxed whitespace-pre-wrap mb-4">{post.body}</div>
          {post.image_url && (
            <div className="bg-black/80 overflow-hidden border border-divider mb-4">
              <img src={post.image_url} alt="" loading="lazy" className="w-full max-h-[420px] object-contain mx-auto" />
            </div>
          )}
          <div className="flex items-center gap-4 pt-3 border-t border-divider text-[0.78rem] text-gray">
            <span><b className="text-ink">{score}</b> votes</span>
            <span><b className="text-ink">{(post.comments || []).length}</b> comments</span>
          </div>
        </article>

        <section className="mt-6" aria-labelledby="comments-heading">
          <h2 id="comments-heading" className="font-archivo font-extrabold text-[0.75rem] uppercase tracking-widest text-gray mb-3">Comments</h2>

          <form onSubmit={submitComment} className="bg-card border border-lightgray p-3 mb-4">
            <label className="sr-only" htmlFor="post-comment-body">Comment</label>
            <textarea
              id="post-comment-body"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              disabled={submitting}
              rows={3}
              className="w-full border border-lightgray bg-white px-3 py-2 text-[0.92rem] font-franklin resize-y focus:border-navy mb-2"
              placeholder="Add a comment..."
            />
            {commentError && (
              <div className="text-[0.75rem] text-danger mb-2 font-archivo font-bold" role="alert">{commentError}</div>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !commentBody.trim()}
                className="bg-gold text-navy border-none py-2.5 px-4 min-h-[44px] font-archivo text-[0.72rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#E5A92E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </form>

          {(post.comments || []).length === 0 ? (
            <p className="text-gray text-[0.85rem] bg-card border border-lightgray px-4 py-6 text-center">
              No comments yet. Be the first.
            </p>
          ) : (
            post.comments.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                postId={post.id}
                currentUser={currentUser}
                onChange={load}
              />
            ))
          )}
        </section>
      </div>
    </div>
  )
}


/**
 * CommentRow — one comment line with inline edit / delete when the
 * viewer owns it (or is a mod for delete). Keeps its own edit-mode
 * state so the containing PostDetail only re-fetches when the user
 * actually changed something.
 */
function CommentRow({ comment, postId, currentUser, onChange }) {
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const isAuthor = currentUser && comment.author_id === currentUser.id
  const isMod = currentUser && (currentUser.role === 'moderator' || currentUser.role === 'admin')
  const canEdit = isAuthor
  const canDelete = isAuthor || isMod

  const save = async (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body) { setErr('Comment cannot be empty'); return }
    setBusy(true); setErr(null)
    try {
      await apiFetch(`/api/posts/${postId}/comments/${comment.id}`, {
        method: 'PUT',
        body: JSON.stringify({ body }),
      })
      setEditing(false)
      onChange?.()
    } catch (e2) {
      setErr(e2?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const del = async () => {
    setBusy(true); setErr(null)
    try {
      await apiFetch(`/api/posts/${postId}/comments/${comment.id}`, { method: 'DELETE' })
      onChange?.()
    } catch (e2) {
      setErr(e2?.message || 'Delete failed')
      setBusy(false)
    }
  }

  return (
    <div className="bg-card border border-lightgray px-4 py-3 mb-2">
      <div className="flex items-center justify-between mb-1 gap-2">
        <strong className="text-[0.82rem] font-semibold truncate">{comment.author?.name || 'Unknown'}</strong>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[0.7rem] text-gray shrink-0">{formatRelative(comment.created_at)}</span>
          {(canEdit || canDelete) && !editing && (
            <div className="flex items-center gap-0.5">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => { setEditing(true); setDraft(comment.body); setErr(null) }}
                  className="text-[0.66rem] font-archivo font-extrabold uppercase tracking-wider text-gray hover:text-navy px-1.5 py-1 bg-transparent border-none cursor-pointer"
                  aria-label="Edit comment"
                >
                  Edit
                </button>
              )}
              {canDelete && !confirm && (
                <button
                  type="button"
                  onClick={() => setConfirm(true)}
                  className="text-[0.66rem] font-archivo font-extrabold uppercase tracking-wider text-gray hover:text-danger px-1.5 py-1 bg-transparent border-none cursor-pointer"
                  aria-label="Delete comment"
                >
                  Delete
                </button>
              )}
              {canDelete && confirm && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={del}
                    disabled={busy}
                    className="text-[0.66rem] font-archivo font-extrabold uppercase tracking-wider text-white bg-danger hover:bg-[#6a1313] px-2 py-1 border-none cursor-pointer disabled:opacity-60"
                  >
                    {busy ? '...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm(false)}
                    disabled={busy}
                    className="text-[0.66rem] font-archivo font-extrabold uppercase tracking-wider text-gray hover:text-ink px-1.5 py-1 bg-transparent border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {editing ? (
        <form onSubmit={save} className="mt-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            disabled={busy}
            className="w-full border border-lightgray bg-white px-3 py-2 text-[0.92rem] font-franklin resize-y focus:border-navy focus:ring-2 focus:ring-navy/20 outline-none"
          />
          {err && <div className="text-[0.72rem] text-danger font-archivo font-bold mt-1">{err}</div>}
          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              disabled={busy}
              className="bg-navy text-gold border-none py-1.5 px-3 font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider cursor-pointer hover:bg-[#132d4a] transition-colors disabled:opacity-60"
            >
              {busy ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => { setEditing(false); setDraft(comment.body); setErr(null) }}
              className="bg-transparent border border-lightgray py-1.5 px-3 font-archivo text-[0.66rem] font-extrabold uppercase tracking-wider text-gray hover:text-ink cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="text-[0.9rem] text-ink leading-relaxed whitespace-pre-wrap">
          {comment.body}
        </div>
      )}
      {err && !editing && (
        <div className="text-[0.72rem] text-danger font-archivo font-bold mt-1">{err}</div>
      )}
    </div>
  )
}

export default PostDetail
