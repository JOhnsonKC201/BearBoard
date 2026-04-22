import { useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * Welcome — first-run landing and onboarding FAQ.
 *
 * Shown automatically right after registration (see Register.jsx's
 * navigate target) and linked from the left rail so people can come back.
 * Everything here is static; no data fetching.
 *
 * Structure: a short personal welcome, a "first 5 things to do" action
 * checklist, then a searchable/expandable FAQ. The FAQ's accordion state
 * is local — tab click reveals, click again hides. No router dependency
 * beyond <Link> for internal pages.
 */

const FAQ = [
  {
    q: 'What is BearBoard?',
    a: 'A student community board built by Morgan State students for Morgan State students. Post questions, share events, swap stuff, find study partners, ask for help when you need it. Think of it as a structured, campus-only Reddit — without strangers.',
  },
  {
    q: 'Who can join?',
    a: 'Anyone with a current Morgan State .edu email. Signup checks the domain, so drive-by guests and bots stay out. Alumni whose .edu is still active can also get in.',
  },
  {
    q: 'How do I make my first post?',
    a: 'Click "+ New post" on the feed (big gold button bottom-right on mobile, or the banner on desktop). Pick a flair, write a title, add a body. If it\'s an event, housing listing, or swap, extra fields appear to help people actually act on it.',
  },
  {
    q: 'What are flairs?',
    a: 'Flairs are the category tags on every post (General, Academic, Events, Housing, Swap, Safety, Anonymous, Memes, Advice, Lost & Found, Admissions). They make it easier for readers to filter and for moderators to route posts correctly. Pick the most specific one.',
  },
  {
    q: 'What is the Anonymous flair?',
    a: 'A post without your name on it. Useful for sensitive topics like mental health, Title IX, housing conflicts, or money worries. Moderators can still see the author when investigating rules violations — the full guarantees live at /anonymity.',
  },
  {
    q: 'What is SOS?',
    a: 'An emergency-style post that broadcasts to other students in your major. Use it ONLY for real help requests — late-night locked out, bad reaction to something, need a ride during a crisis. We throttle SOS to one per student per 6 hours to keep it meaningful.',
  },
  {
    q: 'How do I edit or delete my post?',
    a: 'Delete support is being rolled out per-post — if you see a delete action on your own card, use it. For now, the simplest path is to ask a moderator. Edit-post is on the near-term roadmap.',
  },
  {
    q: 'How do upvotes work?',
    a: 'Each student can vote once per post. Upvotes push a post up in Popular and Trending sorts; downvotes do the opposite. You can change your vote or remove it by clicking the arrow again. We rate-limit voting to prevent gaming the rankings.',
  },
  {
    q: 'How do groups work?',
    a: 'Groups are per-course study rooms (e.g. COSC 350 — Software Engineering). Search by course code in the sidebar, join the ones you\'re in, leave when the semester ends. Creating a group is one form and one click.',
  },
  {
    q: 'What are the pinned megathreads?',
    a: 'Four always-on discussion homes at the top of the feed: Admissions Q&A, Course Reviews, Roommate Search, Dorm Tours. Post in the right megathread and your reply is discoverable months later; post one-off and it rolls off the feed in a day.',
  },
  {
    q: 'What about the weekly threads?',
    a: 'Three recurring threads drop on a cadence: Freshman Friday (Fri), Class Registration Help (Mon), Food on Campus (Wed). They post themselves each week with the date in the title so you know which one\'s current.',
  },
  {
    q: 'How do I report a post or comment?',
    a: 'Click the kebab / three-dot menu on any content to report (UI rolling out per-type). In the meantime, ping a moderator — Kyndal, Olu, or the admin — or DM in the feed with a link to the post.',
  },
  {
    q: 'Who moderates BearBoard?',
    a: 'Moderators are students on the COSC 458 project team — Kyndal Maclin (Product Owner) and Oluwajomiloju King (Scrum Master) are moderators. Aayush, Sameer, and Rohan are developers with some mod tooling. Johnson is the admin.',
  },
  {
    q: 'Can I change my name, major, or bio?',
    a: 'Yes. Go to your profile and click "Edit profile". Name, major, graduation year, and bio all editable. The profile page also supports uploading a banner and avatar directly.',
  },
  {
    q: 'Where does my data live?',
    a: 'Postgres on Supabase for user accounts, posts, comments, votes. Render for the API process. No ad networks, no tracking pixels. Full policy at /privacy.',
  },
  {
    q: 'Is there a mobile app?',
    a: 'Not yet. The web app is built mobile-first — add it to your phone\'s home screen from Safari / Chrome for a near-native experience.',
  },
  {
    q: 'I found a bug. What do I do?',
    a: 'Post in General with "[BUG]" in the title, or DM the admin. We triage bug reports at the top of each sprint.',
  },
  {
    q: 'Can I invite friends from other schools?',
    a: 'Not right now — BearBoard is Morgan-only on purpose. If your school wants its own board, reach out; the code is written so a partner deployment is straightforward.',
  },
]


function FirstStep({ num, to, title, body }) {
  return (
    <Link
      to={to}
      className="block bg-card border border-lightgray border-l-[3px] border-l-lightgray hover:border-l-gold hover:-translate-y-[1px] transition-all no-underline text-ink p-4"
    >
      <div className="flex items-start gap-3">
        <div className="font-archivo font-black text-[1.6rem] text-gold leading-none shrink-0">
          {num.toString().padStart(2, '0')}
        </div>
        <div>
          <div className="font-archivo font-extrabold text-[0.92rem] text-navy mb-0.5">
            {title}
          </div>
          <div className="text-[0.82rem] text-gray leading-relaxed">{body}</div>
        </div>
      </div>
    </Link>
  )
}


function FaqItem({ item, isOpen, onToggle }) {
  return (
    <li className="border-b border-[#EAE7E0] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-4 text-left bg-transparent border-none cursor-pointer py-3.5 px-1 font-archivo font-bold text-ink text-[0.95rem] leading-snug hover:text-navy"
        aria-expanded={isOpen}
      >
        <span>{item.q}</span>
        <span className="text-gold shrink-0 font-archivo font-extrabold text-[1.1rem]" aria-hidden>
          {isOpen ? '−' : '+'}
        </span>
      </button>
      {isOpen && (
        <div className="pb-4 pr-6 text-[0.88rem] text-ink/85 leading-relaxed font-franklin">
          {item.a}
        </div>
      )}
    </li>
  )
}


function Welcome() {
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <div className="min-h-screen bg-offwhite pb-16">
      {/* Hero — salutation + quick orientation */}
      <div className="bg-navy relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(135deg, #D4962A 0 1px, transparent 1px 14px)' }}
        />
        <div className="max-w-[960px] mx-auto px-6 py-12 relative">
          <div className="font-archivo font-extrabold text-[0.62rem] uppercase tracking-[0.28em] text-gold mb-3">
            Welcome to BearBoard
          </div>
          <h1 className="font-archivo font-black text-white text-[2.4rem] sm:text-[3rem] leading-[1.02] tracking-tight uppercase">
            Glad you&rsquo;re here,{' '}
            <span className="text-gold">Bear.</span>
          </h1>
          <p className="text-white/70 text-[0.98rem] leading-relaxed mt-4 max-w-[640px]">
            BearBoard is a student community board built by Morgan State students for Morgan State
            students. This page covers the basics — the answers to &ldquo;wait, how does this work?&rdquo; before
            you have to ask. Bookmark it; we keep it current.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              to="/"
              className="bg-gold text-navy font-archivo font-extrabold text-[0.74rem] uppercase tracking-[0.16em] px-5 py-2.5 no-underline hover:bg-[#E5A92E] transition-colors"
            >
              Take me to the feed
            </Link>
            <Link
              to="/rules"
              className="bg-transparent border border-gold/60 text-gold font-archivo font-extrabold text-[0.74rem] uppercase tracking-[0.16em] px-5 py-2.5 no-underline hover:bg-gold/10 transition-colors"
            >
              Read the rules
            </Link>
          </div>
        </div>
      </div>
      <hr className="h-[3px] bg-gold border-none m-0" />

      {/* First steps */}
      <section className="max-w-[960px] mx-auto px-6 pt-10">
        <header className="mb-4 pb-2 border-b border-navy/80">
          <div className="font-archivo font-black text-[0.7rem] uppercase tracking-[0.22em] text-navy">
            First five things to do
          </div>
          <div className="text-[0.86rem] text-gray font-franklin italic mt-0.5">
            Ten minutes, tops
          </div>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FirstStep
            num={1}
            to="/profile/me"
            title="Fill in your profile"
            body="Add your major, grad year, and a short bio so other students know who they&rsquo;re talking to. Upload a banner + avatar if you want to — it takes 20 seconds."
          />
          <FirstStep
            num={2}
            to="/rules"
            title="Skim the rules"
            body="Nine short rules. Civility, no doxxing, no cheating, and how to use flairs honestly. Takes 3 minutes."
          />
          <FirstStep
            num={3}
            to="/"
            title="Say hi on the feed"
            body="Pick the Advice or General flair, introduce yourself, ask a question you actually want answered. Posts with a specific ask get more replies."
          />
          <FirstStep
            num={4}
            to="/resources"
            title="Bookmark the resources page"
            body="Every Morgan service — library, registrar, counseling, CASA tutoring, financial aid — one tap away."
          />
          <FirstStep
            num={5}
            to="/professors"
            title="Check (or leave) a professor review"
            body="81 Morgan faculty already in the directory. Rate after a class ends so next semester's students know what to expect."
          />
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-[960px] mx-auto px-6 pt-12">
        <header className="mb-4 pb-2 border-b border-navy/80">
          <div className="font-archivo font-black text-[0.7rem] uppercase tracking-[0.22em] text-navy">
            FAQ
          </div>
          <div className="text-[0.86rem] text-gray font-franklin italic mt-0.5">
            Click any question to expand the answer
          </div>
        </header>
        <ul className="bg-card border border-lightgray px-4">
          {FAQ.map((item, i) => (
            <FaqItem
              key={item.q}
              item={item}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
            />
          ))}
        </ul>
      </section>

      {/* Closing nudge */}
      <section className="max-w-[960px] mx-auto px-6 pt-10">
        <div className="bg-navy text-white p-6 sm:p-7 border-l-[3px] border-l-gold">
          <div className="font-archivo font-extrabold text-[0.62rem] uppercase tracking-[0.22em] text-gold mb-2">
            Still have questions?
          </div>
          <p className="text-white/80 leading-relaxed text-[0.92rem]">
            Post in the feed with the <strong>Advice</strong> flair or ping a moderator. Every answer you
            get here is from another Bear — the whole point is that we&rsquo;re all figuring it out together.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/"
              className="bg-gold text-navy font-archivo font-extrabold text-[0.74rem] uppercase tracking-[0.16em] px-5 py-2.5 no-underline hover:bg-[#E5A92E] transition-colors"
            >
              Go to the feed
            </Link>
            <Link
              to="/crosslinks"
              className="bg-transparent border border-gold/50 text-gold font-archivo font-extrabold text-[0.74rem] uppercase tracking-[0.16em] px-5 py-2.5 no-underline hover:bg-gold/10 transition-colors"
            >
              Related communities
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Welcome
