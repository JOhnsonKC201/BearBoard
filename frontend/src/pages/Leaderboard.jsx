import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { apiFetch } from '../api/client'
import RoleBadge from '../components/RoleBadge'

/**
 * Leaderboard — "the standings page" of the campus paper, animated.
 *
 * Single GET /api/leaderboard call returns all five boards at once so the
 * page renders fast on Render's free tier.
 *
 * Motion choices:
 * - Hero title slides in from the left with a staggered gold underline swipe.
 * - Board cards appear in a staggered column reveal (whileInView so scroll
 *   triggers them on tall viewports).
 * - Rows inside each board slide in with a top-down stagger; top-3 rows
 *   get a subtle gold pulse on the medal emoji.
 * - Metric numbers count up from 0 to the final value (framer animate count).
 * - Row hover: gold translation + slight scale + thicker left border.
 */

const BOARDS = [
  {
    key: 'top_posters',
    title: 'Most dispatches filed',
    kicker: 'Volume of non-anonymous posts',
    metricField: 'post_count',
    metricLabel: 'posts',
    medal: '✍️',
    tint: 'from-gold/15 to-transparent',
  },
  {
    key: 'longest_streak',
    title: 'Longest visit streak',
    kicker: 'Consecutive Baltimore-local days active',
    metricField: 'streak_count',
    metricLabel: 'days',
    medal: '🔥',
    tint: 'from-red/15 to-transparent',
  },
  {
    key: 'most_active',
    title: 'Most contributions',
    kicker: 'Posts + comments combined',
    metricField: 'contribution_count',
    metricLabel: 'total',
    medal: '⚡',
    tint: 'from-purple/15 to-transparent',
  },
  {
    key: 'top_helpful',
    title: 'Most helpful voices',
    kicker: 'Cumulative net upvotes on their posts',
    metricField: 'net_upvotes',
    metricLabel: 'net',
    medal: '👍',
    tint: 'from-teal/15 to-transparent',
  },
  {
    key: 'top_karma',
    title: 'Top karma',
    kicker: 'Running karma from votes',
    metricField: 'karma',
    metricLabel: 'karma',
    medal: '🏅',
    tint: 'from-gold/15 to-transparent',
  },
]


// Animated counter — counts from 0 up to `value` over 900ms with easing.
function CountUp({ value }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const target = Number(value) || 0
    const start = performance.now()
    const duration = 900
    let raf
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration)
      // easeOutQuart
      const eased = 1 - Math.pow(1 - p, 4)
      setN(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{n.toLocaleString()}</>
}


function Rank({ index }) {
  const isTop3 = index < 3
  return (
    <motion.div
      className={`shrink-0 font-archivo font-black leading-none tabular-nums select-none ${
        isTop3 ? 'text-gold text-[1.7rem]' : 'text-navy/40 text-[1.05rem]'
      }`}
      style={{ width: 40 }}
      aria-label={`Rank ${index + 1}`}
      animate={isTop3 ? { y: [0, -2, 0] } : undefined}
      transition={isTop3 ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.3 } : undefined}
    >
      {String(index + 1).padStart(2, '0')}
    </motion.div>
  )
}


