import { Link } from 'react-router-dom'
import { LogoIcon } from './Logo'

/* =============================================================================
 * Footer — "Broadsheet colophon"
 *
 * Sits at the bottom of every content page (rendered via WithNav in App.jsx).
 * Not shown on /login and /register — those use their own full-bleed layout.
 *
 * Design direction:
 * - Treat the footer like the back page of a newspaper — dense, editorial,
 *   with a proper colophon strip at the very bottom.
 * - Navy surface with a 6px gold rule on top (matches the rules elsewhere
 *   on the app). Tiny SVG turbulence grain overlay so the dark panel doesn't
 *   read as flat digital black.
 * - Column headers in Archivo Black all-caps tight-tracked. Link labels in
 *   Libre Franklin. Brand + tagline pair Archivo Black with Fraunces italic.
 * - Team list styled as a masthead: name on the left, role right-aligned,
 *   hairline between rows. The only decorative move here.
 *
 * Accessibility:
 * - Single <footer role="contentinfo"> landmark so screen readers can jump.
 * - Each column gets an aria-labelledby heading so navigation links group
 *   semantically.
 * - Links carry visible focus-visible ring in gold on navy.
 * ========================================================================== */

// Inline SVG turbulence noise, 220x220 tile. Base64 would be smaller but less
// inspectable; the %-encoded form stays readable in DevTools.
const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.10 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`

const BROWSE_LINKS = [
  { to: '/', label: 'Feed' },
  { to: '/?sort=popular', label: 'Popular' },
  { to: '/?sort=trending', label: 'Trending' },
  // Hash targets must match real ids on the home page (see Home.jsx
  // SideBox calls + the team section). ScrollToTop handles scroll-on-mount.
  { to: '/#events-box', label: 'Events' },
  { to: '/#groups', label: 'Groups' },
  { to: '/map', label: 'Campus Map' },
  { to: '/professors', label: 'Professors' },
  { to: '/stats', label: 'The Stats' },
]

const COMMUNITY_LINKS = [
  { to: '/welcome', label: 'Welcome & FAQ' },
  { to: '/rules', label: 'House rules' },
  { to: '/anonymity', label: 'Anonymity guide' },
  { to: '/resources', label: 'Campus resources' },
  { to: '/crosslinks', label: 'Related communities' },
]

const LEGAL_LINKS = [
  { to: '/privacy', label: 'Privacy policy' },
  { to: '/terms', label: 'Terms of use' },
  { to: '/accessibility', label: 'Accessibility' },
  { to: '/anonymity', label: 'Anonymity guarantees' },
  { to: '/rules', label: 'Community rules' },
]

const TEAM = [
  { name: 'Kyndal Maclin', role: 'Product Owner' },
  { name: 'Oluwajomiloju King', role: 'Scrum Master' },
  { name: 'Aayush Shrestha', role: 'Backend · AI' },
  { name: 'Sameer Shiwakoti', role: 'Frontend' },
  { name: 'Rohan Sainju', role: 'UI / UX' },
  { name: 'Johnson KC', role: 'Full Stack · Admin' },
]

// Hash-prefixed links work only on the home route. Smooth scroll to the
// anchor when we're already on /, otherwise let react-router handle the
// cross-page navigation via /#hash (handled by the Home scroll-on-mount).
function FooterLink({ to, label }) {
  const isHash = to.includes('#')
  const cls =
    'group inline-flex items-center gap-1 text-[0.82rem] font-franklin text-white/70 hover:text-gold no-underline transition-colors py-1 focus-visible:outline-none focus-visible:text-gold focus-visible:underline underline-offset-4'
  if (isHash) {
    return (
      <a href={to} className={cls}>
        <span>{label}</span>
        <span className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity text-gold" aria-hidden>
          →
        </span>
      </a>
    )
  }
  return (
    <Link to={to} className={cls}>
      <span>{label}</span>
      <span className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity text-gold" aria-hidden>
        →
      </span>
    </Link>
  )
}

function ColumnHeading({ id, children }) {
  return (
    <h2
      id={id}
      className="font-archivo font-black text-[0.68rem] uppercase tracking-[0.28em] text-gold mb-4 pb-2 border-b border-white/15"
    >
      {children}
    </h2>
  )
}

/* ----------------------------------------------------------------------- */
/*  MobileLinkGroup — collapsible <details> section for the mobile footer. */
/*                                                                         */
/*  Mobile only. The desktop layout below uses the static ColumnHeading +  */
/*  flat <ul>; on mobile we collapse each group behind a tap target so the */
/*  footer stops being a 25-link single-column scroll wall. The chevron    */
/*  rotates 90° when open via the `[open]` selector — no React state.      */
/* ----------------------------------------------------------------------- */
function MobileLinkGroup({ title, items, renderItem }) {
  return (
    <details className="group border-b border-white/12 last:border-b-0">
      <summary className="list-none cursor-pointer py-4 flex items-center justify-between gap-3 select-none">
        <span className="font-archivo font-black text-[0.7rem] uppercase tracking-[0.28em] text-gold">
          {title}
        </span>
        <span
          aria-hidden
          className="text-gold/70 text-[0.78rem] font-archivo font-bold transition-transform group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="pb-3 -mt-1">{items.map(renderItem)}</div>
    </details>
  )
}

function Wordmark() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-3 font-archivo font-black text-[1.45rem] tracking-[-0.02em] no-underline leading-none"
      aria-label="BearBoard home"
    >
      <LogoIcon size={36} />
      <span className="inline-flex items-baseline">
        <span className="text-white">BEAR</span>
        <span className="text-gold">BOARD</span>
      </span>
    </Link>
  )
}

function Footer() {
  const now = new Date()
  const MONTH_LONG = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
  ]
  const month = MONTH_LONG[now.getMonth()]
  const day = now.getDate()
  const year = now.getFullYear()
  // Stable "issue number" = day-of-year. Matches the masthead on MobileHome
  // so the date feels like a real running count.
  const startOfYear = new Date(year, 0, 1)
  const issue = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24)) + 1

  return (
    <footer
      role="contentinfo"
      className="relative bg-navy text-white mt-16 overflow-hidden"
      aria-labelledby="footer-brand"
    >
      {/* Gold rule */}
      <div aria-hidden className="h-[6px] bg-gold w-full" />

      {/* Grain overlay — pins to the absolute bottom of the viewport
           so scrolling doesn't reveal the tile boundary. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.55] mix-blend-screen"
        style={{ backgroundImage: GRAIN, backgroundSize: '220px 220px' }}
      />

      {/* Diagonal hatching — echoes the banner hatching on /profile. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, #D4962A 0 1px, transparent 1px 18px)' }}
      />

      <div className="relative max-w-[1200px] mx-auto px-5 sm:px-8 pt-10 sm:pt-12 pb-24 lg:pb-8">
        {/* Brand row */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-8 sm:mb-10 pb-5 sm:pb-6 border-b border-white/15">
          <div>
            <div id="footer-brand">
              <Wordmark />
            </div>
            <p
              className="mt-3 text-white/75 max-w-[44ch] leading-relaxed"
              style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontSize: '1.04rem', fontWeight: 400 }}
            >
              Morgan State · a student-run community board. Built by Bears,
              for Bears, with a taste for broadsheet typography.
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="font-archivo font-black text-gold text-[0.58rem] uppercase tracking-[0.32em]">
              The Daily BearBoard
            </div>
            <div
              className="font-archivo font-bold text-white/85 text-[0.82rem] tabular-nums tracking-wider mt-1"
              aria-label={`Dateline ${month} ${day}, ${year}, issue ${issue}`}
            >
              {month} {day}, {year} · VOL. SPRING · №{issue}
            </div>
          </div>
        </div>

        {/* Columns — mobile accordion (lg:hidden) */}
        <div className="lg:hidden -mx-1">
          <MobileLinkGroup
            title="Browse"
            items={BROWSE_LINKS}
            renderItem={(l) => (
              <FooterLink key={l.to + l.label} to={l.to} label={l.label} />
            )}
          />
          <MobileLinkGroup
            title="Community"
            items={COMMUNITY_LINKS}
            renderItem={(l) => (
              <FooterLink key={l.to + l.label} to={l.to} label={l.label} />
            )}
          />
          <MobileLinkGroup
            title="Legal"
            items={LEGAL_LINKS}
            renderItem={(l) => (
              <FooterLink key={l.to + l.label} to={l.to} label={l.label} />
            )}
          />
          <MobileLinkGroup
            title="The Team"
            items={TEAM}
            renderItem={(m) => (
              <div
                key={m.name}
                className="flex items-baseline justify-between gap-3 py-1.5"
              >
                <span className="font-archivo font-bold text-[0.86rem] text-white">
                  {m.name}
                </span>
                <span
                  className="text-[0.7rem] text-white/55 italic shrink-0"
                  style={{ fontFamily: 'Fraunces, Georgia, serif' }}
                >
                  {m.role}
                </span>
              </div>
            )}
          />
          <div className="mt-4 text-[0.7rem] text-gold/75 font-archivo font-extrabold uppercase tracking-[0.18em]">
            COSC 458 · Spring 2026
          </div>
        </div>

        {/* Columns — desktop (lg+) flat layout */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-x-8 gap-y-8">
          <nav className="lg:col-span-3" aria-labelledby="footer-h-browse">
            <ColumnHeading id="footer-h-browse">Browse</ColumnHeading>
            <ul className="flex flex-col">
              {BROWSE_LINKS.map((l) => (
                <li key={l.to + l.label}>
                  <FooterLink to={l.to} label={l.label} />
                </li>
              ))}
            </ul>
          </nav>

          <nav className="lg:col-span-3" aria-labelledby="footer-h-community">
            <ColumnHeading id="footer-h-community">Community</ColumnHeading>
            <ul className="flex flex-col">
              {COMMUNITY_LINKS.map((l) => (
                <li key={l.to + l.label}>
                  <FooterLink to={l.to} label={l.label} />
                </li>
              ))}
            </ul>
          </nav>

          <nav className="lg:col-span-2" aria-labelledby="footer-h-legal">
            <ColumnHeading id="footer-h-legal">Legal</ColumnHeading>
            <ul className="flex flex-col">
              {LEGAL_LINKS.map((l) => (
                <li key={l.to + l.label}>
                  <FooterLink to={l.to} label={l.label} />
                </li>
              ))}
            </ul>
          </nav>

          <section className="lg:col-span-4" aria-labelledby="footer-h-team">
            <ColumnHeading id="footer-h-team">The Team</ColumnHeading>
            <ul className="flex flex-col divide-y divide-white/10">
              {TEAM.map((m) => (
                <li
                  key={m.name}
                  className="flex items-baseline justify-between gap-3 py-1.5"
                >
                  <span className="font-archivo font-bold text-[0.86rem] text-white">
                    {m.name}
                  </span>
                  <span
                    className="text-[0.7rem] text-white/55 italic shrink-0"
                    style={{ fontFamily: 'Fraunces, Georgia, serif' }}
                  >
                    {m.role}
                  </span>
                </li>
              ))}
            </ul>
            <div
              className="mt-3 text-[0.7rem] text-gold/75 font-archivo font-extrabold uppercase tracking-[0.18em]"
            >
              COSC 458 · Spring 2026
            </div>
          </section>
        </div>

        {/* Disclaimer */}
        <aside
          className="mt-10 pt-6 border-t border-white/15 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 md:gap-8"
          aria-label="Disclaimer"
        >
          <div className="font-archivo font-black text-gold text-[0.6rem] uppercase tracking-[0.3em] md:text-right md:pt-1">
            Disclaimer
          </div>
          <p
            className="text-white/72 text-[0.82rem] leading-relaxed max-w-[78ch]"
            style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}
          >
            BearBoard is a student project produced for COSC 458 at Morgan State University.
            It is <strong className="not-italic font-archivo font-extrabold text-white">not affiliated with,
            endorsed by, or operated by</strong> Morgan State University. Posts and comments
            represent the views of the students who wrote them, not the school, the team, or any
            student organization. Crisis-level content should be directed to the University
            Counseling Center ((443) 885-3130) or the 988 Suicide &amp; Crisis Lifeline — we are
            not a substitute for either. Use your judgment, be kind to your classmates, and read
            the{' '}
            <Link to="/rules" className="underline underline-offset-4 text-gold hover:text-white focus-visible:outline-none focus-visible:text-white">
              community rules
            </Link>.
          </p>
        </aside>
      </div>

      {/* Colophon strip */}
      <div className="relative border-t border-white/15 bg-[#081426]">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[0.7rem] text-white/55">
          <div className="font-archivo font-bold uppercase tracking-[0.18em]">
            © {year} BearBoard · Built for COSC 458
          </div>
          <div
            className="font-editorial italic"
            style={{ fontFamily: 'Fraunces, Georgia, serif' }}
          >
            Typeset in Archivo Black, Libre Franklin, &amp; Fraunces. Printed with care in Baltimore.
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
