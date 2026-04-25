import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api/client'
import { useAuth } from '../context/AuthContext'
import EditPostModal from './EditPostModal'

/**
 * PostAuthorMenu — three-dot kebab shown on a post card when the
 * current user is the author (or a moderator for delete).
 *
 * - Author sees: Edit, Delete
 * - Moderator/admin (not author) sees: Delete only
 * - Everyone else: the menu doesn't render at all
 *
 * `onDeleted(id)` is called after a successful delete so the caller
 * can remove the post from its local state without a refetch.
 * `onUpdated(post)` is called after an edit so the caller can replace
 * the post record with the updated one.
 */
function PostAuthorMenu({ post, onDeleted, onUpdated, variant = 'light' }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [err, setErr] = useState(null)
  const rootRef = useRef(null)

  // Close on outside click + Esc.
  useEffect(() => {
    if (!open && !confirm) return
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false); setConfirm(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); setConfirm(false) }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, confirm])

  if (!user) return null
  const isAuthor = post.author_id === user.id
  const isMod = user.role === 'moderator' || user.role === 'admin'
  if (!isAuthor && !isMod) return null

  const doDelete = async (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (deleting) return
    setDeleting(true); setErr(null)
    try {
      await apiFetch(`/api/posts/${post.id}`, { method: 'DELETE' })
      setOpen(false); setConfirm(false)
      onDeleted?.(post.id)
    } catch (e2) {
      setErr(e2?.message || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const openEdit = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setShowEdit(true)
    setOpen(false)
  }

  const lightBtn = 'text-gray hover:text-ink hover:bg-offwhite'
  const darkBtn = 'text-white/60 hover:text-white hover:bg-white/10'

  return (
    <div className="relative" ref={rootRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Post actions"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); setConfirm(false) }}
        className={`w-10 h-10 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer transition-colors ${variant === 'dark' ? darkBtn : lightBtn} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] w-[180px] bg-card border border-lightgray shadow-[0_8px_26px_-14px_rgba(11,29,52,0.35)] z-[60] text-ink"
        >
          {isAuthor && (
            <button
              type="button"
              role="menuitem"
              onClick={openEdit}
              className="w-full text-left px-4 py-2.5 text-[0.82rem] font-archivo font-semibold bg-transparent border-none cursor-pointer hover:bg-offwhite flex items-center gap-2.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
              Edit post
            </button>
          )}
          {!confirm ? (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); setConfirm(true) }}
              className="w-full text-left px-4 py-2.5 text-[0.82rem] font-archivo font-semibold bg-transparent border-none cursor-pointer hover:bg-danger-bg text-danger flex items-center gap-2.5 border-t border-divider"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              {isAuthor ? 'Delete post' : 'Delete (mod)'}
            </button>
          ) : (
            <div className="px-4 py-3 border-t border-divider bg-danger-bg/50">
              <div className="text-[0.78rem] font-archivo font-bold text-danger mb-2">
                Delete this post?
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={doDelete}
                  disabled={deleting}
                  className="bg-danger text-white border-none py-1.5 px-3 font-archivo text-[0.7rem] font-extrabold uppercase tracking-wide cursor-pointer disabled:opacity-60 hover:bg-[#6a1313] transition-colors"
                >
                  {deleting ? '...' : 'Yes, delete'}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setConfirm(false) }}
                  disabled={deleting}
                  className="bg-transparent border border-lightgray py-1.5 px-3 font-archivo text-[0.7rem] font-extrabold uppercase tracking-wide text-gray hover:text-ink cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              {err && (
                <div className="text-[0.7rem] text-danger font-archivo font-bold mt-2">{err}</div>
              )}
            </div>
          )}
        </div>
      )}

      {showEdit && (
        <EditPostModal
          post={post}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setShowEdit(false)
            onUpdated?.(updated)
          }}
        />
      )}
    </div>
  )
}

export default PostAuthorMenu
