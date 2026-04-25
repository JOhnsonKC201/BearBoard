import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { useAuth } from '../context/AuthContext'

function Stars({ value, size = '1rem' }) {
  if (value == null) return <span className="text-gray text-[0.82rem] font-archivo">-</span>
  const rounded = Math.round(value * 2) / 2
  const full = Math.floor(rounded)
  const half = rounded - full === 0.5
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <span className="inline-flex items-center gap-[1px]" style={{ fontSize: size }} aria-label={`${value.toFixed(1)} out of 5`}>
      {Array.from({ length: full }).map((_, i) => <span key={`f${i}`} className="text-gold">&#9733;</span>)}
      {half && <span className="text-gold">&#189;</span>}
      {Array.from({ length: empty }).map((_, i) => <span key={`e${i}`} className="text-lightgray">&#9734;</span>)}
    </span>
  )
}

function ProfessorCard({ prof, onOpen, active }) {
  const hasRating = prof.avg_rating != null && prof.rating_count > 0
  return (
    <button
      onClick={() => onOpen(prof)}
      className={`w-full text-left bg-card border overflow-hidden transition-all hover:-translate-y-[1px] hover:shadow-[0_6px_20px_-10px_rgba(11,29,52,0.2)] ${
        active ? 'border-gold' : 'border-lightgray hover:border-navy'
      }`}
    >
      <div className="px-4 py-3.5 flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-navy text-gold flex items-center justify-center font-archivo font-black text-[0.78rem] shrink-0 ring-1 ring-black/5">
          {(prof.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-archivo font-bold text-[0.95rem] leading-tight truncate">{prof.name}</div>
          <div className="text-[0.7rem] text-gray uppercase tracking-wide font-archivo font-bold mt-0.5 truncate">
            {prof.department || 'Department unknown'}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {hasRating ? (
            <>
              <div className="flex items-center justify-end gap-1">
                <span className="text-gold text-[0.95rem] leading-none">&#9733;</span>
                <span className="font-archivo font-black text-navy text-[1.05rem] leading-none tabular-nums">
                  {prof.avg_rating.toFixed(1)}
                </span>
              </div>
              <div className="text-[0.64rem] text-gray uppercase tracking-wider font-archivo font-bold mt-1">
                {prof.rating_count} {prof.rating_count === 1 ? 'review' : 'reviews'}
              </div>
            </>
          ) : (
            <span className="inline-block font-archivo text-[0.6rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-full bg-offwhite text-gray border border-lightgray">
              Not yet rated
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// Human-friendly labels for a 1-5 rating. The index-0 entry is the
// placeholder shown before the student has hovered or selected anything.
const RATING_ADJECTIVES = ['Tap to rate', 'Awful', 'Meh', 'Decent', 'Great', 'Exceptional']
const DIFFICULTY_ADJECTIVES = ['Tap to rate', 'Easy', 'Manageable', 'Moderate', 'Challenging', 'Brutal']

function StarPicker({ value, onChange, max = 5, labels, size = 'lg' }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  const label = labels ? labels[shown] : ''
  const starSize = size === 'sm' ? 'text-[1.25rem]' : 'text-[1.9rem] sm:text-[2.1rem]'
  const btnPad = size === 'sm' ? 'p-0.5' : 'p-1 sm:p-1.5'
  return (
    <div>
      <div
        className="flex gap-1 items-center"
        onMouseLeave={() => setHover(0)}
        role="radiogroup"
        aria-label={labels ? labels[0] : 'Rating'}
      >
        {Array.from({ length: max }).map((_, i) => {
          const v = i + 1
          const on = shown >= v
          return (
            <button
              key={v}
              type="button"
              onMouseEnter={() => setHover(v)}
              onFocus={() => setHover(v)}
              onBlur={() => setHover(0)}
              onClick={() => onChange(v)}
              className={`bg-transparent border-none cursor-pointer leading-none transition-all ${btnPad} ${starSize} ${
                on
                  ? 'text-gold drop-shadow-[0_0_6px_rgba(212,150,42,0.35)] scale-[1.04]'
                  : 'text-lightgray hover:text-gold/70'
              } rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60`}
              role="radio"
              aria-checked={value === v}
              aria-label={`${v} ${v === 1 ? 'star' : 'stars'}${labels ? ` - ${labels[v]}` : ''}`}
            >
              <span aria-hidden>{on ? '★' : '☆'}</span>
            </button>
          )
        })}
        <span
          className={`ml-2 font-archivo font-extrabold text-[0.66rem] uppercase tracking-[0.18em] transition-colors ${
            shown ? 'text-navy' : 'text-gray/60'
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  )
}

function RatingForm({ professor, onSubmitted, onCancel, existing }) {
  const [rating, setRating] = useState(existing?.rating || 0)
  const [difficulty, setDifficulty] = useState(existing?.difficulty || 0)
  const [wouldTake, setWouldTake] = useState(existing?.would_take_again ?? null)
  const [course, setCourse] = useState(existing?.course_code || '')
  const [comment, setComment] = useState(existing?.comment || '')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!rating) { setErr('Pick an overall rating first.'); return }
    setSubmitting(true); setErr(null)
    try {
      await apiFetch(`/api/professors/${professor.id}/ratings`, {
        method: 'POST',
        body: JSON.stringify({
          rating,
          difficulty: difficulty || null,
          would_take_again: wouldTake,
          course_code: course || null,
          comment: comment || null,
        }),
      })
      onSubmitted()
    } catch (e2) {
      setErr(e2.message || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = rating > 0 && !submitting

  return (
    <form onSubmit={submit} className="bg-card border border-lightgray p-5 sm:p-6 space-y-6">
      <header className="border-b border-lightgray pb-3">
        <div className="font-archivo font-extrabold text-[0.6rem] uppercase tracking-[0.24em] text-gold mb-1">
          {existing ? 'Editing your review' : 'Rate this professor'}
        </div>
        <h3 className="font-archivo font-black text-[1.15rem] text-navy leading-tight">
          {professor.name}
        </h3>
        {professor.department && (
          <div className="text-[0.75rem] text-gray mt-0.5 font-archivo font-bold uppercase tracking-wider">
            {professor.department}
          </div>
        )}
      </header>

      {/* Teaching quality — overall rating, renamed for clarity. */}
      <section>
        <label className="block font-archivo font-extrabold text-[0.72rem] uppercase tracking-[0.18em] text-navy mb-0.5">
          Teaching quality <span className="text-red">*</span>
        </label>
        <div className="text-[0.76rem] text-gray mb-2 font-franklin">
          How well did they explain material, run the class, and answer questions?
        </div>
        <StarPicker value={rating} onChange={setRating} labels={RATING_ADJECTIVES} />
      </section>

      {/* Effort required — stored as "difficulty" on the backend. */}
      <section>
        <label className="block font-archivo font-extrabold text-[0.72rem] uppercase tracking-[0.18em] text-navy mb-0.5">
          Effort required
        </label>
        <div className="text-[0.76rem] text-gray mb-2 font-franklin">
          How hard did you have to work for the grade? Reading load, assignment volume, exam prep.
        </div>
        <StarPicker value={difficulty} onChange={setDifficulty} labels={DIFFICULTY_ADJECTIVES} />
      </section>

      {/* Would take again — same yes/no/unsure pill set, bigger tap targets. */}
      <section>
        <label className="block font-archivo font-extrabold text-[0.72rem] uppercase tracking-[0.18em] text-navy mb-2">
          Would you take them again?
        </label>
        <div className="flex gap-2 flex-wrap">
          {[
            { label: 'Yes',    v: true,  emoji: '👍' },
            { label: 'No',     v: false, emoji: '👎' },
            { label: 'Unsure', v: null,  emoji: '🤷' },
          ].map((opt) => {
            const active = wouldTake === opt.v
            return (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => setWouldTake(opt.v)}
                className={`inline-flex items-center gap-2 text-[0.78rem] font-archivo font-extrabold uppercase tracking-wide py-2.5 px-4 min-h-[44px] rounded-full border-2 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
                  active
                    ? 'bg-navy border-navy text-gold shadow-[0_2px_8px_-2px_rgba(11,29,52,0.35)]'
                    : 'bg-white border-lightgray text-ink/70 hover:border-navy hover:text-navy'
                }`}
                aria-pressed={active}
              >
                <span aria-hidden>{opt.emoji}</span>
                {opt.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Course code — optional but useful for filtering later. */}
      <section className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-2 sm:gap-3 sm:items-center">
        <label className="font-archivo font-extrabold text-[0.72rem] uppercase tracking-[0.18em] text-navy">
          Course <span className="font-franklin normal-case tracking-normal text-[0.7rem] text-gray/70 italic">(optional)</span>
        </label>
        <input
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          placeholder="e.g. COSC 458"
          maxLength={30}
          className="w-full bg-white border border-lightgray text-ink text-[0.92rem] py-2.5 px-3.5 outline-none focus:border-navy focus-visible:ring-2 focus-visible:ring-navy/30 transition-colors font-franklin"
        />
      </section>

      {/* Optional free-form comment — the place to say what the stars couldn't. */}
      <section>
        <label className="block font-archivo font-extrabold text-[0.72rem] uppercase tracking-[0.18em] text-navy mb-0.5">
          Anything else? <span className="font-franklin normal-case tracking-normal text-[0.7rem] text-gray/70 italic">(optional)</span>
        </label>
        <div className="text-[0.76rem] text-gray mb-2 font-franklin">
          Tips future students should know, the best assignment, what you&rsquo;d do differently. Keep it honest and respectful.
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Loved the Socratic style, hated the 8am lectures. Bring coffee."
          className="w-full bg-white border border-lightgray text-ink text-[0.92rem] py-3 px-3.5 outline-none focus:border-navy focus-visible:ring-2 focus-visible:ring-navy/30 transition-colors resize-y font-franklin leading-relaxed"
        />
        <div className="text-right text-[0.68rem] text-gray/70 mt-1 tabular-nums">
          {comment.length}/2000
        </div>
      </section>

      {err && (
        <div className="bg-danger-bg border border-danger-border text-danger px-3 py-2 text-[0.82rem] font-archivo font-bold" role="alert">
          {err}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-lightgray">
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 sm:flex-none bg-gold text-navy border-none py-3 px-6 font-archivo text-[0.78rem] font-extrabold uppercase tracking-[0.16em] min-h-[48px] cursor-pointer hover:bg-[#E5A92E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
        >
          {submitting ? 'Submitting…' : existing ? 'Update review' : 'Post review'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-transparent border border-lightgray py-3 px-5 min-h-[48px] font-archivo text-[0.78rem] font-extrabold uppercase tracking-[0.16em] text-gray hover:text-ink hover:border-navy cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function ProfessorDetail({ profId, onBack, reloadKey, onReload }) {
  const { user, isAuthed } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr(null)
    apiFetch(`/api/professors/${profId}`)
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e) => { if (!cancelled) setErr(e.message || 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [profId, reloadKey])

  const myRating = useMemo(() => {
    if (!data || !user) return null
    return data.ratings.find((r) => r.user_id === user.id) || null
  }, [data, user])

  const deleteMine = async () => {
    if (!confirm('Delete your review?')) return
    try {
      await apiFetch(`/api/professors/${profId}/ratings/mine`, { method: 'DELETE' })
      onReload()
    } catch (e) {
      alert(e.message || 'Delete failed')
    }
  }

  if (loading) {
    return <div className="bg-card border border-lightgray p-6 text-center text-gray">Loading…</div>
  }
  if (err || !data) {
    return (
      <div className="bg-card border border-lightgray p-6 text-center">
        <div className="text-[#8B1A1A] font-archivo font-bold mb-2">{err || 'Not found'}</div>
        <button onClick={onBack} className="bg-navy text-white border-none py-2 px-4 font-archivo text-[0.7rem] font-extrabold uppercase tracking-wide cursor-pointer">Back</button>
      </div>
    )
  }

  return (
    <div className="bg-card border border-lightgray">
      <div className="px-5 py-4 border-b border-[#EAE7E0] bg-offwhite flex items-center gap-3">
        <button onClick={onBack} className="bg-transparent border-none text-gray hover:text-ink cursor-pointer text-[1.1rem]">
          &larr;
        </button>
        <div className="w-11 h-11 rounded-full bg-navy text-gold flex items-center justify-center font-archivo font-black text-[0.78rem] shrink-0">
          {(data.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-archivo font-extrabold text-[1.1rem] leading-tight truncate">{data.name}</h2>
          <div className="text-[0.72rem] text-gray uppercase tracking-wide font-archivo font-bold truncate">
            {data.department || 'Department unknown'}
          </div>
        </div>
      </div>

      {data.rating_count > 0 ? (
        <div className="px-5 py-4 grid grid-cols-3 gap-3 border-b border-[#EAE7E0]">
          <Stat
            label="Overall"
            value={data.avg_rating != null ? data.avg_rating.toFixed(1) : '-'}
            sub={data.avg_rating != null ? <Stars value={data.avg_rating} /> : null}
          />
          <Stat
            label="Difficulty"
            value={data.avg_difficulty != null ? data.avg_difficulty.toFixed(1) : '-'}
            sub={data.avg_difficulty != null ? <Stars value={data.avg_difficulty} /> : null}
          />
          <Stat
            label="Take again"
            value={data.would_take_again_pct != null ? `${data.would_take_again_pct}%` : '-'}
          />
        </div>
      ) : (
        <div className="px-5 py-8 border-b border-[#EAE7E0] flex flex-col items-center text-center">
          <div className="text-lightgray text-[2.1rem] leading-none mb-2 tracking-[0.1em]" aria-hidden>
            &#9734;&#9734;&#9734;&#9734;&#9734;
          </div>
          <div className="font-archivo font-black text-[1.05rem] text-navy">No ratings yet</div>
          <div className="text-[0.82rem] text-gray mt-1 max-w-[360px]">
            Be the first to share what this class was really like.
          </div>
        </div>
      )}

      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-archivo font-extrabold text-[0.75rem] uppercase tracking-widest text-navy">
            {data.rating_count} {data.rating_count === 1 ? 'review' : 'reviews'}
          </div>
          {isAuthed && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-gold text-navy border-none py-[6px] px-3 font-archivo text-[0.68rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#E5A92E] transition-colors"
            >
              {myRating ? 'Edit my review' : '+ Write a review'}
            </button>
          )}
          {!isAuthed && (
            <Link to="/login" className="text-navy font-archivo text-[0.7rem] font-extrabold uppercase tracking-wide no-underline hover:text-gold">
              Sign in to review &rarr;
            </Link>
          )}
        </div>

        {showForm && (
          <div className="mb-4">
            <RatingForm
              professor={data}
              existing={myRating}
              onCancel={() => setShowForm(false)}
              onSubmitted={() => { setShowForm(false); onReload() }}
            />
          </div>
        )}

        {data.ratings.length === 0 ? null : (
          <div className="space-y-3">
            {data.ratings.map((r) => (
              <div key={r.id} className="bg-offwhite border border-lightgray px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Stars value={r.rating} />
                  <span className="font-archivo font-extrabold text-[0.8rem]">{r.rating}</span>
                  {r.course_code && (
                    <span className="font-archivo text-[0.58rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-sm bg-[#D1E3F5] text-navy">
                      {r.course_code}
                    </span>
                  )}
                  {r.would_take_again === true && (
                    <span className="font-archivo text-[0.58rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-sm bg-[#D0EDE9] text-[#0F5E54]">
                      Would take again
                    </span>
                  )}
                  {r.would_take_again === false && (
                    <span className="font-archivo text-[0.58rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-sm bg-[#F5D5D0] text-[#8B1A1A]">
                      Would not retake
                    </span>
                  )}
                  {r.difficulty && (
                    <span className="text-[0.68rem] text-gray font-archivo">
                      Difficulty: {r.difficulty}/5
                    </span>
                  )}
                  {user && r.user_id === user.id && (
                    <button
                      onClick={deleteMine}
                      className="ml-auto text-[0.65rem] text-gray hover:text-[#8B1A1A] cursor-pointer bg-transparent border-none font-archivo font-bold uppercase tracking-wide"
                    >
                      Delete
                    </button>
                  )}
                </div>
                {r.comment && (
                  <div className="text-[0.85rem] text-ink leading-relaxed whitespace-pre-wrap">{r.comment}</div>
                )}
                <div className="text-[0.68rem] text-gray mt-1.5">
                  {r.author?.name || 'Anonymous'}
                  {r.created_at && <> &middot; {new Date(r.created_at).toLocaleDateString()}</>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="text-center">
      <div className="font-archivo font-black text-[1.6rem] text-navy leading-none">{value}</div>
      {sub && <div className="mt-1">{sub}</div>}
      <div className="text-[0.6rem] uppercase tracking-widest text-gray font-archivo font-extrabold mt-1">{label}</div>
    </div>
  )
}

function AddProfessorForm({ onAdded, onCancel }) {
  const [name, setName] = useState('')
  const [dept, setDept] = useState('')
  const [err, setErr] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (name.trim().length < 2) { setErr('Enter a full name.'); return }
    setSubmitting(true); setErr(null)
    try {
      const prof = await apiFetch('/api/professors', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), department: dept.trim() || null }),
      })
      onAdded(prof)
    } catch (e2) {
      setErr(e2.message || 'Failed to add')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-offwhite border border-lightgray px-4 py-4 mb-4">
      <div className="font-archivo font-extrabold text-[0.7rem] uppercase tracking-widest text-navy mb-3">Add a professor</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dr. Jane Smith"
          maxLength={150}
          className="bg-card border border-lightgray text-ink text-[0.85rem] py-2 px-3 outline-none focus:border-navy"
        />
        <input
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          placeholder="Computer Science"
          maxLength={100}
          className="bg-card border border-lightgray text-ink text-[0.85rem] py-2 px-3 outline-none focus:border-navy"
        />
      </div>
      <div className="text-[0.7rem] text-gray mb-3">
        Use the professor's real name. Don't post anything false or defamatory. Reviews are moderated.
      </div>
      {err && <div className="text-[0.75rem] text-[#8B1A1A] font-archivo font-bold mb-2">{err}</div>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-navy text-white border-none py-2 px-4 font-archivo text-[0.72rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#0a182b] transition-colors disabled:opacity-60"
        >
          {submitting ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-transparent border border-lightgray py-2 px-4 font-archivo text-[0.72rem] font-extrabold uppercase tracking-wide text-gray hover:text-ink cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function Professors() {
  const { isAuthed } = useAuth()
  const [professors, setProfessors] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('top')
  const [selectedId, setSelectedId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr(null)
    const params = new URLSearchParams({ sort, limit: '100' })
    if (query.trim()) params.set('q', query.trim())
    apiFetch(`/api/professors?${params.toString()}`)
      .then((d) => { if (!cancelled) setProfessors(d) })
      .catch((e) => { if (!cancelled) setErr(e.message || 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [query, sort, reloadKey])

  const selected = useMemo(() => professors.find((p) => p.id === selectedId), [professors, selectedId])

  return (
    <div>
      <div className="bg-navy px-6 pt-10 pb-9">
        <div className="max-w-[1080px] mx-auto flex justify-between items-end gap-10 flex-col md:flex-row md:items-end">
          <div className="max-w-[560px]">
            <h1 className="font-archivo font-black text-[1.85rem] sm:text-[2.4rem] text-white leading-[1.05] tracking-tight uppercase">
              Rate your <span className="text-gold block">professors</span>
            </h1>
            <p className="text-white/50 text-[0.92rem] mt-3 leading-relaxed max-w-[440px]">
              Help Morgan students pick the right class. Review honestly, stay respectful. Nothing false or personal.
            </p>
          </div>
          <div className="flex gap-8">
            <HeaderNum value={professors.length} label="Professors" />
            <HeaderNum
              value={professors.reduce((sum, p) => sum + (p.rating_count || 0), 0)}
              label="Reviews"
            />
          </div>
        </div>
      </div>
      <hr className="h-[3px] bg-gold border-none m-0" />

      <div className="max-w-[1080px] mx-auto px-6 py-7 grid grid-cols-1 md:grid-cols-[360px_1fr] gap-6">
        <aside>
          <div className="mb-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, department, or course (e.g. COSC 458)..."
              className="w-full bg-card border border-lightgray text-ink text-[0.85rem] py-2.5 px-3.5 outline-none focus:border-navy transition-colors placeholder:text-gray"
            />
            <div className="mt-1.5 text-[0.68rem] text-gray font-archivo leading-snug">
              Try "Wang", "Computer Science", "Mathematics", or a course code
              like "COSC 458".
            </div>
          </div>

          <div className="flex gap-1 bg-offwhite border border-lightgray rounded-full p-1 mb-3 w-fit">
            {['top', 'new', 'controversial'].map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`font-archivo text-[0.65rem] font-extrabold uppercase tracking-wide py-[5px] px-3 rounded-full cursor-pointer transition-all ${
                  sort === s ? 'bg-navy text-white shadow-[0_1px_3px_rgba(11,29,52,0.25)]' : 'text-gray hover:text-ink'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {isAuthed && !showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full bg-gold text-navy border-none py-2.5 px-4 font-archivo text-[0.72rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#E5A92E] transition-colors mb-3"
            >
              + Add a professor
            </button>
          )}

          {showAdd && (
            <AddProfessorForm
              onAdded={(p) => { setShowAdd(false); setReloadKey((k) => k + 1); setSelectedId(p.id) }}
              onCancel={() => setShowAdd(false)}
            />
          )}

          {loading ? (
            <div className="bg-card border border-lightgray px-4 py-8 text-center text-gray">Loading professors…</div>
          ) : err ? (
            <div className="bg-card border border-lightgray px-4 py-4 text-center text-[#8B1A1A]">{err}</div>
          ) : professors.length === 0 ? (
            <div className="bg-card border border-lightgray px-4 py-8 text-center text-gray text-[0.85rem]">
              {query ? `No matches for "${query}".` : 'No professors yet.'}
              {isAuthed && <> <br/><span className="text-navy">Add one above.</span></>}
            </div>
          ) : (
            <div className="space-y-2">
              {professors.map((p) => (
                <ProfessorCard key={p.id} prof={p} onOpen={(x) => setSelectedId(x.id)} active={selectedId === p.id} />
              ))}
            </div>
          )}
        </aside>

        <div>
          {selected ? (
            <ProfessorDetail
              profId={selected.id}
              onBack={() => setSelectedId(null)}
              reloadKey={reloadKey}
              onReload={() => setReloadKey((k) => k + 1)}
            />
          ) : (
            <div className="bg-card border border-lightgray px-6 py-16 text-center">
              <div className="text-[2.5rem] mb-3">&#127891;</div>
              <div className="font-archivo font-extrabold text-[1.1rem] text-navy mb-2">Pick a professor</div>
              <div className="text-[0.85rem] text-gray max-w-[320px] mx-auto">
                Search for one on the left, or add a new professor if you don't see them yet.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HeaderNum({ value, label }) {
  return (
    <div className="text-right">
      <div className="font-archivo font-black text-[2rem] text-gold leading-none tracking-tight">{value}</div>
      <div className="text-white/35 text-[0.68rem] uppercase tracking-widest font-semibold mt-1">{label}</div>
    </div>
  )
}

export default Professors
