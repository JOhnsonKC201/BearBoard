import { Link } from 'react-router-dom'

/**
 * Resources — curated directory of Morgan State services students need
 * during a normal semester. Intentionally static + human-curated (no
 * API) so the list stays trustworthy. Links open in a new tab because
 * every destination is on a different Morgan subdomain.
 *
 * If Morgan renames a page, the broken-link report shows up on the
 * user's end — easier to notice than a silent 404 page embedded
 * inside our layout.
 */

const SECTIONS = [
  {
    heading: 'Academics',
    kicker: 'Plan the semester, pass the semester',
    items: [
      {
        title: 'Academic calendar',
        body: 'Start dates, drop deadlines, reading days, finals week, commencement.',
        href: 'https://www.morgan.edu/academic-calendar',
      },
      {
        title: 'Registrar',
        body: 'Registration holds, transcripts, enrollment verification, name changes.',
        href: 'https://www.morgan.edu/registrar',
      },
      {
        title: 'Earl S. Richardson Library',
        body: 'Reserve a room, borrow a laptop, log into databases, cite properly.',
        href: 'https://www.morgan.edu/library',
      },
      {
        title: 'Tutoring — CASA',
        body: 'Free peer and professional tutoring through the Center for Academic Success.',
        href: 'https://www.morgan.edu/casa',
      },
      {
        title: 'Writing Center',
        body: 'Thesis help, citation coaching, drop-in and by-appointment sessions.',
        href: 'https://www.morgan.edu/writing-center',
      },
    ],
  },
  {
    heading: 'Wellness',
    kicker: 'You matter more than the syllabus',
    items: [
      {
        title: 'University Counseling Center',
        body: 'Free confidential counseling for enrolled students. Walk-ins accepted during crisis hours.',
        href: 'https://www.morgan.edu/counseling-center',
      },
      {
        title: 'Student Health Center',
        body: 'Primary care, immunizations, prescriptions. Most visits covered by student fees.',
        href: 'https://www.morgan.edu/student-health-center',
      },
      {
        title: 'Title IX / Office of Institutional Equity',
        body: 'Report sexual misconduct, discrimination, or retaliation. Confidential support.',
        href: 'https://www.morgan.edu/oie',
      },
    ],
  },
  {
    heading: 'Money',
    kicker: 'Financial aid, billing, bursar',
    items: [
      {
        title: 'Financial aid',
        body: 'FAFSA help, scholarships, work-study, appeal forms.',
        href: 'https://www.morgan.edu/financial-aid',
      },
      {
        title: 'Bursar / student accounts',
        body: 'Pay your bill, payment plans, refunds.',
        href: 'https://www.morgan.edu/bursar',
      },
      {
        title: 'Career Center',
        body: 'Handshake login, resume reviews, recruiting events.',
        href: 'https://www.morgan.edu/career',
      },
    ],
  },
  {
    heading: 'Campus life',
    kicker: 'Housing, dining, safety',
    items: [
      {
        title: 'Residence Life & Housing',
        body: 'Dorm assignments, room changes, Resident Assistant contacts.',
        href: 'https://www.morgan.edu/residence-life',
      },
      {
        title: 'Dining',
        body: 'Meal plans, dining hall hours, retail locations on campus.',
        href: 'https://morgan.campusdish.com',
      },
      {
        title: 'Morgan State Police',
        body: 'Non-emergency dispatch, safety escorts, report a concern. Emergency: call 911 or 443-885-3133.',
        href: 'https://www.morgan.edu/police',
      },
      {
        title: 'IT Help Desk',
        body: 'Reset your password, WiFi issues, Canvas problems.',
        href: 'https://www.morgan.edu/information-technology',
      },
    ],
  },
]


function ResourceCard({ item }) {
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-card border border-lightgray border-l-[3px] border-l-lightgray hover:border-l-gold hover:-translate-y-[1px] hover:shadow-[0_4px_18px_-8px_rgba(11,29,52,0.18)] transition-all no-underline text-ink p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="font-archivo font-extrabold text-[0.92rem] text-navy mb-1">
            {item.title}
          </div>
          <div className="text-[0.8rem] text-gray leading-relaxed">{item.body}</div>
        </div>
        <span className="text-gold mt-0.5" aria-hidden>↗</span>
      </div>
      <div className="text-[0.64rem] text-gray/70 mt-2 font-archivo uppercase tracking-[0.14em] truncate">
        {new URL(item.href).hostname.replace(/^www\./, '')}
      </div>
    </a>
  )
}


function Resources() {
  return (
    <div className="min-h-screen bg-offwhite pb-16">
      {/* Hero */}
      <div className="bg-navy relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(135deg, #D4962A 0 1px, transparent 1px 14px)' }}
        />
        <div className="max-w-[960px] mx-auto px-6 py-10 relative">
          <div className="font-archivo font-extrabold text-[0.62rem] uppercase tracking-[0.26em] text-gold mb-2">
            Campus services
          </div>
          <h1 className="font-archivo font-black text-white text-[2.2rem] sm:text-[2.6rem] leading-[1.02] tracking-tight uppercase">
            Morgan resources,{' '}
            <span className="text-gold">one tap away</span>
          </h1>
          <p className="text-white/65 text-[0.92rem] leading-relaxed mt-3 max-w-[600px]">
            Every service you pay for with tuition, collected in one place.
            Every link opens on morgan.edu — we don't collect your clicks.
          </p>
        </div>
      </div>
      <hr className="h-[3px] bg-gold border-none m-0" />

      <div className="max-w-[960px] mx-auto px-6 py-8">
        {SECTIONS.map((sec) => (
          <section key={sec.heading} className="mb-10 last:mb-0">
            <header className="flex items-end justify-between gap-4 mb-4 pb-2 border-b border-navy/80">
              <div>
                <div className="font-archivo font-black text-[0.7rem] uppercase tracking-[0.22em] text-navy">
                  {sec.heading}
                </div>
                <div className="text-[0.86rem] text-gray font-franklin italic mt-0.5">
                  {sec.kicker}
                </div>
              </div>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {sec.items.map((it) => (
                <ResourceCard key={it.title} item={it} />
              ))}
            </div>
          </section>
        ))}

        <div className="mt-12 bg-card border border-lightgray px-5 py-5">
          <div className="font-archivo font-extrabold text-[0.66rem] uppercase tracking-[0.22em] text-navy mb-2">
            Missing something?
          </div>
          <div className="text-[0.88rem] text-ink/80 leading-relaxed">
            If a service you rely on isn't here, file an idea on the{' '}
            <Link to="/" className="text-navy underline underline-offset-2 hover:text-gold">
              feed
            </Link>
            {' '}or message a moderator. This list is curated by students, not auto-scraped,
            so updates are manual on purpose — we'd rather miss a link than send
            someone to a broken page during a rough week.
          </div>
        </div>
      </div>
    </div>
  )
}

export default Resources
