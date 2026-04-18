import { Link } from 'react-router-dom'

const STATS = [
  { value: '6', label: 'Founders' },
  { value: '128', label: 'Posts/wk' },
  { value: 'CST', label: 'Spring 26' },
]

function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-offwhite grid lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      {/* Left brand panel */}
      <div className="hidden lg:flex relative bg-navy text-white p-10 flex-col overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(135deg, #FFD66B 0 1px, transparent 1px 14px)',
          }}
        />
        <div className="absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full bg-gold/[0.12] blur-3xl" />

        <Link to="/" className="relative font-archivo font-black text-[1.3rem] text-white no-underline tracking-tight uppercase">
          BEAR<span className="text-gold">BOARD</span>
        </Link>

        <div className="relative flex-1 flex flex-col justify-center max-w-[420px]">
          <span className="font-archivo font-extrabold text-[0.7rem] uppercase tracking-[0.22em] text-gold mb-4">
            Morgan State &middot; Sprint 1
          </span>
          <h1 className="font-archivo font-black text-[2.6rem] leading-[1.05] tracking-tight uppercase mb-4">
            What's happening{' '}
            <span className="text-gold block">at Morgan State</span>
          </h1>
          <p className="text-white/55 text-[0.92rem] leading-relaxed">
            Posts, study groups, events, and opportunities. All in one place, by students, for students.
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="font-archivo font-black text-gold text-[1.6rem] tracking-tight leading-none">{s.value}</div>
              <div className="text-white/40 text-[0.62rem] uppercase tracking-widest font-archivo font-bold mt-1.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden text-center mb-6">
            <Link to="/" className="font-archivo font-black text-[1.4rem] text-navy no-underline uppercase tracking-tight">
              BEAR<span className="text-gold">BOARD</span>
            </Link>
          </div>
          <div className="mb-6">
            <h2 className="font-archivo font-black text-[1.8rem] tracking-tight text-ink">{title}</h2>
            {subtitle && <p className="text-gray text-[0.88rem] mt-1.5">{subtitle}</p>}
          </div>
          <div className="bg-card border border-lightgray p-6 shadow-[0_8px_28px_-12px_rgba(11,29,52,0.18)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
