import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { safeHref } from '../utils/safeUrl'
import { parseDateOnly, eventDateParts } from '../utils/format'

// Full Morgan State events page. Pulls from /api/events (which is fed by
// the Morgan iCal sync), groups by month, and surfaces user-created event
// posts inline with their date alongside the synced ones. Synced and
// user-event posts share the same shape because the user-event posts
// schema mirrors EventResponse.
//
// All date rendering goes through parseDateOnly / eventDateParts because
// `event_date` from the API is a pure YYYY-MM-DD string. Using `new Date(iso)`
// on it would parse as UTC midnight and shift back a day in any negative-UTC
// timezone (every US zone), so an event on May 4 would render under May 3.

function formatLongDate(iso) {
  if (!iso) return ''
  const d = parseDateOnly(iso)
  if (!d || Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function monthKey(iso) {
  if (!iso) return ''
  const d = parseDateOnly(iso)
  if (!d || Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export default function Events() {
  const [events, setEvents] = useState([])
  const [userEvents, setUserEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    Promise.all([
      apiFetch('/api/events?limit=200', { cache: false }).catch(() => []),
      // User-created event posts. Fetch a wide window so the page reads as
      // a real calendar; cap at the API's max limit.
      apiFetch('/api/posts/?category=events&limit=100', { cache: false }).catch(() => []),
    ]).then(([syncedEvents, eventPosts]) => {
      if (cancelled) return
      setEvents(syncedEvents || [])
      setUserEvents(eventPosts || [])
    }).catch((e) => {
      if (!cancelled) setError(e?.message || 'Failed to load events')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  // Merge synced events + user-created event posts into one chronological
  // list grouped by month. Synced events use `event_date`; user posts use
  // `event_date` too (mirrors the Post model).
  const grouped = useMemo(() => {
    const items = [
      ...events.map((e) => ({
        kind: 'synced',
        id: `e-${e.id}`,
        title: e.title,
        date: e.event_date,
        time: e.start_time,
        location: e.location,
        url: e.source_url,
        description: e.description,
        image_url: e.image_url,
      })),
      ...userEvents.map((p) => ({
        kind: 'user',
        id: `p-${p.id}`,
        title: p.title,
        date: p.event_date,
        time: p.event_time,
        location: null,
        url: `/post/${p.id}`,
        description: p.body,
        image_url: p.image_url,
        author: p.author,
      })),
    ]
      .filter((it) => it.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))

    const buckets = new Map()
    for (const it of items) {
      const key = monthKey(it.date)
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(it)
    }
    return Array.from(buckets.entries())
  }, [events, userEvents])

  return (
    <div className="min-h-[60vh] max-w-[1100px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      <header>
        <h1 className="font-editorial font-black text-[2rem] sm:text-[2.4rem] leading-none tracking-tight m-0">
          Events
        </h1>
        <p className="text-mini text-gray font-archivo uppercase tracking-wider mt-2">
          Morgan State campus calendar · auto-synced from events.morgan.edu plus student-created event posts.
        </p>
      </header>

      {loading && (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="bg-card border border-lightgray h-[120px] animate-pulse" />)}
        </div>
      )}
      {error && (
        <div className="bg-danger-bg border border-danger/40 text-danger px-4 py-3 font-archivo text-mini font-bold">
          {error}
        </div>
      )}

      {!loading && grouped.length === 0 && (
        <div className="bg-card border border-dashed border-lightgray px-5 py-10 text-center">
          <div className="font-editorial italic text-[1.2rem] text-gray leading-snug mb-1">
            “No upcoming events.”
          </div>
          <p className="text-mini text-gray font-archivo uppercase tracking-wider">
            Check back after the next sync, or create an event post from the feed.
          </p>
        </div>
      )}

      {grouped.map(([month, items]) => (
        <section key={month}>
          <h2 className="font-archivo font-extrabold text-[0.82rem] uppercase tracking-wider text-navy border-b border-lightgray pb-2 mb-3">
            {month}
          </h2>
          <ul className="list-none p-0 m-0 space-y-2">
            {items.map((it) => (
              <li key={it.id} className="bg-card border border-lightgray border-l-[3px] border-l-gold p-4 flex gap-4">
                <div className="shrink-0 text-center w-[60px] border-r border-lightgray pr-3">
                  {(() => {
                    // eventDateParts splits "YYYY-MM-DD" into local components
                    // without ever going through UTC, so the displayed weekday
                    // and day match the database's date for every viewer
                    // regardless of timezone. (See parseDateOnly's comment.)
                    const parts = eventDateParts(it.date)
                    return (
                      <>
                        <div className="font-archivo font-extrabold text-2xs uppercase tracking-wider text-gray">
                          {parts.weekday}
                        </div>
                        <div className="font-editorial font-black text-[1.6rem] leading-none mt-0.5 text-navy">
                          {parts.day}
                        </div>
                        <div className="font-archivo font-bold text-2xs uppercase tracking-wider text-gray mt-0.5">
                          {parts.month}
                        </div>
                      </>
                    )
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-2xs font-archivo font-extrabold uppercase tracking-wider bg-offwhite border border-lightgray px-2 py-[2px]">
                      {it.kind === 'synced' ? 'Campus' : 'Student post'}
                    </span>
                    {it.time && (
                      <span className="text-2xs text-gray font-archivo uppercase tracking-wider">{it.time}</span>
                    )}
                  </div>
                  {it.url ? (
                    it.url.startsWith('/') ? (
                      <Link to={it.url} className="text-ink no-underline hover:underline">
                        <h3 className="font-archivo font-bold text-[1rem] leading-tight m-0">{it.title}</h3>
                      </Link>
                    ) : (
                      <a href={safeHref(it.url)} target="_blank" rel="noopener noreferrer" className="text-ink no-underline hover:underline">
                        <h3 className="font-archivo font-bold text-[1rem] leading-tight m-0">{it.title}</h3>
                      </a>
                    )
                  ) : (
                    <h3 className="font-archivo font-bold text-[1rem] leading-tight m-0">{it.title}</h3>
                  )}
                  {it.location && (
                    <div className="text-2xs text-gray font-archivo uppercase tracking-wider mt-1">
                      📍 {it.location}
                    </div>
                  )}
                  {it.description && (
                    <p className="text-[0.85rem] text-ink/80 font-prose leading-relaxed line-clamp-2 mt-1.5 m-0">
                      {it.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