function Row({ user, metricValue, metricLabel, index, board }) {
  const handle = (user.name || '').split(/\s+/)[0]?.toLowerCase() || 'student'
  const isTop3 = index < 3
  return (
    <motion.div
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: 0.04 + index * 0.04, ease: [0.22, 0.61, 0.36, 1] }}
      whileHover={{ x: 3 }}
    >
      <Link
        to={`/profile/${user.id}`}
        className="group flex items-center gap-3 px-4 py-3 border-b border-[#EAE7E0] last:border-b-0 no-underline text-ink transition-colors hover:bg-offwhite relative overflow-hidden"
      >
        {/* Subtle gold sweep on hover for the top 3 — invisible on others. */}
        {isTop3 && (
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-[3px] bg-gold/80 transition-all duration-300 group-hover:w-full group-hover:bg-gold/10"
          />
        )}
        <Rank index={index} />
        <div className="flex-1 min-w-0 relative">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-archivo font-extrabold text-[0.94rem] text-navy truncate group-hover:text-navy">
              {user.name}
            </span>
            <RoleBadge role={user.role} />
          </div>
          <div className="text-[0.72rem] text-gray mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="font-archivo font-bold uppercase tracking-wider">
              u/{handle}
            </span>
            {user.major && (
              <>
                <span className="text-gold">&middot;</span>
                <span>{user.major}</span>
              </>
            )}
            {user.graduation_year && (
              <>
                <span className="text-gold">&middot;</span>
                <span>&apos;{String(user.graduation_year).slice(-2)}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 relative">
          <div
            className="font-editorial text-navy leading-none"
            style={{ fontSize: '1.55rem', fontWeight: 600, fontStyle: 'italic' }}
          >
            <CountUp value={metricValue} />
          </div>
          <div className="font-archivo text-[0.58rem] uppercase tracking-[0.2em] text-gray mt-1">
            {metricLabel}
          </div>
        </div>
        {isTop3 && (
          <motion.span
            className="text-[1.2rem] shrink-0"
            aria-hidden
            animate={{ rotate: [0, -8, 8, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: index * 0.5 }}
          >
            {board.medal}
          </motion.span>
        )}
      </Link>
    </motion.div>
  )
}


function Board({ board, rows, loading, delay = 0 }) {
  return (
    <motion.section
      className="bg-card border border-lightgray overflow-hidden relative"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.45, delay, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {/* Decorative gradient sheen on the header — subtle, brand-color. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-[68px] bg-gradient-to-b ${board.tint} opacity-60`}
      />
      <header className="bg-navy text-gold px-4 py-3 border-b-[2px] border-b-gold relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-archivo font-black text-[0.62rem] uppercase tracking-[0.28em]">
              {board.title}
            </div>
            <div
              className="text-white/70 text-[0.82rem] mt-0.5 italic leading-snug"
              style={{ fontFamily: 'Fraunces, Georgia, serif' }}
            >
              {board.kicker}
            </div>
          </div>
          <motion.div
            className="text-[1.4rem] shrink-0"
            aria-hidden
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            {board.medal}
          </motion.div>
        </div>
      </header>
      {loading ? (
        <div className="px-4 py-10 text-center text-gray text-[0.82rem] font-archivo">
          <motion.span
            className="inline-block"
            animate={{ opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            Tallying the scores…
          </motion.span>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-gray text-[0.82rem]">
          Nobody&rsquo;s on the board yet. Post something and come back.
        </div>
      ) : (
        <ul>
          {rows.map((u, i) => (
            <li key={`${board.key}-${u.id}`}>
              <Row
                user={u}
                metricValue={u[board.metricField] ?? 0}
                metricLabel={board.metricLabel}
                index={i}
                board={board}
              />
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  )
}


function Leaderboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiFetch('/api/leaderboard')
      .then((d) => { if (!cancelled) setData(d) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-offwhite pb-16">
      {/* Hero — matches the shared navy-band pattern, with motion flourishes. */}
      <div className="bg-navy relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(135deg, #D4962A 0 1px, transparent 1px 14px)' }}
        />
        {/* Floating gold blob — slow drift. */}
        <motion.div
          aria-hidden
          className="absolute -bottom-48 -right-40 w-[560px] h-[560px] rounded-full bg-gold/[0.12] blur-3xl"
          animate={{ x: [0, 24, 0], y: [0, -12, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="absolute -top-24 -left-24 w-[340px] h-[340px] rounded-full bg-gold/[0.08] blur-3xl"
          animate={{ x: [0, -18, 0], y: [0, 16, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-12 relative">
          <motion.div
            className="font-archivo font-extrabold text-[0.62rem] uppercase tracking-[0.28em] text-gold mb-2"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            The standings
          </motion.div>
          <motion.h1
            className="font-archivo font-black text-white text-[2.2rem] sm:text-[2.8rem] leading-[1.02] tracking-tight uppercase"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 0.61, 0.36, 1] }}
          >
            BearBoard{' '}
            <motion.span
              className="text-gold inline-block relative"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Leaderboard
              <motion.span
                className="absolute left-0 right-0 -bottom-1 h-[4px] bg-gold origin-left"
                aria-hidden
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
              />
            </motion.span>
          </motion.h1>
          <motion.p
            className="text-white/70 text-[0.96rem] leading-relaxed mt-4 max-w-[640px]"
            style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            Who&rsquo;s running the feed this semester. Five boards, top ten each,
            refreshed live from your activity. Anonymous posts are excluded
            so the rankings can&rsquo;t out an author.
          </motion.p>
        </div>
      </div>
      <hr className="h-[3px] bg-gold border-none m-0" />

      <div className="max-w-[1100px] mx-auto px-5 sm:px-8 pt-10">
        {error ? (
          <div className="bg-danger-bg border border-danger-border text-danger px-4 py-3 font-archivo font-bold">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <AnimatePresence>
              {BOARDS.map((b, i) => (
                <Board
                  key={b.key}
                  board={b}
                  rows={data?.[b.key] ?? []}
                  loading={loading}
                  delay={0.1 + i * 0.08}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        <motion.aside
          className="mt-10 bg-card border border-lightgray px-5 py-5 text-[0.86rem] text-ink/80 leading-relaxed"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4 }}
        >
          <div className="font-archivo font-extrabold text-[0.66rem] uppercase tracking-[0.22em] text-navy mb-2">
            How the numbers work
          </div>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Streaks</strong> count consecutive days you did something
              on BearBoard. Days are measured in Morgan-local time (America/New_York),
              not UTC, so a late-evening visit stays on today&rsquo;s count.
            </li>
            <li>
              <strong>Karma</strong> is the sum of upvotes minus downvotes across
              your non-anonymous posts, recomputed by the server whenever someone
              votes.
            </li>
            <li>
              <strong>Contributions</strong> combines posts and comments so
              students who mostly reply and help others get credit, not just
              loud posters.
            </li>
            <li>
              <strong>Helpfulness</strong> is cumulative net upvotes per author —
              the same karma quantity, but displayed to highlight the quality
              signal rather than the running score.
            </li>
            <li>
              <strong>Anonymous posts and comments</strong> are excluded so
              rankings never hint at who authored a private thread.
            </li>
          </ul>
        </motion.aside>
      </div>
    </div>
  )
}

export default Leaderboard
