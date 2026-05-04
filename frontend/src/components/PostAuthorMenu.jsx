import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
 *
 * Visual polish (May 2026):
 *  - Dropdown fades + scales in via framer-motion so it feels lifted off
 *    the card instead of popping abruptly.
 *  - Delete confirmation is a centered modal (DeleteConfirmModal below)
 *    rather than a cramped inline panel inside the dropdown — matches the
 *    pattern used by NewPostModal / EditProfileModal / ReportPostModal,
 *    and avoids the previous bug where the inline confirm got clipped on
 *    posts near the bottom of the viewport.
 */
function PostAuthorMenu({ post, onDeleted, onUpdated, variant = 'light' }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [reported, setReported] = useState(() => loadReportedSet().has(post?.id))
  const rootRef = useRef(null)

  // Close on outside click + Esc. Only listen while the dropdown is open;
  // the delete modal owns its own outside/Esc handling so it doesn't fight
  // with this listener.
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null
  const isAuthor = post.author_id === user.id
  const isMod = user.role === 'moderator' || user.role === 'admin'
  const canReport = !isAuthor

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

  const openDelete = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setShowDeleteConfirm(true)
    setOpen(false)
  }

  const onReportSuccess = (postId) => {
    rememberReported(postId)
    setReported(true)
  }

  // Subtle border + slightly darker glyph by default so the kebab reads as
  // a real button without competing with the post content.
  const lightBtn = 'text-ink/70 hover:text-ink border border-lightgray hover:border-navy bg-card hover:bg-offwhite'
  const darkBtn = 'text-white/75 hover:text-white border border-white/20 hover:border-white/50 bg-transparent hover:bg-white/10'

  return (
    <div className="relative" ref={rootRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Post actions"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v) }}
        className={`w-9 h-9 flex items-center justify-center rounded-full cursor-pointer transition-colors ${variant === 'dark' ? darkBtn : lightBtn} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -2, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 0.61, 0.36, 1] }}
            className="absolute right-0 top-[calc(100%+6px)] w-[200px] bg-card border border-lightgray rounded-md overflow-hidden shadow-[0_12px_32px_-12px_rgba(11,29,52,0.35)] z-[60] text-ink origin-top-right"
            style={{ transformOrigin: 'top right' }}
          >
            {isAuthor && (
              <MenuItem onClick={openEdit} icon={IconPencil} label="Edit post" />
            )}
            {canReport && (
              <MenuItem
                onClick={openReport}
                icon={IconFlag}
                label={reported ? 'Reported · pending review' : 'Report post'}
                disabled={reported}
                divided={isAuthor}
                tone={reported ? 'muted' : 'default'}
              />
            )}
            {(isAuthor || isMod) && (
              <MenuItem
                onClick={openDelete}
                icon={IconTrash}
                label={isAuthor ? 'Delete post' : 'Delete (mod)'}
                tone="danger"
                divided={isAuthor || canReport}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

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

      <DeleteConfirmModal
        open={showDeleteConfirm}
        post={post}
        isMod={isMod && !isAuthor}
        onClose={() => setShowDeleteConfirm(false)}
        onDeleted={() => {
          setShowDeleteConfirm(false)
          onDeleted?.(post.id)
        }}
      />
    </div>
  )
}

/**
 * MenuItem — single row inside the kebab dropdown. Tone variants:
 *   - default → ink text, hover offwhite
 *   - danger  → red text, hover red-tinted bg
 *   - muted   → gray, no hover, non-interactive (used for "Reported")
 *
 * `divided` adds a top border so the visual rhythm of multi-section menus
 * stays clean (e.g. Edit | Report | Delete).
 */
function MenuItem({ onClick, icon: Icon, label, tone = 'default', disabled, divided }) {
  const toneCls =
    tone === 'danger'
      ? 'text-danger hover:bg-danger-bg'
      : tone === 'muted'
      ? 'text-gray cursor-default'
      : 'text-ink hover:bg-offwhite cursor-pointer'
  const dividerCls = divided ? 'border-t border-divider' : ''
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-4 py-2.5 text-[0.84rem] font-archivo font-semibold bg-transparent border-none transition-colors flex items-center gap-2.5 ${toneCls} ${dividerCls} disabled:cursor-default`}
    >
      <Icon />
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// DeleteConfirmModal — centered, animated, with a clear "can't be undone"
// callout and a proper loading state so the user gets feedback while the
// API round-trips.
// ---------------------------------------------------------------------------

function DeleteConfirmModal({ open, post, isMod, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  // Reset state every time the modal opens.
  useEffect(() => {
    if (open) {
      setDeleting(false)
      setError(null)
    }
  }, [open])

  // Esc to close — but only when not actively deleting (avoid leaving a
  // half-completed request hanging if the user mashes Esc).
  useEffect(() => {
    if (!open || deleting) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, deleting, onClose])

  // Body scroll lock while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const doDelete = async () => {
    if (deleting) return
    setDeleting(true)
    setError(null)
    try {
      await apiFetch(`/api/posts/${post.id}`, { method: 'DELETE' })
      onDeleted?.()
    } catch (err) {
      setError(err?.message || 'Could not delete that post. Try again in a moment.')
      setDeleting(false)
    }
  }

  const titlePreview = (post?.title || '').trim()
  const previewText = titlePreview.length > 80 ? `${titlePreview.slice(0, 80)}…` : titlePreview

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-heading"
          className="fixed inset-0 bg-navy/60 z-[200] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) onClose() }}
        >
          <motion.div
            className="bg-card w-full max-w-[420px] border-t-[3px] border-danger shadow-[0_24px_60px_-20px_rgba(11,29,52,0.55)] overflow-hidden"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {/* Hero — danger-toned masthead with trash icon */}
            <div className="bg-danger-bg border-b border-danger/20 px-6 py-5 flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-full bg-danger/12 text-danger flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="font-archivo text-[0.6rem] font-extrabold uppercase tracking-[0.22em] text-danger">
                  {isMod ? 'Moderator action' : 'Final call'}
                </div>
                <h3
                  id="delete-confirm-heading"
                  className="font-editorial italic font-black text-navy text-[1.25rem] leading-tight mt-1"
                >
                  Delete this post?
                </h3>
                {previewText && (
                  <p className="mt-2 text-[0.86rem] text-ink/85 font-franklin leading-snug">
                    "{previewText}"
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 py-5">
              <p className="text-[0.88rem] text-ink/85 font-franklin leading-relaxed">
                {isMod
                  ? "This removes the post for everyone. Comments, votes, and any reports filed against it will be cleared too."
                  : "This can't be undone. The post — along with its comments and votes — will disappear from the feed."}
              </p>

              {error && (
                <div className="mt-3 bg-danger-bg border border-danger/30 text-danger px-3 py-2 text-[0.82rem] font-archivo font-bold" role="alert">
                  {error}
                </div>
              )}

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={deleting}
                  className="bg-transparent border border-lightgray text-gray hover:text-ink hover:border-gray min-h-[40px] py-2 px-4 font-archivo text-[0.72rem] font-extrabold uppercase tracking-wide cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={doDelete}
                  disabled={deleting}
                  className="bg-danger text-white border-none min-h-[40px] py-2 px-5 font-archivo text-[0.72rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#6a1313] transition-colors disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {deleting && (
                    <span
                      aria-hidden
                      className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin"
                    />
                  )}
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Inline icons. Kept small so they color-inherit and don't pull in another
// icon-set import.
// ---------------------------------------------------------------------------

function IconPencil() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}

function IconFlag() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 21V4a1 1 0 0 1 1-1h11l-2 5 2 5H5" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

export default PostAuthorMenu
