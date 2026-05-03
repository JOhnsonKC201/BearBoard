import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useChatSocket } from '../hooks/useChatSocket'
import { parseUtcDate } from '../utils/format'

// Group chat — Phase 1, plus US-2 attachments.
//
// Reuses the existing chat WebSocket (`/api/chat/ws?token=...`) by listening
// for the new `group_message` and `group_message_updated` frame types and
// sending `group_send` / `group_edit` frames back. Initial history comes
// from the REST endpoint added in routers/group_chat.py.
//
// Membership-gated: the parent `GroupDetail` only renders this panel when
// `isMember` is true, so we don't have to re-check here.
//
// Edit support is owner-only with a 15-minute window — same contract the
// 1-on-1 chat already has. The server enforces it; the client mirrors the
// window to gate the Edit affordance so we don't render a button for a
// message we know the server will reject.
//
// Attachments (US-2): a member can attach a single file (image / PDF /
// document) per message via the paperclip button. Bytes go directly to
// Cloudinary (the backend never sees them). The send frame carries
// attachment_url / attachment_name / attachment_kind alongside the body.

const EDIT_WINDOW_MS = 15 * 60 * 1000

// Cloudinary unsigned upload — same env-var contract as ImageUploader.jsx.
// When unconfigured (local dev / CI), the paperclip button is disabled with
// a tooltip rather than silently failing.
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const CLOUDINARY_ENABLED = Boolean(CLOUD_NAME && UPLOAD_PRESET)
const ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024 // 15 MB — fits a typical lecture-slide PDF
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const PDF_MIMES = new Set(['application/pdf'])
const DOC_MIMES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
])

function classifyKind(file) {
  if (!file) return 'other'
  if (IMAGE_MIMES.has(file.type)) return 'image'
  if (PDF_MIMES.has(file.type)) return 'pdf'
  if (DOC_MIMES.has(file.type)) return 'doc'
  return 'other'
}

function endpointForKind(kind) {
  // Cloudinary serves images via `/image/upload` and everything else via
  // `/raw/upload`. Mismatching the endpoint leads to a 400 and a useless
  // error, so we route off the kind we already classified.
  return kind === 'image' ? 'image' : 'raw'
}

