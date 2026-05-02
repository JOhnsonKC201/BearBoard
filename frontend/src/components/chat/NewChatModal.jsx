import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../../api/client'

function initialsFor(name) {
  if (!name) return '?'
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

function NewChatModal({ open, onClose, onPick }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setResults([])
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const term = q.trim()
    if (!term) {
      // Clearing the input must also clear loading — otherwise the
      // "Searching…" line lingers forever.
      setResults([])
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    const id = setTimeout(() => {
      apiFetch(`/api/chat/users/search?q=${encodeURIComponent(term)}`)
        .then((data) => { if (!cancelled) setResults(Array.isArray(data) ? data : []) })
        .catch((e) => { if (!cancelled) setError(e.message || 'Search failed') })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 200)
    return () => { cancelled = true; clearTimeout(id) }
  }, [q, open])

  // Close on Esc.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] bg-navy/50 flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md border-t-[3px] border-gold shadow-[0_24px_60px_-20px_rgba(11,29,52,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 border-b border-lightgray flex items-center justify-between">
          <h3 className="font-archivo font-black text-navy text-[1.05rem] tracking-tight">
            Start a new chat
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center text-gray/70 hover:text-navy hover:bg-offwhite rounded bg-transparent border-0 cursor-pointer text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 border-b border-lightgray">
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email"
            className="w-full bg-offwhite border border-lightgray rounded px-3 py-2.5 font-franklin text-[0.92rem] text-ink focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-gold/20"
          />
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {loading && (
            <div className="px-5 py-3 text-[0.78rem] font-franklin text-gray/70">Searching…</div>
          )}
          {error && (
            <div className="px-5 py-3 text-[0.78rem] font-franklin text-red-700">{error}</div>
          )}
          {!loading && !error && q.trim() && results.length === 0 && (
            <div className="px-5 py-6 text-[0.82rem] font-franklin text-gray/70 text-center">
              No matches.
            </div>
          )}
          {!loading && !q.trim() && (
            <div className="px-5 py-6 text-[0.82rem] font-franklin text-gray/70">
              Type a name to find someone on BearBoard.
            </div>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => { onPick(u); onClose() }}
              className="w-full flex items-center gap-3 px-5 py-3 text-left bg-transparent border-0 border-b border-lightgray/50 hover:bg-offwhite cursor-pointer"
            >
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover ring-1 ring-lightgray" />
              ) : (
                <span className="w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center font-archivo font-extrabold text-[0.78rem]">
                  {initialsFor(u.name)}
                </span>
              )}
              <span className="flex-1 min-w-0">
                <span className="block font-archivo font-bold text-[0.9rem] text-ink truncate">{u.name}</span>
                {u.major && (
                  <span className="block text-[0.72rem] font-franklin text-gray/70 truncate">{u.major}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default NewChatModal
