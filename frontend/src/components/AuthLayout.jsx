import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'

const STATS = [
  { value: '6', label: 'Founders' },
  { value: '128', label: 'Posts/wk' },
  { value: 'CST', label: 'Spring 26' },
]

// Motion variants. Kept here (not at module scope) is fine — small enough
// that re-creating per render isn't worth a useMemo. The stagger numbers are
// dialed in to feel snappy on a 16ms display tick: ~80ms between siblings,
// ~280ms total to settle.
const easeOut = [0.22, 0.61, 0.36, 1]

const heroContainer = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

const heroChild = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeOut } },
}

const heroChildLeft = {
  initial: { opacity: 0, x: -18 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.55, ease: easeOut } },
}

const formPanel = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.55, ease: easeOut, delay: 0.1 } },
}

// Mobile-only entrance for the form card — slides up from below the hero
// instead of in from the right (it sits below the hero on small screens).
const formPanelMobile = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut, delay: 0.15 } },
}

function AuthLayout({ title, subtitle, children }) {
  const prefersReducedMotion = useReducedMotion()

  // When the user prefers reduced motion, render variants get neutered to
  // instant fades. Stagger still applies but motion offsets don't.
  const safe = (v) => (prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } }
    : v)

  return (
    <div className="min-h-screen bg-navy lg:bg-offwhite lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      {/* Hero - full-bleed navy on mobile; left brand panel on lg+ */}
      <motion.div
        className="relative bg-navy text-white flex flex-col overflow-hidden px-6 pt-12 pb-36 lg:p-10 lg:pb-10"
        variants={safe(heroContainer)}
        initial="initial"
        animate="animate"
      >
        {/* Gold diagonal stripe pattern */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(135deg, #FFD66B 0 1px, transparent 1px 14px)' }}
          aria-hidden
        />

        {/* Gold glow accents — slow ambient breathe, skipped under reduced motion */}
        <motion.div
          className="absolute -bottom-40 -right-32 w-[420px] h-[420px] rounded-full bg-gold/[0.14] blur-3xl pointer-events-none"
          aria-hidden
          animate={prefersReducedMotion ? undefined : { scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
          transition={prefersReducedMotion ? undefined : { duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -top-32 -left-20 w-[280px] h-[280px] rounded-full bg-gold/[0.08] blur-3xl pointer-events-none lg:hidden"
          aria-hidden
          animate={prefersReducedMotion ? undefined : { scale: [1, 1.12, 1], opacity: [0.65, 1, 0.65] }}
          transition={prefersReducedMotion ? undefined : { duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />

        {/* Wordmark */}
        <motion.div className="relative flex items-center gap-3" variants={safe(heroChildLeft)}>
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-archivo font-black text-[1.35rem] lg:text-[1.3rem] text-white no-underline tracking-tight uppercase group"
          >
            <motion.span
              className="w-9 h-9 rounded-full bg-gold text-navy flex items-center justify-center text-[1.1rem] font-black shrink-0"
              whileHover={prefersReducedMotion ? undefined : { rotate: -8, scale: 1.06 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            >
              B
            </motion.span>
            BEAR<span className="text-gold">BOARD</span>
          </Link>
        </motion.div>

        {/* Hero copy — each line staggers in */}
        <div className="relative flex-1 flex flex-col justify-center max-w-[460px] mt-8 lg:mt-0">
          <motion.span
            className="font-archivo font-extrabold text-[0.68rem] lg:text-[0.7rem] uppercase tracking-[0.22em] text-gold mb-3 lg:mb-4"
            variants={safe(heroChild)}
          >
            Morgan State &middot; Spring 26
          </motion.span>
          <motion.h1
            className="font-archivo font-black text-[2.15rem] lg:text-[2.6rem] leading-[1.05] tracking-tight uppercase mb-4"
            variants={safe(heroChild)}
          >
            What's happening
            <span className="text-gold block">at Morgan State</span>
          </motion.h1>
          <motion.p
            className="text-white/60 text-[0.88rem] lg:text-[0.92rem] leading-relaxed"
            variants={safe(heroChild)}
          >
            Posts, study groups, events, and opportunities. All in one place, by students, for students.
          </motion.p>
        </div>

        {/* Stats - desktop only */}
        <motion.div
          className="relative hidden lg:grid grid-cols-3 gap-6 border-t border-white/10 pt-6"
          variants={safe({
            initial: { opacity: 0 },
            animate: {
              opacity: 1,
              transition: { staggerChildren: 0.07, delayChildren: 0.35 },
            },
          })}
        >
          {STATS.map((s) => (
            <motion.div key={s.label} variants={safe(heroChild)}>
              <div className="font-archivo font-black text-gold text-[1.6rem] tracking-tight leading-none">{s.value}</div>
              <div className="text-white/40 text-[0.62rem] uppercase tracking-widest font-archivo font-bold mt-1.5">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Form panel - sits beside the hero on lg+, floats up into it on mobile */}
      <div className="relative -mt-24 lg:mt-0 px-5 pb-10 lg:py-10 flex items-start lg:items-center justify-center z-10">
        <div className="w-full max-w-[440px]">
          <motion.div
            className="bg-card border border-lightgray border-t-[3px] border-t-gold p-6 lg:p-7 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] lg:shadow-[0_12px_40px_-12px_rgba(11,29,52,0.22)]"
            variants={safe(formPanel)}
            initial="initial"
            animate="animate"
            // On mobile the form sits under the hero and slides up; on desktop
            // it slides in from the right. Use a hidden mobile-only div with
            // its own variant so we don't fight CSS for breakpoint behavior.
          >
            <motion.div
              className="mb-5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: easeOut, delay: prefersReducedMotion ? 0 : 0.25 }}
            >
              <h2 className="font-archivo font-black text-[1.7rem] lg:text-[1.8rem] tracking-tight text-ink leading-tight">{title}</h2>
              {subtitle && <p className="text-gray text-[0.86rem] lg:text-[0.88rem] mt-1.5">{subtitle}</p>}
            </motion.div>
            {/* Children get a delayed stagger via their own AuthFieldsStagger
                wrapper if they want it. We don't force it here so existing
                callers (Register page) don't break. */}
            {children}
          </motion.div>

          {/* Mobile-only footer blurb */}
          <motion.div
            className="lg:hidden text-center mt-5 text-white/50 text-[0.7rem] font-archivo tracking-wide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            Made with <span className="text-gold">♦</span> at Morgan State
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// Optional helper for auth pages that want a staggered cascade on their
// form fields. Wrap children with this; each immediate child gets the
// stagger. Skips animation under prefers-reduced-motion.
export function AuthFieldsStagger({ children, delay = 0.35 }) {
  const prefersReducedMotion = useReducedMotion()
  const variants = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { staggerChildren: 0, delayChildren: 0 } },
      }
    : {
        initial: { opacity: 0 },
        animate: {
          opacity: 1,
          transition: { staggerChildren: 0.07, delayChildren: delay },
        },
      }
  return (
    <motion.div variants={variants} initial="initial" animate="animate">
      {children}
    </motion.div>
  )
}

export const authFieldChild = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } },
}

export default AuthLayout
