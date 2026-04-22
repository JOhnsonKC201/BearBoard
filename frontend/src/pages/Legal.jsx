import { Link } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Legal / policy documents - Rules, Privacy, Terms, Accessibility.
//
// All four live in one component because they share the exact same layout
// (masthead + sections + Morgan State colophon), and only the content data
// differs. Each route passes a slug prop; the doc is pulled from DOCS.
//
// Content here is BearBoard-specific - written for a student project at
// Morgan State - not a Reddit copy. Update in-place when you need to
// reword something; keep sections short and skim-friendly.
// ---------------------------------------------------------------------------

const LAST_UPDATED = 'April 20, 2026'

const DOCS = {
  rules: {
    title: 'Community rules',
    kicker: 'What we expect from every Bear on the board',
    intro:
      'BearBoard is built for Morgan State students, by Morgan State students. The rules below are the minimum bar for keeping the feed useful and the community respectful. Moderators can remove posts or suspend accounts that break them.',
    sections: [
      {
        heading: '1. Be civil',
        body:
          'Classmates first. Disagree with ideas, never attack the person. Be civil in every exchange - posts, comments, DMs, and anything anonymous. Sarcasm is fine; cruelty is not.',
      },
      {
        heading: '2. No doxxing',
        body:
          'Do not post another person’s full name, phone number, address, schedule, Instagram handle, license plate, or photos without their consent. Do not share screenshots of private DMs. This applies to students, professors, and staff alike. Even hints ("y’all know who I mean") count if a reader can figure it out.',
      },
      {
        heading: '3. No harassment',
        body:
          'No targeted campaigns, pile-ons, slurs, threats, or sexual harassment. No racism, misogyny, homophobia, transphobia, antisemitism, Islamophobia, or ableism. First offense = post removed + warning. Second offense = suspension. Hate speech and doxxing skip straight to a permanent ban.',
      },
      {
        heading: '4. No selling answers or cheating',
        body:
          'BearBoard is not a cheating marketplace. No selling, trading, or soliciting exam questions, test banks, completed homework, essays, lab reports, or AI-written assignments submitted as your own. No "who has the Physics 203 midterm from last year?" posts. Study groups, honest tutoring, and discussing concepts after a test is graded are all fine - crossing into academic dishonesty is not. Violations are forwarded to the Office of Academic Integrity.',
      },
      {
        heading: '5. Keep it Morgan',
        body:
          'Posts should be relevant to the Morgan State community - campus events, academics, housing, swaps, jobs, or student life. General-web spam, off-campus resale, and crypto shilling get removed.',
      },
      {
        heading: '6. Use flairs honestly',
        body:
          'Pick the flair that matches your post. Anonymous is for sensitive topics (mental health, Title IX, roommate issues) - not for avoiding accountability for low-effort posts. SOS is for real help requests.',
      },
      {
        heading: '7. No explicit content',
        body:
          'BearBoard is a student platform, not a social network for NSFW material. Nudity, sexual content, or graphic violence will be removed and the account flagged for review.',
      },
      {
        heading: '8. Protect privacy',
        body:
          'Do not post other people\u2019s full names, phone numbers, addresses, or photos without consent. Do not screenshot private DMs. This includes professors, staff, and fellow students.',
      },
      {
        heading: '9. Report, don\u2019t retaliate',
        body:
          'If a post breaks the rules, use the report button or contact a moderator. Responding with another rule-breaking post gets both accounts sanctioned.',
      },
    ],
  },

  privacy: {
    title: 'Privacy policy',
    kicker: 'What we collect, how we use it, and what we never sell',
    intro:
      'BearBoard is a student project run by the COSC 458 Software Engineering team at Morgan State University. We try to collect the minimum data needed to make the app work. This policy explains what that means in plain language.',
    sections: [
      {
        heading: 'What we collect',
        body:
          'Your .edu email, a hashed password, your name, and the optional profile fields you fill in (major, graduation year). We also record posts, comments, votes, group memberships, and notifications you generate while using the app.',
      },
      {
        heading: 'Why we collect it',
        body:
          'To let you sign in, to show your posts under your name, to route notifications, and to make features like the trending feed and resurface alerts work. That\u2019s it.',
      },
      {
        heading: 'Who we share it with',
        body:
          'Nobody outside the team. We don\u2019t sell or rent your data. We don\u2019t run ad networks. The only third-party services we use are our hosting provider (Render), our database host (Supabase), and Google Fonts for typography.',
      },
      {
        heading: 'Anonymous posts',
        body:
          'Posts in the Anonymous category display \u201CAnonymous\u201D as the author to other students. Moderators and admins can see the real author when investigating a rules violation. That\u2019s the only exception.',
      },
      {
        heading: 'Cookies and storage',
        body:
          'We store your JWT auth token in browser localStorage and a small set of preferences (saved posts, dismissed banners) in the same place. No third-party tracking cookies.',
      },
      {
        heading: 'Deleting your account',
        body:
          'Email the team (see the Team section on the home page) to request deletion. We\u2019ll remove your user record, posts, comments, and votes within 7 days. Public posts that others have replied to may be anonymized instead of hard-deleted to preserve the conversation for other students.',
      },
    ],
  },

  terms: {
    title: 'Terms of use',
    kicker: 'The agreement between you and BearBoard when you sign in',
    intro:
      'By creating an account on BearBoard you agree to these terms. They\u2019re short and readable on purpose. If anything here is unclear, ask the team - we\u2019ll rewrite it.',
    sections: [
      {
        heading: 'Who can sign up',
        body:
          'You need a current Morgan State .edu email to register. Attempts to bypass the .edu check or use another person\u2019s account will be terminated.',
      },
      {
        heading: 'Your content',
        body:
          'You own what you post. By posting you give BearBoard a license to display, copy, and distribute that content on the platform so other students can see it. You can delete your own posts at any time.',
      },
      {
        heading: 'What\u2019s not allowed',
        body:
          'See the Community Rules. Breaking them can get your account suspended or banned. Repeated violations lead to permanent bans.',
      },
      {
        heading: 'Service availability',
        body:
          'This is a student-run project, not a commercial service. We don\u2019t guarantee uptime, data retention, or specific features from one sprint to the next. Back up anything important.',
      },
      {
        heading: 'No warranty, no liability',
        body:
          'BearBoard is provided \u201Cas is.\u201D The team is not responsible for decisions you make based on content you read here, interactions with other users, or data loss.',
      },
      {
        heading: 'Changes',
        body:
          `We may update these terms. When we do, we\u2019ll update the \u201CLast updated\u201D date at the bottom of this page. Continuing to use BearBoard after a change means you accept the new terms.`,
      },
    ],
  },

  accessibility: {
    title: 'Accessibility statement',
    kicker: 'How we try to make BearBoard usable for everyone',
    intro:
      'BearBoard aims to meet WCAG 2.1 Level AA where we reasonably can. As a student-run project we\u2019re not a perfect reference implementation, but the items below describe what we\u2019ve committed to and what we know is still a gap.',
    sections: [
      {
        heading: 'What works today',
        body:
          'Semantic HTML structure. Every interactive button or link has a visible focus ring when you tab to it. Forms have labels and error messages announce via role=alert. Category and state colors meet AA contrast on both the light and dark surfaces we use. Motion is reduced when the OS setting prefers-reduced-motion is on.',
      },
      {
        heading: 'Touch targets',
        body:
          'Every primary action on mobile clears the 44px minimum. Bottom navigation tabs are 56px. The login form inputs are 48px. Dense utility chips on desktop may be smaller; they have keyboard alternatives.',
      },
      {
        heading: 'Known gaps',
        body:
          'The campus map currently uses Leaflet, whose popups are not reliably keyboard-operable. Some icon-only buttons in the chat widget could use clearer aria-labels. We\u2019re tracking these and aim to address them in the next sprint.',
      },
      {
        heading: 'How to report a problem',
        body:
          'If anything blocks you from using BearBoard with a keyboard, screen reader, or reduced-motion setting, contact the team (see Team on the home page). Label the message \u201CAccessibility\u201D in the subject line and we\u2019ll prioritize a fix.',
      },
    ],
  },
}

