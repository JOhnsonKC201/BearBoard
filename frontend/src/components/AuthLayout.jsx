import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { LogoIcon } from './Logo'
import FloatingParticles from './FloatingParticles'

const STATS = [
  { value: '6', label: 'Founders' },
  { value: '128', label: 'Posts/wk' },
  { value: 'CST', label: 'Spring 26' },
]

// Motion variants. Bumped from "tasteful" to "actually noticeable" — bigger
// travel distances, slightly slower so the eye can read the motion, longer
// stagger between siblings so each piece registers as its own entrance.
const easeOut = [0.22, 0.61, 0.36, 1]
const easeBack = [0.16, 1, 0.32, 1]   // overshoot-y "pop" curve

const heroContainer = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.14, delayChildren: 0.1 },
  },
}

const heroChild = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeBack } },
}

const heroChildLeft = {
  initial: { opacity: 0, x: -50 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.75, ease: easeBack } },
}

const formPanel = {
  initial: { opacity: 0, x: 80, scale: 0.96 },
  animate: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.8, ease: easeBack, delay: 0.2 } },
}

// Word-by-word reveal for the hero headline. Each word slides up + fades in,
// 70ms apart, so the headline reads as a typed-in / staged moment instead
// of arriving as one block.
const wordContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.07 } },
}
const wordChild = {
  initial: { opacity: 0, y: 28, rotateX: -45 },
  animate: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.55, ease: easeBack } },
}

