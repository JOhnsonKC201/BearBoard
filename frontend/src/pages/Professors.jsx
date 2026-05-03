import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { useAuth } from '../context/AuthContext'

// ---------------------------------------------------------------------------
// Constants — rating axes + enum option labels. Centralized so both the
// form (write) and the detail page (read) reference the same vocab.
// ---------------------------------------------------------------------------

const METRIC_AXES = [
  { key: 'clarity',           label: 'Clarity',     hint: 'Lectures are organized and easy to follow' },
  { key: 'engagement',        label: 'Engagement',  hint: 'Class is interactive and holds attention' },
  { key: 'accessibility',     label: 'Accessibility', hint: 'Available for office hours and email' },
  { key: 'fairness',          label: 'Fairness',    hint: 'Grading is consistent and transparent' },
  { key: 'exam_prep_quality', label: 'Exam prep',   hint: 'Tests reflect what was actually taught' },
]

const RATING_ADJECTIVES = ['Tap to rate', 'Awful', 'Meh', 'Decent', 'Great', 'Exceptional']
const DIFFICULTY_ADJECTIVES = ['Tap to rate', 'Easy', 'Manageable', 'Moderate', 'Challenging', 'Brutal']

const ATTENDANCE_OPTIONS = [
  { value: 'required',     label: 'Required' },
  { value: 'not_required', label: 'Not required' },
  { value: 'recommended',  label: 'Recommended' },
]
const QUIZ_OPTIONS = [
  { value: 'none',      label: 'None' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'pop',       label: 'Pop quizzes' },
  { value: 'both',      label: 'Both' },
]
const EXAM_TYPE_OPTIONS = [
  { value: 'multiple_choice',  label: 'Multiple choice' },
  { value: 'essay',            label: 'Essay' },
  { value: 'true_false',       label: 'True / false' },
  { value: 'written_problems', label: 'Written problems' },
  { value: 'take_home',        label: 'Take home' },
  { value: 'open_book',        label: 'Open book / cheat sheet' },
  { value: 'online',           label: 'Online / computer' },
  { value: 'other',            label: 'Other' },
]
const CURVES_OPTIONS = [
  { value: 'never',     label: 'Never' },
  { value: 'as_needed', label: 'As needed' },
  { value: 'always',    label: 'Always' },
]
const WORKLOAD_OPTIONS = [
  { value: 'light',    label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'heavy',    label: 'Heavy' },
]
const FORMAT_OPTIONS = [
  { value: 'in_person', label: 'In person' },
  { value: 'hybrid',    label: 'Hybrid' },
  { value: 'online',    label: 'Online' },
]
const SIZE_OPTIONS = [
  { value: 'small',  label: 'Small (≤ 25)' },
  { value: 'medium', label: 'Medium (26-60)' },
  { value: 'large',  label: 'Large (60+)' },
]
const RECOMMENDATION_OPTIONS = [
  { value: 'absolutely_yes',    label: 'Absolutely yes',     tone: 'success' },
  { value: 'yes',               label: 'Yes',                tone: 'success' },
  { value: 'only_if_no_choice', label: 'Only if no choice',  tone: 'warning' },
  { value: 'never',             label: 'Never',              tone: 'danger' },
]
const GRADE_OPTIONS = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F', 'P', 'W']
const SEMESTER_OPTIONS = (() => {
  const out = []
  const now = new Date()
  const startYear = now.getFullYear()
  for (let y = startYear + 1; y >= startYear - 4; y--) {
    out.push(`Spring ${y}`)
    out.push(`Fall ${y - 1}`)
  }
  return out
})()


// ---------------------------------------------------------------------------
// Display primitives
// ---------------------------------------------------------------------------

function Stars({ value, size = '1rem' }) {
  if (value == null) return <span className="text-gray text-[0.82rem] font-archivo">—</span>
  const rounded = Math.round(value * 2) / 2
  const full = Math.floor(rounded)
  const half = rounded - full === 0.5
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <span className="inline-flex items-center gap-[1px]" style={{ fontSize: size }} aria-label={`${value.toFixed(1)} out of 5`}>
      {Array.from({ length: full }).map((_, i) => <span key={`f${i}`} className="text-gold">★</span>)}
      {half && <span className="text-gold">½</span>}
      {Array.from({ length: empty }).map((_, i) => <span key={`e${i}`} className="text-lightgray">☆</span>)}
    </span>
  )
}

// Horizontal score bar — shows avg/5 for a single metric. The fill color
// shifts danger→warning→success as the score climbs so a 2.1 reads visually
// different from a 4.6 even if you skip the number.
function MetricBar({ label, value, hint }) {
  const v = value == null ? 0 : value
  const pct = Math.max(0, Math.min(100, (v / 5) * 100))
  const tone = v >= 4 ? 'bg-[#1A8A7D]' : v >= 3 ? 'bg-gold' : v >= 2 ? 'bg-[#D4962A]' : 'bg-danger'
  return (
    <div className="flex items-center gap-3">
      <div className="w-[120px] shrink-0">
        <div className="font-archivo font-bold text-[0.78rem] uppercase tracking-wider text-ink">{label}</div>
        {hint && <div className="text-[0.66rem] text-gray font-franklin leading-tight mt-0.5">{hint}</div>}
      </div>
      <div className="flex-1 h-2 bg-offwhite rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-[width] duration-500 ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-[58px] shrink-0 text-right font-archivo font-extrabold text-[0.92rem] tabular-nums text-ink">
        {value == null ? '—' : value.toFixed(1)}
      </div>
    </div>
  )
}

