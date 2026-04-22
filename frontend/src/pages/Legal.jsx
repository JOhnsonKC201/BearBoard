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

  anonymity: {
    title: 'Anonymity guide',
    kicker: 'When to go anonymous, what stays private, what does not',
    intro:
      'BearBoard supports anonymous posts for topics where attaching your name could cost you - mental health, reporting harm, Title IX, housing conflicts, family trouble, financial strain. This page explains exactly what "Anonymous" means here, when to use it, and the short list of cases where your identity can still be recovered.',
    sections: [
      {
        heading: 'What the Anonymous flair does',
        body:
          'When you post under the Anonymous flair, the author byline in the feed, post detail, and notifications all read "Anonymous" instead of your name. Your avatar is replaced with a neutral dark avatar so readers cannot correlate posts by color. Other students, including your friends, cannot see who wrote an anonymous post.',
      },
      {
        heading: 'What it does NOT do',
        body:
          'Anonymous is not a secure mode. It hides your name from other students, not from the platform. Moderators and admins can see the author of an anonymous post when they are investigating a specific rules violation or a credible safety concern. No routine browsing of anonymous content - just case-by-case review when a report comes in.',
      },
      {
        heading: 'When to use it',
        body:
          'Good fits: personal mental-health check-ins, Title IX questions, reporting that something felt wrong, asking for help when you do not want your dorm knowing, airing a grievance that needs to be discussed without naming someone first, asking about scholarships after a financial setback. If the post feels like it belongs in a private journal or a counselor\'s office, Anonymous is the right call.',
      },
      {
        heading: 'When NOT to use it',
        body:
          'Do not hide behind Anonymous to insult a specific person, spread rumors, or post content that would get you in trouble under your name. Anonymity protects a vulnerability, not a grudge. Posts that violate the rules (see /rules) are still removed, and the author is still accountable under the moderator case-review process.',
      },
      {
        heading: 'What we log for anonymous posts',
        body:
          'The same metadata as any other post: timestamp, flair, the content itself. We do NOT log your IP address, device fingerprint, or any identifier tied to the HTTP request. The only link back to you is the author_id column in the posts table, which the API never returns for anonymous posts.',
      },
      {
        heading: 'If you are in crisis right now',
        body:
          'BearBoard is not a crisis service. If you need to talk to someone now, the Morgan State University Counseling Center is at (443) 885-3130 during business hours, and the 988 Suicide & Crisis Lifeline is 24/7 (call or text 988). The Trevor Project (LGBTQ youth) is 1-866-488-7386. RAINN (sexual assault) is 1-800-656-4673. These are free.',
      },
      {
        heading: 'Our promise',
        body:
          'We will keep the anonymity guarantees on this page as strict as we reasonably can. If we ever have to change the policy - for a legal subpoena, or because a feature needs to surface more data - we will publish the change on this page before the code change lands, not after.',
      },
    ],
  },
}

function Legal({ slug = 'rules' }) {
  const doc = DOCS[slug] || DOCS.rules
  return (
    <div className="min-h-screen bg-offwhite">
      {/* Navy hero — matches /resources, /crosslinks, /welcome so every
           content page in this family shares a visual lead-in. */}
      <div className="bg-navy relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(135deg, #D4962A 0 1px, transparent 1px 14px)' }}
        />
        <div className="max-w-[960px] mx-auto px-5 sm:px-8 py-10 relative">
          <nav aria-label="Breadcrumb" className="text-[0.66rem] font-archivo font-extrabold text-gold/75 uppercase tracking-[0.22em] mb-4">
            <Link to="/" className="hover:text-gold no-underline text-gold/75 focus-visible:outline-none focus-visible:text-gold focus-visible:underline underline-offset-4">Home</Link>
            <span className="mx-2 text-white/30" aria-hidden>/</span>
            <span className="text-white/60">Policies</span>
            <span className="mx-2 text-white/30" aria-hidden>/</span>
            <span className="text-white">{doc.title}</span>
          </nav>
          <div className="font-archivo font-extrabold text-[0.62rem] uppercase tracking-[0.26em] text-gold mb-2">
            BearBoard policies
          </div>
          <h1 className="font-archivo font-black text-white text-[2.1rem] sm:text-[2.6rem] leading-[1.02] tracking-tight uppercase">
            {doc.title}
          </h1>
          <p className="text-white/70 text-[0.94rem] mt-3 leading-relaxed max-w-[60ch]">
            {doc.kicker}
          </p>
        </div>
      </div>
      <hr className="h-[3px] bg-gold border-none m-0" />

      <div className="max-w-[760px] mx-auto px-5 sm:px-6 py-8">

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