function AnimatedHeadline({ children, className }) {
  // Splits the visible text into words, wraps each in a motion.span. The
  // outer span has overflow-hidden so words appear to rise out of an
  // invisible baseline rather than just fade through their final position.
  const words = String(children).split(' ')
  return (
    <motion.span className={className} variants={wordContainer} initial="initial" animate="animate">
      {words.map((w, i) => (
        <span key={`${w}-${i}`} className="inline-block overflow-hidden align-bottom">
          <motion.span className="inline-block" variants={wordChild} style={{ transformOrigin: '50% 100%' }}>
            {w}{i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </motion.span>
  )
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
        {/* Gold diagonal stripe pattern — slow continuous drift so the
            background never reads as a still image. The repeating-linear-
            gradient is 14px between stripes; we shift backgroundPosition
            by 28px (two periods) over 12s to keep the motion smooth and
            seamless without a visible "wrap" jump. */}
        <motion.div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(135deg, #FFD66B 0 1px, transparent 1px 14px)' }}
          aria-hidden
          animate={prefersReducedMotion ? undefined : { backgroundPositionX: ['0px', '28px'], backgroundPositionY: ['0px', '-28px'] }}
          transition={prefersReducedMotion ? undefined : { duration: 12, repeat: Infinity, ease: 'linear' }}
        />

        {/* Floating gold particles — dense field of tiny dots drift up
            the hero with staggered durations. Pure decoration; component
            no-ops under reduced motion. */}
        <FloatingParticles count={26} seed={1337} />

        {/* Gold glow accents — bigger, more visible breathe so the navy
            background never reads as static. Skipped under reduced motion. */}
        <motion.div
          className="absolute -bottom-40 -right-32 w-[520px] h-[520px] rounded-full bg-gold/[0.22] blur-3xl pointer-events-none"
          aria-hidden
          animate={prefersReducedMotion ? undefined : { scale: [1, 1.25, 1], opacity: [0.5, 1, 0.5], x: [0, 30, 0] }}
          transition={prefersReducedMotion ? undefined : { duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -top-32 -left-20 w-[360px] h-[360px] rounded-full bg-gold/[0.18] blur-3xl pointer-events-none"
          aria-hidden
          animate={prefersReducedMotion ? undefined : { scale: [1, 1.3, 1], opacity: [0.4, 0.95, 0.4], y: [0, 25, 0] }}
          transition={prefersReducedMotion ? undefined : { duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        {/* One-shot diagonal highlight sweep on page load — a subtle
            band of light passes across the hero, like a marquee opening. */}
        {!prefersReducedMotion && (
          <motion.div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            initial={{ x: '-110%', opacity: 0 }}
            animate={{ x: '110%', opacity: [0, 0.4, 0] }}
            transition={{ duration: 1.6, ease: 'easeOut', delay: 0.3 }}
            style={{ background: 'linear-gradient(105deg, transparent 35%, rgba(255,214,107,0.25) 50%, transparent 65%)' }}
          />
        )}

        {/* Wordmark */}
        <motion.div className="relative flex items-center gap-3" variants={safe(heroChildLeft)}>
          <Link
            to="/"
            className="inline-flex items-center gap-3 font-archivo font-black text-[1.35rem] lg:text-[1.3rem] text-white no-underline tracking-tight uppercase group"
            aria-label="BearBoard home"
          >
            <motion.span
              className="shrink-0 inline-flex"
              whileHover={prefersReducedMotion ? undefined : { rotate: -6, scale: 1.06 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            >
              <LogoIcon size={40} />
            </motion.span>
            BEAR<ShimmerWord text="BOARD" enabled={!prefersReducedMotion} />
          </Link>
        </motion.div>

        {/* Hero copy — each line staggers in */}
        <div className="relative flex-1 flex flex-col justify-center max-w-[460px] mt-8 lg:mt-0">
          <motion.span
            className="font-archivo font-extrabold text-[0.68rem] lg:text-[0.7rem] uppercase tracking-[0.22em] text-gold mb-3 lg:mb-4 inline-flex items-center gap-3"
            variants={safe(heroChild)}
          >
            {!prefersReducedMotion && (
              // Underline first draws in (one-shot), then loops a gentle
              // width breathe so the rule keeps feeling alive instead of
              // settling into a static line.
              <motion.span
                aria-hidden
                className="block h-[2px] bg-gold origin-left"
                initial={{ scaleX: 0, width: 28 }}
                animate={{ scaleX: 1, width: [28, 44, 28] }}
                transition={{
                  scaleX: { duration: 0.7, ease: easeBack, delay: 0.65 },
                  width: { duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1.3 },
                }}
              />
            )}
            Morgan State &middot; Spring 26
          </motion.span>
          <motion.h1
            className="font-archivo font-black text-[2.15rem] lg:text-[2.6rem] leading-[1.05] tracking-tight uppercase mb-4"
            variants={safe(heroChild)}
          >
            {prefersReducedMotion ? (
              <>
                What's happening
                <span className="text-gold block">at Morgan State</span>
              </>
            ) : (
              <>
                <AnimatedHeadline>What's happening</AnimatedHeadline>
                <AnimatedHeadline className="text-gold block">at Morgan State</AnimatedHeadline>
              </>
            )}
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
            className="relative bg-card border border-lightgray border-t-[3px] border-t-gold p-6 lg:p-7 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] lg:shadow-[0_12px_40px_-12px_rgba(11,29,52,0.22)] overflow-hidden"
            variants={safe(formPanel)}
            initial="initial"
            animate="animate"
            whileHover={prefersReducedMotion ? undefined : { y: -2, boxShadow: '0 18px 48px -12px rgba(11,29,52,0.32)' }}
            transition={{ type: 'spring', stiffness: 240, damping: 20 }}
          >
            {/* Continuous gold-glow sliver moves across the top border, like
                a slow scanline. Sits over the existing border-t-gold so the
                base color stays even when the sliver isn't on screen. */}
            {!prefersReducedMotion && (
              <motion.div
                aria-hidden
                className="absolute top-0 left-0 h-[3px] w-1/3 bg-gradient-to-r from-transparent via-white/85 to-transparent pointer-events-none"
                animate={{ x: ['-50%', '350%'] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }}
              />
            )}
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
export function AuthFieldsStagger({ children, delay = 0.55 }) {
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
          transition: { staggerChildren: 0.11, delayChildren: delay },
        },
      }
  return (
    <motion.div variants={variants} initial="initial" animate="animate">
      {children}
    </motion.div>
  )
}

export const authFieldChild = {
  initial: { opacity: 0, y: 24, x: 12 },
  animate: { opacity: 1, y: 0, x: 0, transition: { duration: 0.5, ease: easeBack } },
}


// ShimmerWord — wraps a word in a span that periodically gets a moving
// gradient sweep across it. Used for the gold "BOARD" in the wordmark so
// it occasionally "catches the light." Disabled under reduced motion;
// just renders plain gold-colored text in that case.
function ShimmerWord({ text, enabled }) {
  if (!enabled) {
    return <span className="text-gold">{text}</span>
  }
  return (
    <span className="relative inline-block text-gold">
      <span aria-hidden style={{ visibility: 'hidden' }}>{text}</span>
      {/* Base gold layer (stays visible always) */}
      <span aria-hidden className="absolute inset-0 text-gold">{text}</span>
      {/* Moving white gradient sweep — periodic, masked to the text shape via
          background-clip: text. The transform shifts the gradient origin
          across the text width over ~1.4s, then waits ~6s before sweeping
          again. */}
      <motion.span
        aria-hidden
        className="absolute inset-0 bg-clip-text text-transparent"
        style={{
          backgroundImage: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.95) 50%, transparent 70%)',
          backgroundSize: '220% 100%',
          WebkitBackgroundClip: 'text',
        }}
        animate={{ backgroundPositionX: ['200%', '-100%'] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 5 }}
      >
        {text}
      </motion.span>
      <span className="sr-only">{text}</span>
    </span>
  )
}

export default AuthLayout
