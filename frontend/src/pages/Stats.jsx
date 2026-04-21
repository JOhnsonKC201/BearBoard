import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'

const CARDS = [
  { key: 'users', label: 'Students', hint: 'Registered accounts' },
  { key: 'posts', label: 'Posts', hint: 'All time' },
  { key: 'comments', label: 'Comments', hint: 'All time' },
  { key: 'posts_last_24h', label: 'Posts / 24h', hint: 'Live engagement' },
  { key: 'posts_last_7d', label: 'Posts / week', hint: 'Last 7 days' },
  { key: 'synced_campus_events', label: 'Campus events', hint: 'Synced from morgan.edu' },
  { key: 'sos_posts', label: 'SOS requests', hint: 'Students asking for help' },
  { key: 'sos_resolved_pct', label: 'SOS resolved', hint: '% answered by peers', suffix: '%' },
]

function Stats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiFetch('/api/stats')
      .then((data) => setStats(data))
      .catch((err) => setError(err.message || 'Failed to load stats'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-offwhite">
      <div className="bg-navy px-6 pt-10 pb-14 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(135deg, #FFD66B 0 1px, transparent 1px 14px)' }}
        />
        <div className="absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full bg-gold/[0.10] blur-3xl" />
        <div className="relative max-w-[960px] mx-auto">
          <Link to="/" className="font-archivo font-black text-[1.2rem] text-white no-underline tracking-tight uppercase">
            BEAR<span className="text-gold">BOARD</span>
          </Link>
          <div className="mt-10 max-w-[640px]">
            <span className="font-archivo font-extrabold text-[0.7rem] uppercase tracking-[0.22em] text-gold">
              The numbers &middot; Live
            </span>
            <h1 className="font-archivo font-black text-white text-[2.4rem] leading-[1.05] tracking-tight uppercase mt-3">
              Campus life, <span className="text-gold">measured.</span>
            </h1>
            <p className="text-white/55 text-[0.92rem] leading-relaxed mt-3">
              Real-time metrics from BearBoard. Updated every request. Not a mockup.
            </p>
          </div>
        </div>
      </div>
      <hr className="h-[3px] bg-gold border-none m-0" />

      <div className="max-w-[960px] mx-auto px-6 py-10">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-card border border-lightgray p-5">
                <div className="skeleton h-[26px] w-[70%] mb-3" />
                <div className="skeleton h-[10px] w-[50%]" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-card border border-lightgray px-6 py-6 text-center">
            <div className="text-[#8B1A1A] font-archivo font-bold">{error}</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CARDS.map((c) => {
              const raw = stats?.[c.key]
              const value = raw === null || raw === undefined ? '-' : `${raw}${c.suffix || ''}`
              return (
                <div key={c.key} className="bg-card border border-lightgray p-5 transition-all hover:border-navy hover:-translate-y-[1px] hover:shadow-[0_4px_18px_-8px_rgba(11,29,52,0.18)]">
                  <div className="font-archivo font-black text-[2rem] text-navy leading-none tracking-tight">{value}</div>
                  <div className="font-archivo font-extrabold text-[0.65rem] uppercase tracking-widest text-ink mt-3">{c.label}</div>
                  <div className="text-[0.72rem] text-gray mt-[2px]">{c.hint}</div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-10 grid md:grid-cols-2 gap-3">
          <div className="bg-navy text-white p-6 border-l-[3px] border-l-gold">
            <div className="font-archivo font-extrabold text-[0.62rem] uppercase tracking-[0.2em] text-gold mb-2">What we built</div>
            <ul className="text-[0.82rem] text-white/75 leading-relaxed space-y-1.5 list-disc pl-4">
              <li>Campus feed with sort / filter / optimistic voting</li>
              <li>Anonymous SOS posts that notify peers in the same major</li>
              <li>Resurfacing of unanswered posts after 24h</li>
              <li>Housing &amp; furniture swap board</li>
              <li>Campus Safety widget with tap-to-call emergency lines</li>
              <li>Live sync of official morgan.edu events every 6 hours</li>
            </ul>
          </div>
          <div className="bg-card border border-lightgray p-6">
            <div className="font-archivo font-extrabold text-[0.62rem] uppercase tracking-[0.2em] text-gray mb-2">Stack</div>
            <div className="text-[0.85rem] leading-relaxed">
              <p className="mb-2"><b>Backend:</b> FastAPI, SQLAlchemy, Alembic, APScheduler.</p>
              <p className="mb-2"><b>Frontend:</b> React, Vite, Tailwind.</p>
              <p className="mb-2"><b>Auth:</b> JWT tokens, role-based permissions (admin / moderator / developer / student).</p>
              <p><b>Integrations:</b> iCal feed parsing, in-app AI chat.</p>
            </div>
            <Link to="/" className="inline-block mt-4 bg-gold text-navy font-archivo font-extrabold text-[0.7rem] uppercase tracking-wide px-4 py-2 no-underline hover:bg-[#E5A92E] transition-colors">
              See the product &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Stats
