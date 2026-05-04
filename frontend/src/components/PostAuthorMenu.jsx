import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api/client'
import { useAuth } from '../context/AuthContext'
import EditPostModal from './EditPostModal'
import ReportPostModal from './ReportPostModal'

// localStorage key for "I already reported this" state. Cheap, per-browser
// memory of which posts the current user has flagged so we can swap the
// menu copy to "Reported" without an extra fetch on every render. Backend
// remains the source of truth — the unique constraint there blocks any
// real duplicate even if this storage is cleared.
const REPORTED_KEY = 'bb:reported-post-ids'

function loadReportedSet() {
  try {
    const raw = localStorage.getItem(REPORTED_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch { return new Set() }
}

function rememberReported(id) {
  try {
    const set = loadReportedSet()
    set.add(id)
    localStorage.setItem(REPORTED_KEY, JSON.stringify(Array.from(set)))
  } catch { /* storage unavailable — non-fatal */ }
}

/**
 * PostAuthorMenu — three-dot kebab on a post card. Renders for every
 * authed user with a context-appropriate menu:
 *
 * - Author      → Edit, Delete
 * - Moderator   → Delete (mod), Report (if not also author)
 * - Other authed user → Report
 * - Logged-out  → not rendered
 *
 * `onDeleted(id)` runs after a successful delete; `onUpdated(post)` runs
 * after a successful edit. Reporting fires-and-forgets — no list-state
 * mutation is needed, the modal handles its own success UI.
 */
function PostAuthorMenu({ post, onDeleted, onUpdated, variant = 'light' }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [err, setErr] = useState(null)
  const [reported, setReported] = useState(() => loadReportedSet().has(post?.id))
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
  // Anyone authed who isn't the author can file a report. Moderators get
  // both Report and the delete button — they often want to act fast on
  // egregious posts without going through the queue, and Report still
  // logs an audit trail of why they were looking.
  const canReport = !isAuthor

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

  const openReport = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setShowReport(true)
    setOpen(false)
  }

  const onReportSuccess = (postId) => {
    rememberReported(postId)
    setReported(true)
  }

  // The kebab needs to be discoverable at a glance — previously it was
  // text-gray with no border, blending into cream backgrounds so users
  // missed the entry point for edit/delete entirely. Now it carries a
  // subtle border + slightly darker glyph by default so it reads as a
  // real button without competing with the content.
  const lightBtn = 'text-ink/70 hover:text-ink border border-lightgray hover:border-navy bg-card hover:bg-offwhite'
  const darkBtn = 'text-white/75 hover:text-white border border-white/20 hover:border-white/50 bg-transparent hover:bg-white/10'

  return (
    <div className="relative" ref={rootRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Post actions"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); setConfirm(false) }}
        className={`w-9 h-9 flex items-center justify-center rounded-full cursor-pointer transition-colors ${variant === 'dark' ? darkBtn : lightBtn} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60`}
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
          {canReport && (
            <button
              type="button"
              role="menuitem"
              onClick={openReport}
              disabled={reported}
              className={`w-full text-left px-4 py-2.5 text-[0.82rem] font-archivo font-semibold bg-transparent border-none flex items-center gap-2.5 ${
                isAuthor ? 'border-t border-divider' : ''
              } ${
                reported
                  ? 'text-gray cursor-default'
                  : 'cursor-pointer hover:bg-offwhite text-ink'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 21V4a1 1 0 0 1 1-1h11l-2 5 2 5H5" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
              {reported ? 'Reported · pending review' : 'Report post'}
            </button>
          )}
          {(isAuthor || isMod) && !confirm ? (
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
          ) : confirm ? (
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
          ) : null}
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

      <ReportPostModal
        post={post}
        open={showReport}
        onClose={() => setShowReport(false)}
        onReported={onReportSuccess}
      />
    </div>
  )
}

export default PostAuthorMenu
