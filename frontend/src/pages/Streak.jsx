import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { parseDateOnly } from '../utils/format'

// Streak page — shown when the user clicks the 🔥 indicator in the navbar.
//
// Pure read-only summary right now. The data we display already lives on
// `user` (streak_count, last_activity_date) so no new endpoint is needed
// for Phase 1. Future phases could add a streak-history calendar / freeze
// mechanic, but that requires a new backend endpoint and table.
//
// Streak rules (mirroring services/streak.py):
//   - Anchored to America/New_York calendar days
//   - Bumps when the user posts, comments, or hits /api/users/me/checkin
//   - Same-day actions are no-ops
//   - Missing a day resets the streak to 1 on the next bump

const APP_TZ = 'America/New_York'

function todayInAppTz() {
  // Format the current moment as a local-Baltimore YYYY-MM-DD string so
  // we can compare against the server's last_activity_date (also a
  // Baltimore-local calendar date stored as text).
  return new Date().toLocaleDateString('en-CA', { timeZone: APP_TZ })
}

function statusFor(lastActivityIso) {
  if (!lastActivityIso) return 'idle'
  const today = todayInAppTz()
  if (lastActivityIso === today) return 'active'
  // Yesterday in Baltimore = today - 1 day. We compute by parsing the
  // last-activity date as a local date (not UTC) so DST shifts don't
  // throw off the comparison.
  const last = parseDateOnly(lastActivityIso)
  if (!last) return 'idle'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: APP_TZ })
  if (lastActivityIso === yesterdayStr) return 'risk'
  return 'broken'
}

function statusCopy(status, count) {
  if (status === 'active') {
    return {
      headline: count === 1 ? 'Day 1 — nice start.' : `${count} days strong.`,
      sub: "You're locked in for today. Come back tomorrow to keep it going.",
      tone: 'success',
    }
  }
  if (status === 'risk') {
    return {
      headline: 'Your streak is on the line.',
      sub: 'Post, comment, or check in today to keep it alive — otherwise it resets to 1.',
      tone: 'warn',
    }
  }
  if (status === 'broken') {
    return {
      headline: 'Streak broken — but you can start fresh.',
      sub: 'Post or comment today and the counter starts over at Day 1.',
      tone: 'reset',
    }
  }
  return {
    headline: 'No streak yet.',
    sub: 'Post, comment, or check in to start your first streak.',
    tone: 'reset',
  }
}

const TONE_STYLES = {
  success: 'border-l-[3px] border-l-gold bg-card',
  warn: 'border-l-[3px] border-l-[#D97706] bg-warning-bg',
  reset: 'border-l-[3px] border-l-lightgray bg-card',
}

const HOW_IT_WORKS = [
  { action: 'Post', detail: 'Any new post in the feed counts.' },
  { action: 'Comment', detail: 'Replying on someone else\'s post (or your own) counts.' },
  { action: 'Check in', detail: 'Open the app and any authenticated request that hits the streak helper bumps you. Just being here often is enough.' },
]

const FAQ = [
  {
    q: 'What time zone is the streak in?',
    a: 'Baltimore (America/New_York). The day rolls over at local midnight, not UTC, so a late-night session counts the same as an early morning one.',
  },
  {
    q: 'Does voting count?',
    a: 'No — only actions that produce content (posting or commenting) and explicit check-ins count. Voting is too easy to game.',
  },
  {
    q: 'Can I freeze a streak when I\'m away?',
    a: 'Not yet. If you miss a day, the next time you post or comment the streak resets to 1.',
  },
]

function Streak() {
  const { user, isAuthed, loading } = useAuth()

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-gray text-[0.82rem] font-archivo">Loading…</div>
  }
  if (!isAuthed) {
    return <Navigate to="/login" replace />
  }

  const count = user?.streak_count || 0
  const lastIso = user?.last_activity_date || null
  const status = statusFor(lastIso)
  const copy = statusCopy(status, count)
  const lastLabel = lastIso ? (parseDateOnly(lastIso)?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) || lastIso) : '—'

  return (
    <div className="min-h-[60vh] max-w-[820px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header>
        <h1 className="font-editorial font-black text-[2rem] sm:text-[2.4rem] leading-none tracking-tight m-0">
          Activity streak
        </h1>
        <p className="text-mini text-gray font-archivo uppercase tracking-wider mt-2">
          Consecutive days you've been on BearBoard
        </p>
      </header>

      {/* Hero — current count + status copy */}
      <section className={`p-6 ${TONE_STYLES[copy.tone] || TONE_STYLES.reset}`}>
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex items-baseline gap-2 shrink-0">
            <span className="text-[3rem] leading-none" aria-hidden="true">🔥</span>
            <span className="font-editorial font-black text-[3.5rem] leading-none text-navy tabular-nums">
              {count}
            </span>
            <span className="font-archivo font-extrabold text-[0.78rem] uppercase tracking-wider text-gray ml-1">
              {count === 1 ? 'day' : 'days'}
            </span>
          </div>
          <div className="flex-1 min-w-[200px]">
            <h2 className="font-archivo font-extrabold text-[1.1rem] text-ink m-0 mb-1">
              {copy.headline}
            </h2>
            <p className="text-[0.92rem] text-ink/80 font-prose m-0 leading-snug">
              {copy.sub}
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-lightgray text-[0.82rem] text-gray font-archivo">
          <span className="font-extrabold uppercase tracking-wider">Last activity:</span> {lastLabel}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-card border border-lightgray p-5">
        <h3 className="font-archivo font-extrabold text-mini uppercase tracking-wider text-navy mb-3">
          How it works
        </h3>
        <ul className="list-none p-0 m-0 space-y-3">
          {HOW_IT_WORKS.map((item) => (
            <li key={item.action} className="flex gap-3">
              <span className="font-archivo font-extrabold text-navy text-[0.78rem] uppercase tracking-wider w-[80px] shrink-0 pt-[1px]">
                {item.action}
              </span>
              <span className="text-[0.92rem] text-ink/85 font-prose leading-snug">
                {item.detail}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Quick actions to keep the streak alive — direct links to the
          places where actions actually count. */}
      <section className="bg-card border border-lightgray p-5">
        <h3 className="font-archivo font-extrabold text-mini uppercase tracking-wider text-navy mb-3">
          Keep it going
        </h3>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/"
            className="bg-gold text-navy px-4 py-2 font-archivo font-extrabold text-[0.78rem] uppercase tracking-wider no-underline hover:opacity-90 cursor-pointer"
          >
            Open the feed
          </Link>
          <Link
            to="/groups"
            className="bg-transparent border border-navy text-navy px-4 py-2 font-archivo font-extrabold text-[0.78rem] uppercase tracking-wider no-underline hover:bg-navy hover:text-white cursor-pointer transition-colors"
          >
            Find a group
          </Link>
          <Link
            to="/events"
            className="bg-transparent border border-navy text-navy px-4 py-2 font-archivo font-extrabold text-[0.78rem] uppercase tracking-wider no-underline hover:bg-navy hover:text-white cursor-pointer transition-colors"
          >
            Browse events
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-card border border-lightgray p-5">
        <h3 className="font-archivo font-extrabold text-mini uppercase tracking-wider text-navy mb-3">
          FAQ
        </h3>
        <div className="space-y-4">
          {FAQ.map((item) => (
            <div key={item.q}>
              <div className="font-archivo font-extrabold text-[0.92rem] text-ink mb-1">
                {item.q}
              </div>
              <p className="text-[0.88rem] text-ink/80 font-prose m-0 leading-snug">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Streak