function uploadAttachment(file, kind, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    form.append('upload_preset', UPLOAD_PRESET)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${endpointForKind(kind)}/upload`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText || '{}')
        if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) resolve(res.secure_url)
        else reject(new Error(res?.error?.message || `Upload failed (${xhr.status})`))
      } catch {
        reject(new Error('Upload response could not be parsed'))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(form)
  })
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtTime(iso) {
  if (!iso) return ''
  const d = parseUtcDate(iso)
  if (!d || Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function withinEditWindow(iso) {
  if (!iso) return false
  const d = parseUtcDate(iso)
  const t = d ? d.getTime() : NaN
  if (Number.isNaN(t)) return false
  return Date.now() - t < EDIT_WINDOW_MS
}

function GroupChatPanel({ groupId }) {
  const { user, token } = useAuth()
  const meId = user?.id
  const [messages, setMessages] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  // Staged attachment: a single file the user has uploaded but not yet sent.
  // Cleared after a successful send (or when they hit the X).
  const [pendingAttachment, setPendingAttachment] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef(null)
  const scrollerRef = useRef(null)
  const errorTimerRef = useRef(null)

  // Initial load. Refetched whenever groupId changes (rare in practice
  // since we live inside GroupDetail) so a navigation between groups
  // resets the history view.
  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    setHistoryLoading(true)
    setHistoryError(null)
    apiFetch(`/api/groups/${groupId}/messages?limit=50`, { cache: false })
      .then((data) => {
        if (cancelled) return
        setMessages(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (cancelled) return
        setHistoryError(err?.message || 'Could not load chat history')
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })
    return () => { cancelled = true }
  }, [groupId])

  // Live message arrives → append (or merge if dupe). The server echoes
  // the sender's own message back through this same path so we don't need
  // a separate optimistic-then-replace flow.
  const handleGroupMessage = useCallback((frame) => {
    if (frame.group_id !== groupId) return
    setMessages((prev) => {
      if (prev.some((m) => m.id === frame.id)) return prev
      return [...prev, frame]
    })
  }, [groupId])

  // A message was edited (by us or someone else) — patch in place.
  const handleGroupMessageUpdated = useCallback((frame) => {
    if (frame.group_id !== groupId) return
    setMessages((prev) => prev.map((m) => (
      m.id === frame.id ? { ...m, body: frame.body, edited_at: frame.edited_at } : m
    )))
  }, [groupId])

  const handleError = useCallback((frame) => {
    const detail = frame?.detail || frame?.code || 'Something went wrong.'
    setErrorMsg(String(detail))
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 4000)
  }, [])

  const { send, status } = useChatSocket({
    token,
    onGroupMessage: handleGroupMessage,
    onGroupMessageUpdated: handleGroupMessageUpdated,
    onError: handleError,
  })

  // Auto-scroll to bottom on new messages. Only fires when the user is
  // already near the bottom — preserves their position if they scrolled
  // up to read older messages.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length])

  // File ingest: classify, validate size, upload to Cloudinary, then stash
  // as `pendingAttachment` so the user can still type a caption and review
  // before hitting Send.
  const ingestFile = async (file) => {
    if (!file || uploading || !CLOUDINARY_ENABLED) return
    if (file.size > ATTACHMENT_MAX_BYTES) {
      setErrorMsg(`File is ${humanSize(file.size)} — max is ${humanSize(ATTACHMENT_MAX_BYTES)}`)
      return
    }
    const kind = classifyKind(file)
    setUploading(true)
    setUploadProgress(0)
    setErrorMsg(null)
    try {
      const url = await uploadAttachment(file, kind, setUploadProgress)
      setPendingAttachment({ url, name: file.name, kind })
    } catch (err) {
      setErrorMsg(err?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onPickFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file after removal
    await ingestFile(file)
  }

  const clearPendingAttachment = () => setPendingAttachment(null)

  const submit = (e) => {
    e.preventDefault()
    const body = draft.trim()
    const hasAttachment = Boolean(pendingAttachment?.url)
    // Either text or an attachment is required — mirrors the backend
    // model_validator. Don't fire an empty send.
    if ((!body && !hasAttachment) || sending || uploading) return
    setSending(true)
    setErrorMsg(null)

    const wireFrame = {
      type: 'group_send',
      group_id: groupId,
      body,
      ...(hasAttachment && {
        attachment_url: pendingAttachment.url,
        attachment_name: pendingAttachment.name,
        attachment_kind: pendingAttachment.kind,
      }),
    }
    const restPayload = {
      body,
      ...(hasAttachment && {
        attachment_url: pendingAttachment.url,
        attachment_name: pendingAttachment.name,
        attachment_kind: pendingAttachment.kind,
      }),
    }
    const ok = send(wireFrame)
    if (!ok) {
      // Socket isn't open — fall back to the REST endpoint so the message
      // still goes through. The server will broadcast to other members.
      apiFetch(`/api/groups/${groupId}/messages`, {
        method: 'POST',
        body: JSON.stringify(restPayload),
      })
        .then((msg) => {
          // Echo into our own list since the WS isn't there to do it for us.
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])
          setDraft('')
          setPendingAttachment(null)
        })
        .catch((err) => setErrorMsg(err?.message || 'Send failed'))
        .finally(() => setSending(false))
    } else {
      setDraft('')
      setPendingAttachment(null)
      setSending(false)
    }
  }

  const beginEdit = (msg) => {
    setEditingId(msg.id)
    setEditDraft(msg.body)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft('')
  }

  const submitEdit = () => {
    const next = editDraft.trim()
    if (!next || !editingId) return
    const target = messages.find((m) => m.id === editingId)
    if (target && next === target.body) {
      cancelEdit()
      return
    }
    const ok = send({ type: 'group_edit', message_id: editingId, body: next })
    if (!ok) {
      // REST fallback if the socket is mid-reconnect.
      apiFetch(`/api/groups/${groupId}/messages/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ body: next }),
      })
        .then((msg) => {
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)))
          cancelEdit()
        })
        .catch((err) => setErrorMsg(err?.message || 'Edit failed'))
    } else {
      // Optimistic close. The server's `group_message_updated` frame will
      // overwrite the body shortly with the canonical version.
      cancelEdit()
    }
  }

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const ta = parseUtcDate(a.created_at)?.getTime() || 0
      const tb = parseUtcDate(b.created_at)?.getTime() || 0
      return ta - tb
    })
  }, [messages])

  return (
    <section className="bg-card border border-lightgray flex flex-col" aria-label="Group chat">
      <header className="px-5 py-3 border-b border-lightgray flex items-center justify-between">
        <h2 className="font-archivo font-extrabold text-mini uppercase tracking-wider m-0">
          Group chat
        </h2>
        {status !== 'open' && (
          <span className="text-[0.62rem] font-archivo font-extrabold uppercase tracking-[0.1em] px-2 py-1 border bg-gold/15 text-gold border-gold/30">
            {status === 'reconnecting' ? 'Reconnecting' : status === 'connecting' ? 'Connecting' : 'Offline'}
          </span>
        )}
      </header>

      <div ref={scrollerRef} className="px-5 py-4 max-h-[480px] min-h-[260px] overflow-y-auto bg-offwhite flex flex-col gap-3">
        {historyLoading && (
          <div className="text-center text-gray text-[0.82rem] py-6">Loading messages…</div>
        )}
        {historyError && (
          <div className="text-center text-danger text-[0.82rem] py-6 font-archivo font-bold">{historyError}</div>
        )}
        {!historyLoading && !historyError && sortedMessages.length === 0 && (
          <div className="text-center text-gray text-[0.82rem] py-6 font-prose italic">
            No messages yet. Be the first to say something.
          </div>
        )}
        {sortedMessages.map((m) => {
          const mine = m.author_id === meId
          const canEdit = mine && withinEditWindow(m.created_at)
          const editing = editingId === m.id
          const authorName = m.author?.name || (mine ? 'You' : 'Member')
          return (
            <div key={m.id} className={`group flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <div className="text-[0.62rem] font-archivo font-extrabold uppercase tracking-[0.1em] text-gray/70 px-1 mb-1">
                {authorName}
              </div>
              <div className="flex items-end gap-1.5 max-w-full">
                <div className={`px-4 py-2 max-w-[78%] font-franklin text-[0.92rem] leading-[1.45] whitespace-pre-wrap break-words rounded-2xl ${
                  mine ? 'bg-navy text-white rounded-br-md' : 'bg-white text-ink border border-lightgray rounded-bl-md'
                }`}>
                  {editing ? (
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            submitEdit()
                          } else if (e.key === 'Escape') {
                            e.preventDefault()
                            cancelEdit()
                          }
                        }}
                        rows={2}
                        maxLength={4000}
                        className="resize-none rounded-md bg-white/10 text-inherit px-2 py-1 font-franklin text-[0.92rem] leading-snug focus:outline-none focus:ring-2 focus:ring-gold/40"
                        autoFocus
                      />
                      <div className="flex gap-2 text-[0.7rem] font-archivo font-extrabold uppercase tracking-[0.08em]">
                        <button type="button" onClick={submitEdit} className="bg-gold text-navy px-2.5 py-1 rounded-md cursor-pointer border-0 hover:opacity-90">Save</button>
                        <button type="button" onClick={cancelEdit} className="bg-transparent text-current/80 px-2.5 py-1 rounded-md cursor-pointer border border-current/30 hover:border-current/60">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {m.body && <div>{m.body}</div>}
                      {m.attachment_url && (
                        <MessageAttachment
                          url={m.attachment_url}
                          name={m.attachment_name}
                          kind={m.attachment_kind}
                          mine={mine}
                          hasBody={Boolean(m.body)}
                        />
                      )}
                    </>
                  )}
                </div>
                {canEdit && !editing && (
                  <button
                    type="button"
                    onClick={() => beginEdit(m)}
                    title="Edit message"
                    aria-label="Edit message"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[0.7rem] font-archivo font-extrabold uppercase tracking-[0.08em] text-gray/70 hover:text-navy bg-transparent border-0 cursor-pointer px-1.5 py-1"
                  >
                    Edit
                  </button>
                )}
              </div>
              <span className="text-[0.62rem] font-archivo uppercase tracking-[0.08em] text-gray/60 px-1 mt-1 flex items-center gap-1.5">
                <span>{fmtTime(m.created_at)}</span>
                {m.edited_at && <span className="text-gray/60" title={`Edited ${fmtTime(m.edited_at)}`}>· edited</span>}
              </span>
            </div>
          )
        })}
      </div>

      {errorMsg && (
        <div className="border-t border-red-200 bg-red-50 text-red-700 px-4 py-2 text-[0.78rem] font-franklin">
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={submit}
        className="border-t border-lightgray bg-white px-4 py-3 flex flex-col gap-2"
      >
        {/* Staged attachment preview — sits above the input row so the user
            sees what's about to be sent. Removing it doesn't unwind the
            Cloudinary upload (we just don't reference the URL); orphan
            uploads are tolerable for unsigned uploads. */}
        {pendingAttachment && (
          <div className="flex items-center gap-3 bg-offwhite border border-lightgray rounded-md px-3 py-2 text-[0.82rem] font-franklin">
            <span aria-hidden className="text-[1.05rem] leading-none">
              {pendingAttachment.kind === 'image' ? '🖼️' : pendingAttachment.kind === 'pdf' ? '📄' : '📎'}
            </span>
            <span className="flex-1 truncate text-ink">{pendingAttachment.name}</span>
            <button
              type="button"
              onClick={clearPendingAttachment}
              aria-label="Remove attachment"
              className="text-gray hover:text-danger bg-transparent border-0 cursor-pointer text-[0.78rem] font-archivo font-extrabold uppercase tracking-[0.08em]"
            >
              Remove
            </button>
          </div>
        )}
        {uploading && (
          <div className="text-[0.74rem] text-gray font-franklin">
            Uploading… {uploadProgress}%
            <div className="mt-1 h-[3px] bg-lightgray overflow-hidden rounded">
              <div className="h-full bg-navy transition-[width] duration-150" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
        <div className="flex items-end gap-2">
          {/* Paperclip — opens the file picker. Disabled when Cloudinary
              isn't configured so the click never silently fails. */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!CLOUDINARY_ENABLED || uploading || sending || Boolean(pendingAttachment)}
            title={
              !CLOUDINARY_ENABLED
                ? 'File uploads aren\'t configured on this site'
                : pendingAttachment
                ? 'Remove the current attachment first'
                : 'Attach a file (image, PDF, doc) — up to 15 MB'
            }
            aria-label="Attach a file"
            className="shrink-0 h-[42px] w-[42px] flex items-center justify-center rounded-xl border border-lightgray bg-offwhite text-gray hover:text-navy hover:border-navy/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md"
            onChange={onPickFile}
            className="hidden"
            disabled={uploading || sending}
          />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit(e)
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder={pendingAttachment ? 'Add a caption (optional)…' : 'Message the group…'}
            disabled={sending}
            className="flex-1 resize-none rounded-xl border border-lightgray bg-offwhite px-4 py-2.5 font-franklin text-[0.92rem] text-ink leading-snug focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-gold/20 min-h-[42px] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={(!draft.trim() && !pendingAttachment) || sending || uploading}
            className="bg-navy text-white font-archivo font-black uppercase tracking-[0.08em] text-[0.7rem] px-5 py-2.5 rounded-xl hover:bg-[#13284a] disabled:opacity-30 disabled:cursor-not-allowed transition-all border-0 cursor-pointer h-[42px]"
          >
            Send
          </button>
        </div>
      </form>
    </section>
  )
}

// Inline image preview for image kinds, download-chip for everything else.
// Sits inside the message bubble, so styling adapts to mine vs. theirs.
function MessageAttachment({ url, name, kind, mine, hasBody }) {
  const safeName = name || url.split('/').pop() || 'attachment'
  const wrapperMargin = hasBody ? 'mt-2' : ''
  if (kind === 'image') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`block ${wrapperMargin} rounded-lg overflow-hidden border ${mine ? 'border-white/20' : 'border-lightgray'}`}
        title={safeName}
      >
        <img
          src={url}
          alt={safeName}
          loading="lazy"
          decoding="async"
          className="block max-w-[280px] max-h-[280px] w-auto h-auto object-contain bg-black/5"
        />
      </a>
    )
  }
  // Generic download chip — used for pdf / doc / other.
  const icon = kind === 'pdf' ? '📄' : kind === 'doc' ? '📝' : '📎'
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={safeName}
      className={`${wrapperMargin} flex items-center gap-2 rounded-md px-2.5 py-2 text-[0.82rem] no-underline ${
        mine
          ? 'bg-white/10 text-white hover:bg-white/15'
          : 'bg-offwhite text-navy hover:bg-gold-pale/40 border border-lightgray'
      }`}
      title={safeName}
    >
      <span aria-hidden className="text-[1rem] leading-none">{icon}</span>
      <span className="flex-1 truncate font-franklin">{safeName}</span>
      <span className={`text-[0.62rem] font-archivo font-extrabold uppercase tracking-[0.08em] ${mine ? 'text-white/70' : 'text-gold'}`}>
        Open
      </span>
    </a>
  )
}

export default GroupChatPanel