function StarPicker({ value, onChange, max = 5, labels, size = 'lg' }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  const label = labels ? labels[shown] : ''
  const starSize = size === 'sm' ? 'text-[1.25rem]' : 'text-[1.9rem] sm:text-[2.1rem]'
  const btnPad = size === 'sm' ? 'p-0.5' : 'p-1 sm:p-1.5'
  return (
    <div>
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHover(0)}
      >
        {Array.from({ length: max }).map((_, i) => {
          const n = i + 1
          const filled = n <= shown
          return (
            <button
              type="button"
              key={n}
              onMouseEnter={() => setHover(n)}
              onClick={() => onChange(n === value ? 0 : n)}
              aria-label={labels ? `${labels[n]} (${n} stars)` : `${n} stars`}
              className={`${btnPad} bg-transparent border-none cursor-pointer leading-none transition-transform active:scale-95 ${
                filled ? 'text-gold' : 'text-lightgray hover:text-gold/60'
              } ${starSize}`}
            >
              ★
            </button>
          )
        })}
      </div>
      {labels && (
        <div className={`mt-0.5 font-archivo ${shown ? 'text-ink/85 font-bold' : 'text-gray font-semibold'} ${size === 'sm' ? 'text-[0.7rem]' : 'text-[0.82rem]'}`}>
          {label || labels[0]}
        </div>
      )}
    </div>
  )
}

