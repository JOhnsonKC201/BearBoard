import { Link } from 'react-router-dom'

/**
 * Crosslinks — related communities outside BearBoard.
 *
 * Curated, static. We do not try to proxy other subreddits / Discords /
 * Instagrams. Links open in a new tab so students know they're leaving.
 * If a community goes dark, remove it from the list rather than hiding
 * the 404 — that's the whole point of a hand-maintained directory.
 */

const SECTIONS = [
  {
    heading: 'Morgan State — official',
    kicker: 'Follow the school itself',
    items: [
      { title: 'Morgan State University', body: 'Official university homepage.', href: 'https://www.morgan.edu' },
      { title: 'Morgan Athletics', body: 'Schedules, tickets, score updates for Bears athletics.', href: 'https://morganstatebears.com' },
      { title: '@morganstateu — Instagram', body: 'Daily campus moments and announcements.', href: 'https://www.instagram.com/morganstateu/' },
      { title: '@MorganStateU — X / Twitter', body: 'Press, alerts, and quick updates.', href: 'https://twitter.com/MorganStateU' },
      { title: 'Morgan State — LinkedIn', body: 'Alumni network, jobs, faculty posts.', href: 'https://www.linkedin.com/school/morgan-state-university/' },
      { title: 'The Spokesman — student paper', body: 'Longer-form reporting by Morgan students.', href: 'https://msuspokesman.com' },
    ],
  },
  {
    heading: 'Baltimore — the city',
    kicker: 'Life outside the gates',
    items: [
      { title: 'r/baltimore', body: 'Neighborhood news, housing chatter, what opened / what closed.', href: 'https://reddit.com/r/baltimore' },
      { title: 'Baltimore Magazine', body: 'Food, culture, restaurants, and guides.', href: 'https://www.baltimoremagazine.com' },
      { title: 'Charm City Circulator', body: 'Free downtown bus loops — routes, alerts, live tracking.', href: 'https://www.charmcitycirculator.com' },
      { title: 'MTA Maryland', body: 'Bus, MARC, and Light Rail schedules.', href: 'https://www.mta.maryland.gov' },
    ],
  },
  {
    heading: 'Nearby schools',
    kicker: 'Transfers, cross-registration, shared events',
    items: [
      { title: 'UMBC — r/umbc', body: 'University of Maryland, Baltimore County student community.', href: 'https://reddit.com/r/UMBC' },
      { title: 'Towson — r/Towson', body: 'Towson University student community.', href: 'https://reddit.com/r/Towson' },
      { title: 'UMD College Park — r/UMD', body: 'UMD community; biggest regional school sub.', href: 'https://reddit.com/r/UMD' },
      { title: 'Coppin State', body: 'Fellow Baltimore HBCU — Coppin State University.', href: 'https://www.coppin.edu' },
      { title: 'Johns Hopkins — r/jhu', body: 'Hopkins undergrad community — often overlaps on hackathons.', href: 'https://reddit.com/r/jhu' },
      { title: 'Loyola Maryland — r/LoyolaMaryland', body: 'Nearby Jesuit school community.', href: 'https://reddit.com/r/LoyolaMaryland' },
    ],
  },
  {
    heading: 'By major',
    kicker: 'Broader communities for your field',
    items: [
      { title: 'r/cscareerquestions', body: 'Jobs, offers, interview prep for computer science and software.', href: 'https://reddit.com/r/cscareerquestions' },
      { title: 'r/learnprogramming', body: 'Beginner-friendly CS help — resources, debugging, career advice.', href: 'https://reddit.com/r/learnprogramming' },
      { title: 'r/datascience', body: 'Data science / analytics career and technical discussion.', href: 'https://reddit.com/r/datascience' },
      { title: 'r/engineeringstudents', body: 'Study strategies, tool recs, internship threads for all engineering majors.', href: 'https://reddit.com/r/engineeringstudents' },
      { title: 'r/biology', body: 'Bio undergrads and grad students — courses, research, lab life.', href: 'https://reddit.com/r/biology' },
      { title: 'r/businessschool', body: 'B-school applications, MBA prep, finance/marketing chatter.', href: 'https://reddit.com/r/businessschool' },
      { title: 'r/premed', body: 'Pre-med coursework, MCAT, application-year cycle.', href: 'https://reddit.com/r/premed' },
      { title: 'r/education', body: 'Education majors, teaching internships, certification threads.', href: 'https://reddit.com/r/education' },
    ],
  },
  {
    heading: 'Career & scholarships',
    kicker: 'Things worth applying to',
    items: [
      { title: 'Handshake', body: 'Morgan\'s official jobs/internships portal (sign in with SSO).', href: 'https://morgan.joinhandshake.com' },
      { title: 'CodePath', body: 'Free career-prep tracks for HBCU CS students.', href: 'https://www.codepath.org' },
      { title: 'NSBE', body: 'National Society of Black Engineers — Morgan chapter + national resources.', href: 'https://www.nsbe.org' },
      { title: 'Thurgood Marshall College Fund', body: 'Scholarships, fellowships, and career programs for HBCU students.', href: 'https://www.tmcf.org' },
      { title: 'UNCF', body: 'United Negro College Fund scholarships and leadership programs.', href: 'https://uncf.org' },
    ],
  },
]


function CrosslinkCard({ item }) {
  const host = (() => {
    try { return new URL(item.href).hostname.replace(/^www\./, '') }
    catch { return '' }
  })()
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
      {host && (
        <div className="text-[0.64rem] text-gray/70 mt-2 font-archivo uppercase tracking-[0.14em] truncate">
          {host}
        </div>
      )}
    </a>
  )
}


function Crosslinks() {
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
            Related communities
          </div>
          <h1 className="font-archivo font-black text-white text-[2.2rem] sm:text-[2.6rem] leading-[1.02] tracking-tight uppercase">
            Further afield —{' '}
            <span className="text-gold">where Bears also hang out</span>
          </h1>
          <p className="text-white/65 text-[0.92rem] leading-relaxed mt-3 max-w-[640px]">
            Curated links to communities outside BearBoard — the city we live in, our neighbors
            up the road, and the bigger conversations happening by major. All links open on
            other sites in a new tab.
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
                <CrosslinkCard key={it.title} item={it} />
              ))}
            </div>
          </section>
        ))}

        <div className="mt-12 bg-card border border-lightgray px-5 py-5">
          <div className="font-archivo font-extrabold text-[0.66rem] uppercase tracking-[0.22em] text-navy mb-2">
            Know a community we missed?
          </div>
          <div className="text-[0.88rem] text-ink/80 leading-relaxed">
            Every community here was recommended by a student. If your club, major
            subreddit, Discord, or alumni network belongs on this list, drop a note in
            the <Link to="/" className="text-navy underline underline-offset-2 hover:text-gold">feed</Link>{' '}
            or message a moderator. We don’t auto-scrape — curation is intentional.
          </div>
        </div>
      </div>
    </div>
  )
}

export default Crosslinks
