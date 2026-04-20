// Small set of consistent 14px SVG icons for post action bars. Using
// inline SVG (not emoji) so the style is uniform across macOS/Windows/Linux
// and we control stroke weight, fill state, and color transitions.

export function IconCaretUp({ filled = false }) {
  return (
    <svg width="11" height="11" viewBox="0 0 10 10" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      <path d="M5 2.2 L8.6 7.8 L1.4 7.8 Z" />
    </svg>
  )
}

export function IconCaretDown({ filled = false }) {
  return (
    <svg width="11" height="11" viewBox="0 0 10 10" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      <path d="M5 7.8 L8.6 2.2 L1.4 2.2 Z" />
    </svg>
  )
}

export function IconChat() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a8 8 0 0 1-11.3 7.3L4 21l1.7-5.7A8 8 0 1 1 21 12z" />
    </svg>
  )
}

export function IconBookmark({ filled = false }) {
  return (
    <svg width="13" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  )
}

export function IconShare() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
    </svg>
  )
}

export function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12l5 5L20 7" />
    </svg>
  )
}
