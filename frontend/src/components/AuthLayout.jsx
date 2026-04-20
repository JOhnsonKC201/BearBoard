import { Link } from 'react-router-dom'

const STATS = [
  { value: '6', label: 'Founders' },
  { value: '128', label: 'Posts/wk' },
  { value: 'CST', label: 'Spring 26' },
]

function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-navy lg:bg-offwhite lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      {/* Hero — full-bleed navy on mobile; left brand panel on lg+ */}
      <div className="relative bg-navy text-white flex flex-col overflow-hidden px-6 pt-12 pb-36 lg:p-10 lg:pb-10">
        {/* Gold diagonal stripe pattern */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(135deg, #FFD66B 0 1px, transparent 1px 14px)' }}
          aria-hidden
        />
        {/* Gold glow accent */}
        <div className="absolute -bottom-40 -right-32 w-[420px] h-[420px] rounded-full bg-gold/[0.14] blur-3xl pointer-events-none" aria-hidden />
        <div className="absolute -top-32 -left-20 w-[280px] h-[280px] rounded-full bg-gold/[0.08] blur-3xl pointer-events-none lg:hidden" aria-hidden />

        {/* Wordmark */}
        <div className="relative flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-archivo font-black text-[1.35rem] lg:text-[1.3rem] text-white no-underline tracking-tight uppercase"
          >
            <span className="w-9 h-9 rounded-full bg-gold text-navy flex items-center justify-center text-[1.1rem] font-black shrink-0">
              B
            </span>
            BEAR<span className="text-gold">BOARD</span>
          </Link>
        </div>

        {/* Hero copy */}
        <div className="relative flex-1 flex flex-col justify-center max-w-[460px] mt-8 lg:mt-0">
          <span className="font-archivo font-extrabold text-[0.68rem] lg:text-[0.7rem] uppercase tracking-[0.22em] text-gold mb-3 lg:mb-4">
            Morgan State &middot; Spring 26
          </span>
          <h1 className="font-archivo font-black text-[2.15rem] lg:text-[2.6rem] leading-[1.05] tracking-tight uppercase mb-4">
            What's happening
            <span className="text-gold block">at Morgan State</span>
          </h1>
          <p className="text-white/60 text-[0.88rem] lg:text-[0.92rem] leading-relaxed">
            Posts, study groups, events, and opportunities. All in one place, by students, for students.
          </p>
        </div>

        {/* Stats — desktop only; the mobile version hides them so the form
             card can overlap the hero without crowding. */}
        <div className="relative hidden lg:grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="font-archivo font-black text-gold text-[1.6rem] tracking-tight leading-none">{s.value}</div>
              <div className="text-white/40 text-[0.62rem] uppercase tracking-widest font-archivo font-bold mt-1.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel — floats up into the navy hero on mobile via -mt; sits
           beside the hero on lg+. */}
      <div className="relative -mt-24 lg:mt-0 px-5 pb-10 lg:py-10 flex items-start lg:items-center justify-center z-10">
        <div className="w-full max-w-[440px]">
          <div className="bg-card border border-lightgray p-6 lg:p-7 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] lg:shadow-[0_8px_28px_-12px_rgba(11,29,52,0.18)]">
            <div className="mb-5">
              <h2 className="font-archivo font-black text-[1.7rem] lg:text-[1.8rem] tracking-tight text-ink leading-tight">{title}</h2>
              {subtitle && <p className="text-gray text-[0.86rem] lg:text-[0.88rem] mt-1.5">{subtitle}</p>}
            </div>
            {children}
          </div>

          {/* Mobile-only footer blurb */}
          <div className="lg:hidden text-center mt-5 text-white/50 text-[0.7rem] font-archivo tracking-wide">
            Made with <span className="text-gold">♦</span> at Morgan State
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
