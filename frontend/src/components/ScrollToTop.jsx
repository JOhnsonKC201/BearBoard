import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Resets window scroll position to the top whenever the route changes.
// Without this, clicking a post from mid-feed drops you into the detail
// page at the same scroll offset as the feed, which reads as broken.
//
// If the destination URL carries a hash (e.g. "/#team"), scroll to the
// element with that id instead. React Router v6 doesn't handle hash-
// anchors out of the box; before this logic the TEAM / GROUPS / EVENTS
// links in the top nav silently did nothing when clicked from a
// non-Home page. We retry a few times because the destination page may
// be lazy-loaded and not yet in the DOM on the first frame.
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (hash) {
      const targetId = hash.replace(/^#/, '')
      const delays = [50, 200, 500, 1000]
      let cancelled = false
      const attempt = (i) => {
        if (cancelled) return
        const el = document.getElementById(targetId)
        if (el) {
          const navbarOffset = 60 // sticky navbar height
          const top = el.getBoundingClientRect().top + window.pageYOffset - navbarOffset
          window.scrollTo({ top, left: 0, behavior: 'smooth' })
          return
        }
        if (i + 1 < delays.length) {
          setTimeout(() => attempt(i + 1), delays[i + 1])
        } else {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        }
      }
      setTimeout(() => attempt(0), delays[0])
      return () => { cancelled = true }
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, hash])
  return null
}

export default ScrollToTop