// Single-select pill row. For attendance, quizzes, curves, workload, etc.
function PillSelect({ value, onChange, options, allowClear = true }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value === opt.value
        const tone = opt.tone
        const activeCls = tone === 'success'
          ? 'bg-[#0F5E54] text-white border-[#0F5E54]'
          : tone === 'warning'
          ? 'bg-[#8B6914] text-white border-[#8B6914]'
          : tone === 'danger'
          ? 'bg-danger text-white border-danger'
          : 'bg-navy text-gold border-navy'
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(active && allowClear ? null : opt.value)}
            className={`font-archivo text-2xs font-extrabold uppercase tracking-wider py-1.5 px-3 border cursor-pointer transition-colors ${
              active ? activeCls : 'bg-card text-ink border-lightgray hover:border-navy'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function MultiPillSelect({ value = [], onChange, options }) {
  const set = new Set(value)
  const toggle = (v) => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v); else next.add(v)
    onChange(Array.from(next))
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = set.has(opt.value)
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={`font-archivo text-2xs font-extrabold uppercase tracking-wider py-1.5 px-3 border cursor-pointer transition-colors ${
              active
                ? 'bg-navy text-gold border-navy'
                : 'bg-card text-ink border-lightgray hover:border-navy'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function FormSection({ title, desc, children }) {
  return (
    <section className="border-t border-divider pt-5 mt-5 first:border-t-0 first:pt-0 first:mt-0">
      <div className="mb-3">
        <h3 className="font-archivo font-extrabold text-[0.82rem] uppercase tracking-wider text-navy m-0">{title}</h3>
        {desc && <p className="text-[0.78rem] text-gray font-franklin mt-1 m-0">{desc}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function FieldLabel({ label, required, children }) {
  return (
    <div>
      <label className="font-archivo text-[0.62rem] font-extrabold uppercase tracking-wide text-gray block mb-1.5">
        {label}{required && <span className="text-danger ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}


// ---------------------------------------------------------------------------
// Professor list card — surfaces avg + 3 of the 5 sub-metrics inline so a
// browse user can read multiple cards without clicking through.
// ---------------------------------------------------------------------------

function ProfessorCard({ prof, onOpen, active }) {
  const hasRating = prof.avg_rating != null && prof.rating_count > 0
  return (
    <button
      onClick={() => onOpen(prof)}
      className={`w-full text-left bg-card border overflow-hidden transition-all hover:-translate-y-[1px] hover:shadow-[0_8px_24px_-12px_rgba(11,29,52,0.22)] ${
        active ? 'border-gold border-l-[3px] border-l-gold' : 'border-lightgray hover:border-navy/30'
      }`}
    >
      <div className="px-4 py-3.5 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-navy text-gold flex items-center justify-center font-archivo font-black text-[0.82rem] shrink-0 ring-1 ring-black/5">
          {(prof.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-editorial font-black text-[1.05rem] leading-tight truncate text-ink">{prof.name}</div>
          <div className="text-[0.7rem] text-gray uppercase tracking-wider font-archivo font-bold mt-0.5 truncate">
            {prof.department || 'Department unknown'}
          </div>
          {hasRating && prof.would_take_again_pct != null && (
            <div className="text-[0.68rem] text-success font-archivo font-extrabold mt-1 uppercase tracking-wider">
              {prof.would_take_again_pct}% would take again
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          {hasRating ? (
            <>
              <div className="flex items-center justify-end gap-1">
                <span className="text-gold text-[1.05rem] leading-none">★</span>
                <span className="font-editorial font-black text-navy text-[1.45rem] leading-none tabular-nums">
                  {prof.avg_rating.toFixed(1)}
                </span>
              </div>
              <div className="text-[0.6rem] text-gray uppercase tracking-wider font-archivo font-bold mt-1">
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


// ---------------------------------------------------------------------------
// RatingForm — the rich, sectioned write surface. Modeled on RateYourProf:
// course context up top → 5-axis stars → "the intel" → class shape →
// recommendation → written review (3 prompts).
// ---------------------------------------------------------------------------

function RatingForm({ professor, onSubmitted, onCancel, existing }) {
  // Bind every field. Existing values pre-populate so an edit doesn't wipe.
  const [rating, setRating] = useState(existing?.rating || 0)
  const [difficulty, setDifficulty] = useState(existing?.difficulty || 0)
  const [wouldTakeAgain, setWouldTakeAgain] = useState(existing?.would_take_again ?? null)
  const [courseCode, setCourseCode] = useState(existing?.course_code || '')
  const [courseTitle, setCourseTitle] = useState(existing?.course_title || '')
  const [semester, setSemester] = useState(existing?.semester || SEMESTER_OPTIONS[0])
  const [grade, setGrade] = useState(existing?.grade_received || '')
  const [clarity, setClarity] = useState(existing?.clarity || 0)
  const [engagement, setEngagement] = useState(existing?.engagement || 0)
  const [accessibility, setAccessibility] = useState(existing?.accessibility || 0)
  const [fairness, setFairness] = useState(existing?.fairness || 0)
  const [examPrep, setExamPrep] = useState(existing?.exam_prep_quality || 0)
  const [attendance, setAttendance] = useState(existing?.attendance_policy || null)
  const [quizType, setQuizType] = useState(existing?.quiz_type || null)
  const [examTypes, setExamTypes] = useState(existing?.exam_types || [])
  const [curves, setCurves] = useState(existing?.curves || null)
  const [workload, setWorkload] = useState(existing?.workload || null)
  const [classFormat, setClassFormat] = useState(existing?.class_format || null)
  const [classSize, setClassSize] = useState(existing?.class_size || null)
  const [recommendation, setRecommendation] = useState(existing?.recommendation || null)
  const [bestAspects, setBestAspects] = useState(existing?.best_aspects || '')
  const [areasForImprovement, setAreasForImprovement] = useState(existing?.areas_for_improvement || '')
  const [advice, setAdvice] = useState(existing?.advice || '')
  const [skipWrittenReview, setSkipWrittenReview] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Auto-derive overall from the 5 sub-metrics when at least 3 are set
  // and the user hasn't manually picked an overall yet. Removes the
  // common "fill out everything except the overall and get blocked" UX.
  useEffect(() => {
    const sub = [clarity, engagement, accessibility, fairness, examPrep].filter((x) => x > 0)
    if (sub.length >= 3 && !rating) {
      const avg = sub.reduce((a, b) => a + b, 0) / sub.length
      setRating(Math.round(avg))
    }
  }, [clarity, engagement, accessibility, fairness, examPrep])  // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!rating) { setError('Pick an overall rating (or fill in the 5-axis breakdown and we will derive it)'); return }
    if (!courseCode.trim()) { setError('Course code is required'); return }
    setSubmitting(true)
    try {
      const payload = {
        rating,
        difficulty: difficulty || null,
        would_take_again: wouldTakeAgain,
        course_code: courseCode.trim() || null,
        course_title: courseTitle.trim() || null,
        semester: semester || null,
        grade_received: grade || null,
        clarity: clarity || null,
        engagement: engagement || null,
        accessibility: accessibility || null,
        fairness: fairness || null,
        exam_prep_quality: examPrep || null,
        attendance_policy: attendance,
        quiz_type: quizType,
        exam_types: examTypes.length ? examTypes : null,
        curves,
        workload,
        class_format: classFormat,
        class_size: classSize,
        recommendation,
        best_aspects: skipWrittenReview ? null : (bestAspects.trim() || null),
        areas_for_improvement: skipWrittenReview ? null : (areasForImprovement.trim() || null),
        advice: skipWrittenReview ? null : (advice.trim() || null),
      }
      const created = await apiFetch(`/api/professors/${professor.id}/ratings`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      onSubmitted(created)
    } catch (err) {
      setError(err?.message || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-card border border-lightgray border-l-[3px] border-l-gold p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
        <h2 className="font-editorial font-black text-[1.4rem] sm:text-[1.6rem] leading-none tracking-tight m-0">
          Rate {professor.name}
        </h2>
        <button type="button" onClick={onCancel} className="text-mini font-archivo font-extrabold uppercase tracking-wider text-gray hover:text-ink bg-transparent border-none cursor-pointer">
          Cancel
        </button>
      </div>
      <p className="text-[0.82rem] text-ink/75 font-prose leading-relaxed mb-5 max-w-[55ch]">
        Keep it about the classroom — teaching, coursework, your academic experience.
        Personal attacks, harassment, and off-topic content will be flagged and may be removed.
      </p>

      <FormSection title="Course information" desc="Required so future students can filter to the section they're considering.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldLabel label="Course code" required>
            <input
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              placeholder="e.g. COSC 350"
              maxLength={30}
              className="w-full border border-lightgray bg-white px-3 py-2 text-[0.92rem] font-franklin focus:border-navy focus:outline-none"
            />
          </FieldLabel>
          <FieldLabel label="Course title">
            <input
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              placeholder="Intro to Networking"
              maxLength={200}
              className="w-full border border-lightgray bg-white px-3 py-2 text-[0.92rem] font-franklin focus:border-navy focus:outline-none"
            />
          </FieldLabel>
          <FieldLabel label="Semester">
            <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full border border-lightgray bg-white px-3 py-2 text-[0.92rem] font-franklin focus:border-navy focus:outline-none">
              {SEMESTER_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FieldLabel>
          <FieldLabel label="Grade received (optional)">
            <select value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full border border-lightgray bg-white px-3 py-2 text-[0.92rem] font-franklin focus:border-navy focus:outline-none">
              <option value="">Prefer not to say</option>
              {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </FieldLabel>
        </div>
      </FormSection>

      <FormSection title="Rate this professor" desc="1 star = Awful · 5 stars = Exceptional. Skip any axis you can't fairly judge.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <FieldLabel label="Overall" required>
            <StarPicker value={rating} onChange={setRating} labels={RATING_ADJECTIVES} />
          </FieldLabel>
          <FieldLabel label="Difficulty">
            <StarPicker value={difficulty} onChange={setDifficulty} labels={DIFFICULTY_ADJECTIVES} />
          </FieldLabel>
          {METRIC_AXES.map((m) => {
            const stateMap = {
              clarity: [clarity, setClarity],
              engagement: [engagement, setEngagement],
              accessibility: [accessibility, setAccessibility],
              fairness: [fairness, setFairness],
              exam_prep_quality: [examPrep, setExamPrep],
            }
            const [val, setVal] = stateMap[m.key]
            return (
              <FieldLabel key={m.key} label={m.label}>
                <StarPicker value={val} onChange={setVal} labels={RATING_ADJECTIVES} size="sm" />
                <div className="text-[0.66rem] text-gray font-franklin mt-1 leading-tight">{m.hint}</div>
              </FieldLabel>
            )
          })}
        </div>
      </FormSection>

      <FormSection title="The intel" desc="The practical stuff future students actually need to know.">
        <FieldLabel label="Attendance policy">
          <PillSelect value={attendance} onChange={setAttendance} options={ATTENDANCE_OPTIONS} />
        </FieldLabel>
        <FieldLabel label="Quizzes">
          <PillSelect value={quizType} onChange={setQuizType} options={QUIZ_OPTIONS} />
        </FieldLabel>
        <FieldLabel label="Exam types (pick all that apply)">
          <MultiPillSelect value={examTypes} onChange={setExamTypes} options={EXAM_TYPE_OPTIONS} />
        </FieldLabel>
        <FieldLabel label="Curves / grade adjustments">
          <PillSelect value={curves} onChange={setCurves} options={CURVES_OPTIONS} />
        </FieldLabel>
      </FormSection>

      <FormSection title="Class details">
        <FieldLabel label="Workload">
          <PillSelect value={workload} onChange={setWorkload} options={WORKLOAD_OPTIONS} />
        </FieldLabel>
        <FieldLabel label="Format">
          <PillSelect value={classFormat} onChange={setClassFormat} options={FORMAT_OPTIONS} />
        </FieldLabel>
        <FieldLabel label="Class size">
          <PillSelect value={classSize} onChange={setClassSize} options={SIZE_OPTIONS} />
        </FieldLabel>
      </FormSection>

      <FormSection title="Would you recommend this professor?">
        <PillSelect value={recommendation} onChange={setRecommendation} options={RECOMMENDATION_OPTIONS} />
        <div className="flex items-center gap-2 text-[0.78rem] font-franklin text-ink/85 mt-2">
          <span className="font-archivo text-[0.62rem] font-extrabold uppercase tracking-wide text-gray">Would take again?</span>
          <button type="button" onClick={() => setWouldTakeAgain(wouldTakeAgain === true ? null : true)}
            className={`text-2xs font-archivo font-extrabold uppercase tracking-wider py-1 px-2.5 border cursor-pointer transition-colors ${
              wouldTakeAgain === true ? 'bg-success text-white border-success' : 'bg-card text-ink border-lightgray hover:border-navy'
            }`}>
            Yes
          </button>
          <button type="button" onClick={() => setWouldTakeAgain(wouldTakeAgain === false ? null : false)}
            className={`text-2xs font-archivo font-extrabold uppercase tracking-wider py-1 px-2.5 border cursor-pointer transition-colors ${
              wouldTakeAgain === false ? 'bg-danger text-white border-danger' : 'bg-card text-ink border-lightgray hover:border-navy'
            }`}>
            No
          </button>
        </div>
      </FormSection>

      <FormSection title="Written review" desc="Three focused prompts. Specific examples beat vague vibes.">
        <label className="flex items-center gap-2 text-[0.82rem] font-franklin cursor-pointer mb-1">
          <input type="checkbox" checked={skipWrittenReview} onChange={(e) => setSkipWrittenReview(e.target.checked)} className="accent-navy" />
          <span>Skip written review — just submit my scores.</span>
        </label>
        {!skipWrittenReview && (
          <>
            <FieldLabel label="Best aspects — what does this professor do well?">
              <textarea value={bestAspects} onChange={(e) => setBestAspects(e.target.value)} rows={3} maxLength={2000}
                className="w-full border border-lightgray bg-white px-3 py-2 text-[0.92rem] font-franklin resize-y focus:border-navy focus:outline-none" />
            </FieldLabel>
            <FieldLabel label="Areas for improvement">
              <textarea value={areasForImprovement} onChange={(e) => setAreasForImprovement(e.target.value)} rows={3} maxLength={2000}
                className="w-full border border-lightgray bg-white px-3 py-2 text-[0.92rem] font-franklin resize-y focus:border-navy focus:outline-none" />
            </FieldLabel>
            <FieldLabel label="Advice to future students">
              <textarea value={advice} onChange={(e) => setAdvice(e.target.value)} rows={3} maxLength={2000}
                className="w-full border border-lightgray bg-white px-3 py-2 text-[0.92rem] font-franklin resize-y focus:border-navy focus:outline-none" />
            </FieldLabel>
          </>
        )}
      </FormSection>

      {error && (
        <div className="mt-4 bg-danger-bg border border-danger/40 text-danger px-3 py-2 text-mini font-archivo font-bold">{error}</div>
      )}
      <div className="mt-5 flex items-center gap-2 justify-end">
        <button type="button" onClick={onCancel} disabled={submitting}
          className="bg-transparent border border-lightgray text-gray hover:text-ink py-2.5 px-4 font-archivo text-mini font-extrabold uppercase tracking-wider cursor-pointer">
          Cancel
        </button>
        <button type="submit" disabled={submitting}
          className="bg-navy text-gold border-none py-2.5 px-5 font-archivo text-mini font-extrabold uppercase tracking-wider cursor-pointer hover:bg-[#132d4a] disabled:opacity-60">
          {submitting ? 'Submitting…' : existing ? 'Update rating' : 'Submit rating'}
        </button>
      </div>
    </form>
  )
}


// ---------------------------------------------------------------------------
// ProfessorDetail — hero + 5-metric breakdown + reviews list
// ---------------------------------------------------------------------------

function recommendationLabel(value) {
  const opt = RECOMMENDATION_OPTIONS.find((o) => o.value === value)
  return opt?.label || null
}

function ProfessorDetail({ profId, onBack, reloadKey, onReload }) {
  const [prof, setProf] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const formRef = useRef(null)
  const { user, isAuthed } = useAuth()

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    apiFetch(`/api/professors/${profId}`, { cache: false })
      .then((data) => { if (!cancelled) setProf(data) })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [profId, reloadKey])

  const myRating = useMemo(() => {
    if (!prof?.ratings || !user) return null
    return prof.ratings.find((r) => r.user_id === user.id) || null
  }, [prof, user])

  const openForm = () => {
    if (!isAuthed) { window.location.href = '/login'; return }
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  const onSubmitted = () => {
    setShowForm(false)
    onReload?.()
  }

  // Inline delete for the viewer's own rating. Backend has supported this
  // since the original schema (DELETE /api/professors/:id/ratings/mine);
  // this just gives users a one-click affordance from inside their own
  // review card so they don't have to hunt for it.
  const deleteMyRating = async () => {
    if (!isAuthed || !myRating) return
    if (!window.confirm('Delete your review of this professor? This can\'t be undone.')) {
      return
    }
    try {
      await apiFetch(`/api/professors/${profId}/ratings/mine`, { method: 'DELETE' })
      onReload?.()
    } catch (err) {
      // Surface the failure but don't trap the user — most likely cause
      // is a stale session or a 404 if they already deleted in another tab.
      window.alert(err?.message || 'Could not delete your review.')
    }
  }

  if (loading) {
    return <div className="bg-card border border-lightgray h-[400px] animate-pulse" />
  }
  if (error || !prof) {
    return (
      <div className="bg-card border border-lightgray p-5 text-center">
        <p className="text-gray font-archivo text-mini">{error || 'Not found'}</p>
        <button onClick={onBack} className="text-navy underline mt-2 cursor-pointer bg-transparent border-none">Back</button>
      </div>
    )
  }

  const overall = prof.avg_rating
  const overallTone = overall == null ? 'bg-offwhite text-gray border-lightgray'
    : overall >= 4 ? 'bg-[#0F5E54] text-white border-[#0F5E54]'
    : overall >= 3 ? 'bg-gold text-navy border-gold'
    : overall >= 2 ? 'bg-[#8B6914] text-white border-[#8B6914]'
    : 'bg-danger text-white border-danger'

  return (
    <div className="space-y-5">
      {onBack && (
        <button onClick={onBack} className="text-mini font-archivo font-extrabold uppercase tracking-wider text-gray hover:text-ink bg-transparent border-none cursor-pointer">
          ← Back to list
        </button>
      )}

      {/* HERO */}
      <header className="bg-card border border-lightgray border-l-[3px] border-l-gold p-5 sm:p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className={`w-[88px] h-[88px] sm:w-[100px] sm:h-[100px] rounded-full border-4 ${overallTone} flex flex-col items-center justify-center shrink-0`}>
            <div className="font-editorial font-black text-[2rem] sm:text-[2.4rem] leading-none">
              {overall == null ? '—' : overall.toFixed(1)}
            </div>
            <div className="text-[0.55rem] font-archivo font-extrabold uppercase tracking-wider opacity-80 mt-0.5">
              {prof.rating_count || 0} {prof.rating_count === 1 ? 'review' : 'reviews'}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-editorial font-black text-[2rem] sm:text-[2.6rem] leading-none tracking-tight m-0 italic">
              {prof.name}
            </h1>
            <div className="text-mini text-gray font-archivo uppercase tracking-wider mt-2">
              {prof.department || 'Department unknown'}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[0.85rem] font-archivo">
              {prof.would_take_again_pct != null && (
                <Stat label="Would take again" value={`${prof.would_take_again_pct}%`} tone={prof.would_take_again_pct >= 70 ? 'success' : prof.would_take_again_pct >= 40 ? 'warning' : 'danger'} />
              )}
              {prof.avg_difficulty != null && (
                <Stat label="Difficulty" value={prof.avg_difficulty.toFixed(1)} tone="neutral" />
              )}
            </div>
          </div>
          <div className="shrink-0">
            <button onClick={openForm}
              className="bg-gold text-navy border-none py-3 px-5 font-archivo text-mini font-extrabold uppercase tracking-wider cursor-pointer hover:bg-[#E5A92E] transition-colors">
              {myRating ? 'Update your rating' : 'Rate this professor'}
            </button>
          </div>
        </div>

        {/* 5-axis breakdown */}
        {prof.rating_count > 0 && (
          <div className="mt-6 pt-5 border-t border-divider grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {METRIC_AXES.map((m) => (
              <MetricBar key={m.key} label={m.label} hint={m.hint} value={prof[`avg_${m.key}`]} />
            ))}
          </div>
        )}
      </header>

      {/* RATING FORM (slides in) */}
      {showForm && (
        <div ref={formRef}>
          <RatingForm
            professor={prof}
            existing={myRating}
            onSubmitted={onSubmitted}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* REVIEWS */}
      <section>
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="font-editorial font-black text-[1.4rem] tracking-tight m-0">
            Student reviews
          </h2>
          <span aria-hidden className="h-px flex-1 bg-lightgray" />
          <span className="text-2xs text-gray font-archivo uppercase tracking-wider tabular-nums">
            {prof.ratings.length} {prof.ratings.length === 1 ? 'review' : 'reviews'}
          </span>
        </div>
        {prof.ratings.length === 0 ? (
          <div className="bg-card border border-dashed border-lightgray px-5 py-10 text-center">
            <div className="font-editorial italic text-[1.2rem] text-gray leading-snug mb-1">“Be the first.”</div>
            <p className="text-mini text-gray font-archivo uppercase tracking-wider">No reviews yet for {prof.name}.</p>
          </div>
        ) : (
          <ul className="list-none p-0 m-0 space-y-3">
            {prof.ratings.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                mineUserId={user?.id || null}
                onEdit={openForm}
                onDelete={deleteMyRating}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, tone = 'neutral' }) {
  const toneCls = tone === 'success' ? 'bg-success-bg text-success'
    : tone === 'warning' ? 'bg-warning-bg text-warning'
    : tone === 'danger' ? 'bg-danger-bg text-danger'
    : 'bg-offwhite text-ink/85 border border-lightgray'
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-sm font-archivo text-[0.72rem] font-extrabold uppercase tracking-wider ${toneCls}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  )
}


function ReviewCard({ review, mineUserId = null, onEdit, onDelete }) {
  const courseLabel = [review.course_code, review.course_title].filter(Boolean).join(' · ')
  const recLabel = recommendationLabel(review.recommendation)
  // A review is "mine" when the logged-in user wrote it — only then do we
  // render the inline Edit / Delete affordance. Both backend endpoints
  // (the upsert POST and DELETE .../mine) already enforce ownership server
  // side, so this is purely a UI gate to avoid showing dead buttons to
  // viewers who can't act on them.
  const isMine = mineUserId != null && review.user_id === mineUserId
  return (
    <li className={`bg-card border border-lightgray border-l-[3px] p-4 sm:p-5 ${isMine ? 'border-l-gold' : 'border-l-navy/60'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Stars value={review.rating} size="1.05rem" />
            <span className="font-archivo font-extrabold text-[0.92rem] tabular-nums text-ink">{review.rating}.0</span>
            {isMine && (
              <span className="font-archivo text-2xs font-extrabold uppercase tracking-wider py-[2px] px-2 rounded-sm bg-gold/15 text-gold">
                Your review
              </span>
            )}
            {review.difficulty != null && (
              <span className="text-2xs text-gray font-archivo uppercase tracking-wider">
                · Difficulty {review.difficulty}/5
              </span>
            )}
          </div>
          {courseLabel && (
            <div className="font-archivo font-bold text-[0.84rem] text-ink/85 mt-1.5">{courseLabel}</div>
          )}
          <div className="text-2xs text-gray font-archivo uppercase tracking-wider mt-0.5">
            {review.semester || ''}{review.grade_received ? ` · Grade ${review.grade_received}` : ''}
            {review.author?.name && (
              <> · {review.author.name}{review.author.major ? ` (${review.author.major})` : ''}</>
            )}
          </div>
        </div>
        {recLabel && (
          <span className={`shrink-0 font-archivo text-2xs font-extrabold uppercase tracking-wider py-1 px-2.5 rounded-sm ${
            review.recommendation === 'absolutely_yes' || review.recommendation === 'yes'
              ? 'bg-success text-white'
              : review.recommendation === 'only_if_no_choice'
              ? 'bg-[#8B6914] text-white'
              : 'bg-danger text-white'
          }`}>
            {recLabel}
          </span>
        )}
      </div>

      {/* 5-axis chips */}
      {(review.clarity || review.engagement || review.accessibility || review.fairness || review.exam_prep_quality) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {METRIC_AXES.map((m) => {
            const v = review[m.key]
            if (v == null) return null
            return (
              <span key={m.key} className="font-archivo text-2xs font-extrabold uppercase tracking-wider py-1 px-2 bg-offwhite border border-lightgray text-ink/85">
                {m.label} {v}/5
              </span>
            )
          })}
        </div>
      )}

      {/* Intel pills */}
      {(review.attendance_policy || review.quiz_type || review.curves || review.workload || review.class_format || review.class_size) && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-2xs font-archivo">
          {review.attendance_policy && <Tag>Attendance: {humanize(review.attendance_policy)}</Tag>}
          {review.quiz_type && <Tag>Quizzes: {humanize(review.quiz_type)}</Tag>}
          {review.curves && <Tag>Curves: {humanize(review.curves)}</Tag>}
          {review.workload && <Tag>Workload: {humanize(review.workload)}</Tag>}
          {review.class_format && <Tag>{humanize(review.class_format)}</Tag>}
          {review.class_size && <Tag>{humanize(review.class_size)} class</Tag>}
        </div>
      )}

      {/* Written review prompts */}
      <div className="mt-4 space-y-3">
        {review.best_aspects && <PromptedQuote prompt="What this professor did well" body={review.best_aspects} />}
        {review.areas_for_improvement && <PromptedQuote prompt="Areas for improvement" body={review.areas_for_improvement} />}
        {review.advice && <PromptedQuote prompt="Advice to future students" body={review.advice} />}
        {review.comment && !review.best_aspects && !review.areas_for_improvement && !review.advice && (
          <PromptedQuote prompt="Comment" body={review.comment} />
        )}
      </div>

      {/* Owner-only action row. Edit reuses the form opener already wired
          on the parent — the form's `existing` prop is set from myRating
          so it pre-fills with the current review. Delete hits the
          existing DELETE .../ratings/mine endpoint after a confirm. */}
      {isMine && (onEdit || onDelete) && (
        <div className="mt-4 pt-3 border-t border-lightgray flex items-center gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="font-archivo text-2xs font-extrabold uppercase tracking-wider py-1.5 px-3 bg-navy text-white border-0 cursor-pointer hover:bg-[#13284a] transition-colors"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="font-archivo text-2xs font-extrabold uppercase tracking-wider py-1.5 px-3 bg-transparent text-danger border border-danger/40 cursor-pointer hover:bg-danger hover:text-white transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </li>
  )
}

function PromptedQuote({ prompt, body }) {
  return (
    <div>
      <div className="font-archivo text-[0.62rem] font-extrabold uppercase tracking-wider text-gray mb-1">{prompt}</div>
      <p className="text-[0.92rem] font-prose text-ink/85 leading-[1.55] m-0 whitespace-pre-wrap border-l-2 border-divider pl-3">
        {body}
      </p>
    </div>
  )
}

function Tag({ children }) {
  return (
    <span className="font-archivo text-2xs font-extrabold uppercase tracking-wider py-1 px-2 bg-offwhite border border-lightgray text-ink/85 rounded-sm">
      {children}
    </span>
  )
}

function humanize(s) {
  if (!s) return ''
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}


// ---------------------------------------------------------------------------
// Add-a-professor form (kept simple — name + department; reused in panel)
// ---------------------------------------------------------------------------

function AddProfessorForm({ onAdded, onCancel }) {
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const created = await apiFetch('/api/professors', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), department: department.trim() || null }),
      })
      onAdded(created)
    } catch (err) {
      setError(err?.message || 'Failed to add professor')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-card border border-lightgray p-4">
      <h3 className="font-archivo font-extrabold text-[0.82rem] uppercase tracking-wider mb-3">Add a professor</h3>
      <div className="space-y-3">
        <FieldLabel label="Full name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} required
            placeholder="e.g. Dr. Jane Smith"
            className="w-full border border-lightgray bg-white px-3 py-2 text-[0.92rem] font-franklin focus:border-navy focus:outline-none" />
        </FieldLabel>
        <FieldLabel label="Department">
          <input value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={100}
            placeholder="Computer Science"
            className="w-full border border-lightgray bg-white px-3 py-2 text-[0.92rem] font-franklin focus:border-navy focus:outline-none" />
        </FieldLabel>
        {error && <div className="text-mini text-danger font-archivo font-bold">{error}</div>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} disabled={busy}
            className="bg-transparent border border-lightgray text-gray py-2 px-3 font-archivo text-mini font-extrabold uppercase tracking-wider cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={busy || !name.trim()}
            className="bg-navy text-gold border-none py-2 px-3 font-archivo text-mini font-extrabold uppercase tracking-wider cursor-pointer hover:bg-[#132d4a] disabled:opacity-60">
            {busy ? '…' : 'Add'}
          </button>
        </div>
      </div>
    </form>
  )
}


// ---------------------------------------------------------------------------
// Page shell — split-pane layout: list on the left, detail on the right
// ---------------------------------------------------------------------------

function Professors() {
  const [profs, setProfs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('top')
  const [department, setDepartment] = useState(null)
  const [active, setActive] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const { isAuthed } = useAuth()

  const loadList = () => {
    setLoading(true)
    const params = new URLSearchParams({ sort, limit: '200' })
    if (search.trim()) params.set('q', search.trim())
    apiFetch(`/api/professors?${params.toString()}`, { cache: false })
      .then((data) => setProfs(data || []))
      .catch(() => setProfs([]))
      .finally(() => setLoading(false))
  }

  // Build the department list from whatever the API returned. Sorted
  // alphabetically; null/empty departments grouped under "Other" so they
  // still get a chip instead of vanishing.
  const departments = useMemo(() => {
    const set = new Set()
    for (const p of profs) set.add(p.department || 'Other')
    return Array.from(set).sort()
  }, [profs])

  const visibleProfs = useMemo(() => {
    if (!department) return profs
    return profs.filter((p) => (p.department || 'Other') === department)
  }, [profs, department])

  // Initial + sort changes
  useEffect(() => { loadList() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sort, reloadKey])
  // Debounced search
  useEffect(() => {
    const id = setTimeout(loadList, 250)
    return () => clearTimeout(id)
  }, [search])  // eslint-disable-line react-hooks/exhaustive-deps

  const onAdded = (created) => {
    setShowAdd(false)
    setProfs((prev) => {
      // Move to top if already present, otherwise prepend.
      const exists = prev.find((p) => p.id === created.id)
      const rest = prev.filter((p) => p.id !== created.id)
      return [created, ...rest]
    })
    setActive(created)
  }

  return (
    <div className="min-h-[60vh] max-w-[1240px] mx-auto px-4 sm:px-6 py-6">
      <header className="mb-5">
        <h1 className="font-editorial font-black text-[2.2rem] sm:text-[2.8rem] leading-none tracking-tight m-0">
          Professors
        </h1>
        <p className="text-mini text-gray font-archivo uppercase tracking-wider mt-2">
          Honest, anonymous-friendly reviews from Bears who actually took the class.
        </p>
      </header>

      <div className="grid lg:grid-cols-[420px_minmax(0,1fr)] gap-5">
        {/* LEFT: list */}
        <aside className="space-y-3 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto lg:pr-1">
          <div className="bg-card border border-lightgray p-3 space-y-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, department, or course code…"
              className="w-full border border-lightgray bg-white px-3 py-2 text-[0.9rem] font-franklin focus:border-navy focus:outline-none"
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              <SortChip value="top" current={sort} onChange={setSort}>Top rated</SortChip>
              <SortChip value="new" current={sort} onChange={setSort}>New</SortChip>
              <SortChip value="controversial" current={sort} onChange={setSort}>Controversial</SortChip>
              {isAuthed && (
                <button onClick={() => setShowAdd((v) => !v)}
                  className="ml-auto text-2xs font-archivo font-extrabold uppercase tracking-wider py-1.5 px-2.5 bg-navy text-gold border-none cursor-pointer hover:bg-[#132d4a]">
                  {showAdd ? 'Close' : '+ Add'}
                </button>
              )}
            </div>
            {departments.length > 1 && (
              <div className="pt-2 border-t border-divider">
                <div className="font-archivo text-[0.6rem] font-extrabold uppercase tracking-wider text-gray mb-1.5">Department</div>
                <div className="flex items-center gap-1 flex-wrap">
                  <DeptChip value={null} current={department} onChange={setDepartment}>All ({profs.length})</DeptChip>
                  {departments.map((d) => {
                    const n = profs.filter((p) => (p.department || 'Other') === d).length
                    return (
                      <DeptChip key={d} value={d} current={department} onChange={setDepartment}>
                        {d} ({n})
                      </DeptChip>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {showAdd && <AddProfessorForm onAdded={onAdded} onCancel={() => setShowAdd(false)} />}

          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4].map((i) => <div key={i} className="bg-card border border-lightgray h-[80px] animate-pulse" />)}
            </div>
          ) : visibleProfs.length === 0 ? (
            <div className="bg-card border border-dashed border-lightgray px-4 py-8 text-center">
              <div className="font-editorial italic text-[1.05rem] text-gray leading-snug mb-1">“No matches.”</div>
              <p className="text-2xs text-gray font-archivo uppercase tracking-wider">
                {department
                  ? `No professors in ${department} match.`
                  : search.trim() ? 'Try a different search.' : 'Be the first to add one.'}
              </p>
            </div>
          ) : (
            <ul className="list-none p-0 m-0 space-y-2">
              {visibleProfs.map((p) => (
                <li key={p.id}>
                  <ProfessorCard prof={p} onOpen={setActive} active={active?.id === p.id} />
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* RIGHT: detail */}
        <main>
          {active ? (
            <ProfessorDetail
              profId={active.id}
              onBack={() => setActive(null)}
              reloadKey={reloadKey}
              onReload={() => setReloadKey((k) => k + 1)}
            />
          ) : (
            <div className="bg-card border border-dashed border-lightgray px-6 py-16 text-center">
              <div className="font-editorial italic text-[1.4rem] text-gray leading-snug mb-2">
                “Pick a professor.”
              </div>
              <p className="text-mini text-gray font-archivo uppercase tracking-wider">
                Tap any professor on the left to see ratings, the 5-axis breakdown, and student advice.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function SortChip({ value, current, onChange, children }) {
  const active = value === current
  return (
    <button onClick={() => onChange(value)}
      className={`text-2xs font-archivo font-extrabold uppercase tracking-wider py-1.5 px-2.5 border cursor-pointer transition-colors ${
        active ? 'bg-navy text-gold border-navy' : 'bg-card text-ink border-lightgray hover:border-navy'
      }`}>
      {children}
    </button>
  )
}

// Same shape as SortChip but smaller + softer color so the department row
// reads as a secondary filter, not competing with the primary sort row.
function DeptChip({ value, current, onChange, children }) {
  const active = value === current
  return (
    <button onClick={() => onChange(value)}
      className={`text-[0.62rem] font-archivo font-bold uppercase tracking-wider py-1 px-2 border cursor-pointer transition-colors ${
        active ? 'bg-gold/20 text-navy border-gold' : 'bg-card text-gray border-lightgray hover:text-ink hover:border-navy'
      }`}>
      {children}
    </button>
  )
}

export default Professors
