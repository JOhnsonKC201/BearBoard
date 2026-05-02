// Built-with row for the footer colophon. Inline SVG marks (not webfont icons)
// so the strip renders with no extra request and stays crisp at any DPI. Each
// mark is the brand's official monochrome glyph, sized 14px to sit cleanly on
// the colophon's typography baseline. Hover reveals the brand color + role.

const ITEMS = [
  {
    name: 'React',
    role: 'UI',
    href: 'https://react.dev',
    color: '#61DAFB',
    svg: (
      <svg viewBox="-11.5 -10.23 23 20.46" width="14" height="14" aria-hidden>
        <circle r="2.05" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="1" fill="none">
          <ellipse rx="11" ry="4.2" />
          <ellipse rx="11" ry="4.2" transform="rotate(60)" />
          <ellipse rx="11" ry="4.2" transform="rotate(120)" />
        </g>
      </svg>
    ),
  },
  {
    name: 'Vite',
    role: 'Build',
    href: 'https://vitejs.dev',
    color: '#BD34FE',
    svg: (
      <svg viewBox="0 0 256 257" width="14" height="14" aria-hidden>
        <path
          fill="currentColor"
          d="M255 37.6 132.4 256.5c-2.5 4.5-9 4.6-11.7 0L1 37.6c-3-5 1.4-11.1 7.1-10L128.6 49c.8.2 1.7.2 2.5 0L249 27.7c5.7-1.1 10 5 7 10.6Z"
        />
      </svg>
    ),
  },
  {
    name: 'Tailwind',
    role: 'Styling',
    href: 'https://tailwindcss.com',
    color: '#38BDF8',
    svg: (
      <svg viewBox="0 0 54 33" width="16" height="10" aria-hidden>
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M27 0c-7.2 0-11.7 3.6-13.5 10.8 2.7-3.6 5.85-4.95 9.45-4.05 2.054.513 3.522 2.004 5.147 3.653C30.744 13.09 33.808 16.2 40.5 16.2c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.513-3.522-2.004-5.147-3.653C36.756 3.11 33.692 0 27 0ZM13.5 16.2C6.3 16.2 1.8 19.8 0 27c2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C17.244 29.29 20.308 32.4 27 32.4c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.513-3.522-2.004-5.147-3.653C23.256 19.31 20.192 16.2 13.5 16.2Z"
        />
      </svg>
    ),
  },
  {
    name: 'FastAPI',
    role: 'API',
    href: 'https://fastapi.tiangolo.com',
    color: '#009688',
    svg: (
      <svg viewBox="0 0 256 256" width="14" height="14" aria-hidden>
        <path
          fill="currentColor"
          d="M128 0C57.31 0 0 57.31 0 128c0 70.69 57.31 128 128 128 70.69 0 128-57.31 128-128C256 57.31 198.69 0 128 0Zm-7.61 207.05V139.6H64.45L141.7 48.95v67.43h54.27Z"
        />
      </svg>
    ),
  },
  {
    name: 'PostgreSQL',
    role: 'Database',
    href: 'https://www.postgresql.org',
    color: '#5392C5',
    svg: (
      <svg viewBox="0 0 256 264" width="13" height="14" aria-hidden>
        <path
          fill="currentColor"
          d="M255.01 158.4c-1.55-4.7-5.7-7.96-11.04-8.7-2.52-.34-5.4-.2-8.83.45-5.96 1.1-10.39 1.52-13.61 1.6 12.16-20.55 22.06-43.97 27.78-65.93 9.25-35.5 4.34-51.66-1.4-59-15.18-19.4-37.32-29.83-64.04-30.16-14.25-.18-26.76 2.66-33.28 4.95-6.07-1.07-12.6-1.67-19.45-1.78-12.84-.2-24.2 2.6-33.93 8.34-5.39-1.83-14.05-4.5-24.05-6.13-23.51-3.84-42.46-.83-56.31 8.94C-.13 23.74-1.6 65.76 0 88.74c.55 7.65 7.18 95 21.55 121.34 7.66 14.05 18 19.65 28.83 19.65 6.46 0 13.04-1.97 19.27-5.95 8.66 9.66 22.43 14.6 41.14 14.6h.06c12.39 0 25.62-2.91 35.96-8.32 0 .14.07.27.1.41 1.61 4.8 4.45 8.94 8.31 12.04 4.32 3.46 9.6 5.5 15.34 5.91 19.34 1.4 35.65-3.55 51.97-9.43-.16.02-.31.05-.45.07Z"
        />
      </svg>
    ),
  },
  {
    name: 'Render',
    role: 'Hosting',
    href: 'https://render.com',
    color: '#46E3B7',
    svg: (
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
        <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          fill="currentColor"
          d="M12 5.6a3.4 3.4 0 0 0-3.4 3.4v9.4h2.4v-4.4h2.6l2.6 4.4h2.7l-2.83-4.8a3.4 3.4 0 0 0-1.7-6.4H12Zm0 2.4h1.4a1 1 0 1 1 0 2H10.6V9a1 1 0 0 1 1-1H12Z"
        />
      </svg>
    ),
  },
]

export default function TechStack() {
  return (
    <ul
      className="flex flex-wrap items-center gap-x-5 gap-y-2 list-none m-0 p-0"
      aria-label="Built with"
    >
      {ITEMS.map((it) => (
        <li key={it.name}>
          <a
            href={it.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 text-white/55 hover:text-white transition-colors"
            style={{ ['--brand']: it.color }}
            aria-label={`${it.name} — ${it.role}`}
            title={`${it.name} · ${it.role}`}
          >
            <span className="inline-flex items-center justify-center w-[18px] h-[18px] transition-colors group-hover:[color:var(--brand)]">
              {it.svg}
            </span>
            <span className="font-archivo font-bold text-[0.62rem] uppercase tracking-[0.2em] hidden md:inline">
              {it.name}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
