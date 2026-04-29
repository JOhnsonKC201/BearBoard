// Public-facing "About the team" page. The data is hard-coded because
// it's the COSC 458 Spring 2026 capstone team — won't change without a
// new branch. Kept in sync with the same TEAM_DATA on the home page.

const TEAM = [
  { name: 'Kyndal Maclin',       role: 'Product Owner',         initials: 'KM', color: '#5B3A8C', tc: '#fff' },
  { name: 'Oluwajomiloju King',  role: 'Scrum Master',          initials: 'OK', color: '#0B1D34', tc: '#fff' },
  { name: 'Aayush Shrestha',     role: 'API · AI Agent · Backend', initials: 'AS', color: '#1A8A7D', tc: '#fff' },
  { name: 'Rohan Sainju',        role: 'UI / UX',               initials: 'RS', color: '#2E7D32', tc: '#fff' },
  { name: 'Sameer Shiwakoti',    role: 'Frontend',              initials: 'SS', color: '#C0392B', tc: '#fff' },
  { name: 'Johnson KC',          role: 'Full Stack',            initials: 'JK', color: '#D4962A', tc: '#0B1D34' },
]

export default function Team() {
  return (
    <div className="min-h-[60vh] max-w-[1100px] mx-auto px-4 sm:px-6 py-6 space-y-8">
      <header>
        <h1 className="font-editorial font-black text-[2rem] sm:text-[2.6rem] leading-none tracking-tight m-0">
          The Team
        </h1>
        <p className="text-mini text-gray font-archivo uppercase tracking-wider mt-2">
          COSC 458 · Software Engineering · Spring 2026 · Morgan State University
        </p>
      </header>

      <section className="bg-card border border-lightgray border-l-[3px] border-l-gold p-5 sm:p-6">
        <h2 className="font-archivo font-extrabold text-[0.82rem] uppercase tracking-wider mb-3">About BearBoard</h2>
        <p className="font-prose text-[1rem] text-ink/85 leading-[1.65] m-0 mb-2">
          BearBoard is a campus social platform built by Morgan State students,
          for Morgan State students. The product covers feed posts, course-based
          study groups, campus events, professor reviews, and an anonymous SOS
          channel for moments when a Bear needs help fast.
        </p>
        <p className="font-prose text-[1rem] text-ink/85 leading-[1.65] m-0">
          What you're using right now is the work of six computer-science majors
          shipping in two-week sprints across the spring semester. Bug reports
          and feature ideas are welcome on the feed.
        </p>
      </section>

      <section>
        <h2 className="font-archivo font-extrabold text-[0.82rem] uppercase tracking-wider mb-3">Builders</h2>
        <ul className="list-none p-0 m-0 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TEAM.map((m) => (
            <li key={m.name} className="bg-card border border-lightgray p-4 text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center font-archivo font-extrabold text-[0.95rem] mx-auto mb-2.5"
                style={{ background: m.color, color: m.tc }}
              >
                {m.initials}
              </div>
              <div className="font-archivo font-bold text-[0.92rem]">{m.name}</div>
              <div className="text-[0.72rem] text-gray font-archivo mt-0.5">{m.role}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-offwhite border border-lightgray p-5">
        <h2 className="font-archivo font-extrabold text-[0.82rem] uppercase tracking-wider mb-2">Project tracking</h2>
        <p className="text-[0.92rem] font-prose text-ink/85 leading-relaxed m-0">
          Sprints, stories, and the audit punch list live on Trello.{' '}
          <a
            href="https://trello.com/b/ZVVEpSeC/my-trello-board"
            target="_blank"
            rel="noopener noreferrer"
            className="text-navy underline underline-offset-2 hover:text-gold"
          >
            View the board →
          </a>
        </p>
      </section>
    </div>
  )
}
