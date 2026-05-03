// Small set of shared formatters used across the feed, profile, and mobile
// dashboard. Kept pure (no React) so they're cheap to import anywhere.

export function initialsFor(name) {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

// Parse a date-only ISO string ("YYYY-MM-DD") as a LOCAL date.
//
// Why this exists: per ECMAScript, `new Date("2026-05-04")` is parsed as
// UTC midnight, not local midnight. For a US East Coast user, UTC midnight
// on May 4 is 8 PM EDT on May 3 — so calling .getDate() / .toLocaleDateString()
// on it returns "May 3". The Events page hit exactly this on every row.
//
// We tolerate datetime-shaped input too (slice to first 10 chars) so a
// caller that accidentally passes "2026-05-04T18:00:00" still gets a
// sensible date object.
export function parseDateOnly(iso) {
  if (!iso) return null
  const s = String(iso).slice(0, 10)
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

// Parse an ISO timestamp from the API as UTC.
//
// Backend Pydantic schemas serialize naive `DateTime` columns (e.g.
// posts.created_at) as ISO 8601 without a timezone marker, like
// "2026-05-03T03:30:00". The Date constructor reads those as LOCAL time,
// not UTC — so an hour-old post made at 03:30 UTC would look 4 hours in
// the future on a US East Coast user's clock and clamp to "Just now"
// in formatRelativeTime. Appending "Z" forces UTC parsing.
//
// We only append when no timezone marker is already present (Z, +HH:MM,
// or -HH:MM at the end), so already-correct strings pass through
// unchanged.
export function parseUtcDate(iso) {
  if (!iso) return null
  const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(iso)
  return new Date(hasTimezone ? iso : iso + 'Z')
}

// "Just now", "1 second ago", "10 minutes ago", "3 hours ago", "2 days ago",
// "5 months ago", "1 year ago". Spelled out so the feed reads naturally
// rather than like log lines. Singular vs plural handled per unit.
function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'} ago`
}

export function formatRelativeTime(iso) {
  if (!iso) return ''
  const dt = parseUtcDate(iso)
  const then = dt ? dt.getTime() : NaN
  if (Number.isNaN(then)) return ''
  const seconds = Math.floor((Date.now() - then) / 1000)
  // Sub-second / clock-skew: treat as "just now" so we never show negative
  // ages or a confusing 0-second value.
  if (seconds < 5) return 'Just now'
  if (seconds < 60) return plural(seconds, 'second')
  const m = Math.floor(seconds / 60)
  if (m < 60) return plural(m, 'minute')
  const h = Math.floor(m / 60)
  if (h < 24) return plural(h, 'hour')
  const d = Math.floor(h / 24)
  if (d < 30) return plural(d, 'day')
  const mo = Math.floor(d / 30)
  if (mo < 12) return plural(mo, 'month')
  return plural(Math.floor(mo / 12), 'year')
}

// Short variant used by the mobile feed ("5s", "12m") where ago is implicit
// from the position in the card.
export function formatRelativeShort(iso) {
  const s = formatRelativeTime(iso)
  return s.replace(/\s+ago$/, '')
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function eventDateParts(iso) {
  if (!iso) return { month: '', day: '', weekday: '' }
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return { month: '', day: '', weekday: '' }
  const dt = new Date(y, m - 1, d)
  return {
    month: MONTH_ABBR[m - 1] || '',
    day: String(d),
    weekday: Number.isNaN(dt.getTime()) ? '' : WEEKDAY_ABBR[dt.getDay()],
  }
}

export function formatEventDateTime(dateStr, timeStr) {
  if (!dateStr) return ''
  const [y, mo, d] = dateStr.split('-').map(Number)
  let hour = null
  let minute = 0
  if (timeStr) {
    const [hh, mm] = timeStr.split(':').map(Number)
    hour = hh
    minute = mm || 0
  }
  const dt = new Date(y, (mo || 1) - 1, d || 1, hour ?? 0, minute)
  if (Number.isNaN(dt.getTime())) return ''
  const dateLabel = dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  if (hour === null) return dateLabel
  const timeLabel = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${dateLabel} at ${timeLabel}`
}