function Legal({ slug = 'rules' }) {
  const doc = DOCS[slug] || DOCS.rules
  return (
    <div className="min-h-screen bg-offwhite">
      <div className="max-w-[760px] mx-auto px-5 sm:px-6 py-6">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="text-[0.72rem] font-archivo font-bold text-gray uppercase tracking-[0.12em] mb-4">
          <Link to="/" className="hover:text-navy no-underline text-gray">Home</Link>
          <span className="mx-2 text-ink/30" aria-hidden>/</span>
          <span className="text-ink/60">Policies</span>
          <span className="mx-2 text-ink/30" aria-hidden>/</span>
          <span className="text-ink">{doc.title}</span>
        </nav>

        {/* Masthead */}
        <header className="border-t-[3px] border-gold pt-5 mb-6">
          <span className="font-archivo font-extrabold text-[0.66rem] uppercase tracking-[0.2em] text-gold">
            BearBoard policies
          </span>
          <h1 className="font-archivo font-black text-[2rem] sm:text-[2.3rem] leading-[1.05] tracking-tight text-ink mt-2 uppercase">
            {doc.title}
          </h1>
          <p className="text-gray text-[0.92rem] mt-2 leading-relaxed max-w-[60ch]">
            {doc.kicker}
          </p>
        </header>

        {/* Policies sub-nav */}
        <nav aria-label="Policies" className="mb-7 flex flex-wrap gap-1.5 border-y border-divider py-3">
          {Object.entries(DOCS).map(([key, d]) => {
            const active = key === slug
            return (
              <Link
                key={key}
                to={`/${key}`}
                className={`font-archivo font-extrabold text-[0.68rem] uppercase tracking-[0.12em] px-3 py-2 no-underline min-h-[40px] flex items-center transition-colors ${
                  active
                    ? 'bg-navy text-gold'
                    : 'text-gray hover:text-navy'
                }`}
              >
                {d.title.replace(/ (policy|statement|of use)$/i, '')}
              </Link>
            )
          })}
        </nav>

        {/* Intro */}
        {doc.intro && (
          <p className="text-ink text-[0.98rem] font-franklin leading-relaxed max-w-[62ch] mb-6">
            {doc.intro}
          </p>
        )}

        {/* Sections */}
        <div className="space-y-5">
          {doc.sections.map((s) => (
            <section key={s.heading} className="bg-card border border-lightgray px-5 py-4">
              <h2 className="font-archivo font-extrabold text-[0.98rem] tracking-tight text-navy mb-1.5">
                {s.heading}
              </h2>
              <p className="text-[0.92rem] text-ink/85 font-franklin leading-relaxed">
                {s.body}
              </p>
            </section>
          ))}
        </div>

        {/* Colophon */}
        <footer className="mt-10 pt-4 border-t-[3px] border-gold flex items-center justify-between text-[0.66rem] font-archivo font-bold uppercase tracking-[0.14em] text-gray">
          <span>Last updated &middot; {LAST_UPDATED}</span>
          <span>
            BEAR<span className="text-gold">BOARD</span> &middot; Morgan State
          </span>
        </footer>
      </div>
    </div>
  )
}

export default Legal
