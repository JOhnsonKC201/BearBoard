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

// "5s ago", "12m ago", "3h ago", "4d ago", "2mo ago", "1y ago".
export function formatRelativeTime(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
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
